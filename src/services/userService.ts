import { FastifyInstance } from 'fastify';
import { organizations, rolePermissions, stores, storeUsers, userRoles, users } from '../db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createUserInSuperTokens } from '../auth/supertokens/supertokensService.js';

type storeRoles = {
    storeName: string;
    roleIds: string[];
    isCurrentStore: boolean;
};
type User = InferSelectModel<typeof users>;
type NewUser = InferInsertModel<typeof users> & { storeRoles?: storeRoles[] };


type StoreRoleForSession = {
    storeName: string;
    isActive: boolean;
    isCurrentStore: boolean;
    timezone: string;
    roles: {
        roleId: string;
        permissions: string[];
    }[];
};

type OrganizationForSession = {
    orgName: string;
    isActive: boolean;
};

type UserDataForSession = {
    userId: string;
    firstName: string;
    lastName: string;
    emailId: string;
    phoneNumber: string;
    isActive: boolean;
    isDeleted: boolean;
    userType: string;
    password: string;

    organization: OrganizationForSession;
    currentStore: string | 'All';
    storeRoles: StoreRoleForSession[];

    roles: string[];
    permissions: string[];
};

export const UserService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        // Create a new user 
        // Assign a default role "role_admin" if no roles are provided
        // Creae a default store_user with storeName as 'All' if no stores are provided
        // Create user in SuperTokens
        async createUser(
            userData: Partial<NewUser> & {
                storeRoles?: Array<{
                    storeName: string;
                    roleIds: string[];
                    isCurrentStore: boolean;
                }>;
            },
            orgName: string,
            tx?: typeof db
        ): Promise<User> {

            if (
                !userData.emailId ||
                !userData.userId ||
                !userData.firstName ||
                !userData.lastName ||
                !userData.address1 ||
                !userData.city ||
                !userData.state ||
                !userData.zip ||
                !userData.country
            ) {
                throw new Error("Missing required user fields");
            }

            const dbInstance = tx ?? db;
            const now = new Date().toISOString();
            try {
                return await dbInstance.transaction(async (trx) => {
                    const { storeRoles, ...userInsertData } = userData;
                    const updatedUserData: NewUser = {
                        ...userInsertData,
                        id: createId(),
                        emailId: userData.emailId ? userData.emailId.toLowerCase() : '',
                        userId: userData.userId ? userData.userId : userData.emailId?.toLowerCase() || '',
                        firstName: userData.firstName ? userData.firstName.trim() : '',
                        lastName: userData.lastName ? userData.lastName.trim() : '',
                        address1: userData.address1 ? userData.address1.trim() : '',
                        city: userData.city ? userData.city.trim() : '',
                        state: userData.state ? userData.state.trim() : '',
                        zip: userData.zip ? userData.zip.trim() : '',
                        country: userData.country ? userData.country.trim() : '',
                        createdAt: now,
                        updatedAt: now,
                        createdBy: userData.createdBy ?? 'system',
                        updatedBy: userData.updatedBy ?? 'system',
                        isActive: userData.isActive ?? true,
                        userType: userData.userType ?? 'human',
                    }

                    // 1. Insert into users table
                    const [user] = await trx
                        .insert(users)
                        .values({
                            ...updatedUserData,
                        })
                        .returning();

                    if (!user) {
                        throw new Error('Failed to create user');
                    }

                    // 2. Insert userRoles
                    if (storeRoles && storeRoles.length > 0) {
                        const userRoleRows = storeRoles.flatMap(store => {
                            if (!store.storeName || !store.roleIds?.length) return [];
                            return store.roleIds.map(roleId => ({
                                id: createId(),
                                userId: user.userId,
                                roleId,
                                orgName: orgName || '',
                                storeName: store.storeName,
                                createdAt: now,
                                updatedAt: now,
                                createdBy: userData.createdBy ?? 'system',
                                updatedBy: userData.updatedBy ?? 'system',
                            }));
                        });

                        if (userRoleRows.length > 0) {
                            await trx.insert(userRoles).values(userRoleRows);
                        }

                        // 3. Insert storeUsers
                        const storeUserRows = storeRoles.map(store => ({
                            id: createId(),
                            orgName,
                            storeName: store.storeName,
                            userId: user.userId,
                            isCurrentStore: store.isCurrentStore ?? false,
                            createdAt: now,
                            updatedAt: now,
                            createdBy: userData.createdBy ?? 'system',
                            updatedBy: userData.updatedBy ?? 'system',
                        }));

                        if (storeUserRows.length > 0) {
                            await trx.insert(storeUsers).values(storeUserRows);
                        }
                    }

                    // 4. Create user in SuperTokens only for human users
                    if (user.userType === 'human') {
                        await createUserInSuperTokens(user.userId, fastify);
                    }

                    return user;
                });
            } catch (error: any) {
                throw new Error(`Failed to create user: ${error.message}`);
            }
        },

        // async createUser(
        //     userData: Partial<NewUser> & {
        //         storeRoles?: Array<{
        //             storeName: string;
        //             roleIds: string[];
        //             isCurrentStore: boolean;
        //         }>;
        //     },
        //     orgName: string,
        //     tx?: typeof db
        //     // tx?: Parameters<typeof db.transaction>[0] extends (fn: (tx: infer T) => any) => any ? T : never
        // ): Promise<User> {

        //     if (tx) {
        //         // Use parent transaction
        //         return await this.createUserInternal(userData, orgName, tx );
        //     }

        //     // Otherwise, start a new transaction
        //     return await db.transaction(async trx => {
        //         return await this.createUserInternal(userData, orgName, trx);
        //     });
        // },


        // async createUserInternal(
        //     userData: Partial<NewUser> & {
        //         storeRoles?: Array<{
        //             storeName: string;
        //             roleIds: string[];
        //             isCurrentStore: boolean;
        //         }>;
        //     },
        //     orgName: string,
        //     trx: any // TODO : Replace with correct type for transaction
        // ): Promise<User> {
        //     if (
        //         !userData.emailId ||
        //         !userData.userId ||
        //         !userData.firstName ||
        //         !userData.lastName ||
        //         !userData.address1 ||
        //         !userData.city ||
        //         !userData.state ||
        //         !userData.zip ||
        //         !userData.country
        //     ) {
        //         throw new Error("Missing required user fields");
        //     }

        //     const now = new Date().toISOString();
        //     const { storeRoles, ...userInsertData } = userData;

        //     const updatedUserData: NewUser = {
        //         ...userInsertData,
        //         id: createId(),
        //         emailId: userData.emailId.toLowerCase(),
        //         userId: userData.userId.toLowerCase(),
        //         firstName: userData.firstName.trim(),
        //         lastName: userData.lastName.trim(),
        //         address1: userData.address1.trim(),
        //         city: userData.city.trim(),
        //         state: userData.state.trim(),
        //         zip: userData.zip.trim(),
        //         country: userData.country.trim(),
        //         createdAt: now,
        //         updatedAt: now,
        //         createdBy: userData.createdBy ?? 'system',
        //         updatedBy: userData.updatedBy ?? 'system',
        //         isActive: userData.isActive ?? true,
        //         userType: userData.userType ?? 'human',
        //     };

        //     const [user] = await trx.insert(users).values(updatedUserData).returning();
        //     if (!user) throw new Error('Failed to create user');

        //     if (storeRoles?.length) {
        //         const userRoleRows = storeRoles.flatMap(store => {
        //             if (!store.storeName || !store.roleIds?.length) return [];
        //             return store.roleIds.map(roleId => ({
        //                 id: createId(),
        //                 userId: user.userId,
        //                 roleId,
        //                 orgName: orgName || '',
        //                 storeName: store.storeName,
        //                 createdAt: now,
        //                 updatedAt: now,
        //                 createdBy: userData.createdBy ?? 'system',
        //                 updatedBy: userData.updatedBy ?? 'system',
        //             }));
        //         });

        //         if (userRoleRows.length) {
        //             await trx.insert(userRoles).values(userRoleRows);
        //         }

        //         const storeUserRows = storeRoles.map(store => ({
        //             id: createId(),
        //             orgName,
        //             storeName: store.storeName,
        //             userId: user.userId,
        //             isCurrentStore: store.isCurrentStore ?? false,
        //             createdAt: now,
        //             updatedAt: now,
        //             createdBy: userData.createdBy ?? 'system',
        //             updatedBy: userData.updatedBy ?? 'system',
        //         }));

        //         if (storeUserRows.length) {
        //             await trx.insert(storeUsers).values(storeUserRows);
        //         }
        //     }

        //     if(user.userType === 'human') {
        //     await createUserInSuperTokens(user.userId, fastify);
        // }
        //     return user;
        // },


        // Get all users with optional status
        async getAllUsers(
            page: number = 1,
            limit: number = 10,
            status: boolean | null = null,
            orgName: string,
            storeName: string
        ): Promise<{
            users: Array<User & {
                orgName?: string;
                storeRoles: Array<{
                    storeName: string;
                    roleIds: string[];
                    isCurrentStore: boolean;
                }>;
            }>;
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }> {
            try {
                const skip = (page - 1) * limit;
                const whereConditions = [];

                if (status !== null) {
                    whereConditions.push(eq(users.isActive, status));
                }

                if (orgName) {
                    whereConditions.push(eq(userRoles.orgName, orgName));
                }

                else if (storeName && storeName !== 'All') {
                    whereConditions.push(eq(userRoles.storeName, storeName));
                }
                // const stores = storeName ? [storeName, 'All'] : ['All'];
                // whereConditions.push(inArray(userRoles.storeName, stores));

                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                // Join users with userRoles and storeUsers
                const joinedResults = await db
                    .select()
                    .from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .leftJoin(storeUsers, eq(users.userId, storeUsers.userId)) // ← LEFT JOIN storeUsers
                    .where(whereClause)
                    .offset(skip)
                    .limit(limit)
                    .orderBy(desc(users.createdAt));

                // Total count
                const totalResult = await db
                    .select({ count: count() })
                    .from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .where(whereClause);

                const total = totalResult[0]?.count ?? 0;

                if (!joinedResults || joinedResults.length === 0) {
                    return {
                        users: [],
                        pagination: {
                            total,
                            page,
                            limit,
                            totalPages: Math.ceil(total / limit),
                        },
                    };
                }

                // Group users with storeRoles
                const userMap = new Map<
                    string,
                    User & {
                        orgName?: string;
                        storeRoles: Array<{
                            storeName: string;
                            roleIds: string[];
                            isCurrentStore: boolean;
                        }>;
                    }
                >();

                for (const row of joinedResults) {
                    const user = row.users;
                    const role = row.user_roles;
                    const storeUser = row.store_users;

                    if (!userMap.has(user.userId)) {
                        userMap.set(user.userId, {
                            ...user,
                            orgName: role.orgName,
                            storeRoles: [],
                        });
                    }

                    const existingUser = userMap.get(user.userId)!;
                    const storeNameKey = role.storeName || 'All';

                    let storeRole = existingUser.storeRoles.find(s => s.storeName === storeNameKey);
                    if (!storeRole) {
                        storeRole = {
                            storeName: storeNameKey,
                            roleIds: [],
                            isCurrentStore: false,
                        };
                        existingUser.storeRoles.push(storeRole);
                    }

                    if (!storeRole.roleIds.includes(role.roleId)) {
                        storeRole.roleIds.push(role.roleId);
                    }

                    // Set isCurrentStore if matched store exists in storeUsers
                    if (
                        storeUser &&
                        storeUser.storeName === role.storeName &&
                        storeUser.orgName === role.orgName &&
                        storeUser.isCurrentStore === true
                    ) {
                        storeRole.isCurrentStore = true;
                    }
                }

                const usersWithStoreRoles = Array.from(userMap.values());

                return {
                    users: usersWithStoreRoles,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit),
                    },
                };
            } catch (error: any) {
                throw new Error(`Failed to fetch users: ${error.message}`);
            }
        },


        // Get user by ID
        // async getUserById(userId: string): Promise<{
        //     user: typeof users.$inferSelect; // or a more specific type
        //     storeRoles: Array<{ storeName: string; roleIds: string[] }>;
        //     permissions: string[];
        // }> {
        async getUserById(userId: string): Promise<any> {
            try {
                const results = await db.select()
                    .from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
                    .where(eq(users.userId, userId))
                    .limit(100);

                if (!results || results.length === 0) {
                    return null;
                }

                const user = results[0]?.users;

                const storeRolesMap = new Map<string, Set<string>>();
                const permissionsSet = new Set<string>();

                for (const row of results) {
                    const { storeName, roleId } = row.user_roles;
                    const permissionId = row.role_permissions.permissionId;

                    if (storeName) {
                        if (!storeRolesMap.has(storeName)) {
                            storeRolesMap.set(storeName, new Set());
                        }
                        storeRolesMap.get(storeName)!.add(roleId);
                    }

                    permissionsSet.add(permissionId);
                }

                const storeRoles = Array.from(storeRolesMap.entries()).map(([storeName, roleSet]) => ({
                    storeName,
                    roleIds: Array.from(roleSet),
                }));

                return {
                    user,
                    storeRoles,
                    permissions: Array.from(permissionsSet),
                };
            } catch (error: any) {
                throw new Error(`Failed to fetch user: ${error.message}`);
            }
        },

        // async getUserByIdForSession(userId: string): Promise<UserDataForSession> {
        //     try {
        //         const results = await db.select({
        //             userId: users.userId,
        //             firstName: users.firstName,
        //             lastName: users.lastName,
        //             emailId: users.emailId,
        //             phoneNumber: users.phoneNumber,
        //             userIsActive: users.isActive,
        //             userIsDeleted: users.isDeleted,
        //             userType: users.userType,
        //             password: users.password,

        //             orgName: organizations.orgName,
        //             orgIsActive: organizations.isActive,

        //             storeName: userRoles.storeName,
        //             storeIsActive: stores.isActive,

        //             roleId: userRoles.roleId,
        //             permissionId: rolePermissions.permissionId,

        //             isCurrentStore: storeUsers.isCurrentStore,  // from storeUsers join
        //         })
        //             .from(users)
        //             .leftJoin(userRoles, eq(users.userId, userRoles.userId))  // LEFT JOIN for possible no roles
        //             .leftJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
        //             .innerJoin(organizations, eq(organizations.orgName, userRoles.orgName))  // org probably mandatory? If not, make LEFT JOIN
        //             .leftJoin(stores, and(eq(stores.orgName, userRoles.orgName), eq(stores.storeName, userRoles.storeName)))
        //             .leftJoin(storeUsers, and(
        //                 eq(storeUsers.orgName, userRoles.orgName),
        //                 eq(storeUsers.storeName, userRoles.storeName),
        //             ))  // LEFT JOIN storeUsers to get isCurrentStore, if any
        //             .where(eq(users.userId, userId))
        //             .limit(100);

        //         if (!results || results.length === 0) {
        //             throw new Error('User not found');
        //         }

        //         const firstRow = results[0];

        //         const userData: UserDataForSession = {
        //             userId: firstRow?.userId ? firstRow.userId : '',
        //             firstName: firstRow?.firstName ? firstRow.firstName : '',
        //             lastName: firstRow?.lastName ? firstRow.lastName : '',
        //             emailId: firstRow?.emailId ? firstRow.emailId : '',
        //             phoneNumber: firstRow?.phoneNumber ? firstRow.phoneNumber : '',
        //             isActive: firstRow?.userIsActive ? firstRow.userIsActive : false,
        //             isDeleted: firstRow?.userIsDeleted ? firstRow.userIsDeleted : false,
        //             userType: firstRow?.userType ? firstRow.userType : 'human',
        //             password: firstRow?.password ? firstRow.password : '',

        //             organization: {
        //                 orgName: firstRow?.orgName ? firstRow.orgName : '',
        //                 isActive: firstRow?.orgIsActive ? firstRow.orgIsActive : false,
        //             },
        //             currentStore: 'All',

        //             storeRoles: [],

        //             roles: [],
        //             permissions: [],
        //         };

        //         const storeRolesMap = new Map<string, StoreRoleForSession>();

        //         for (const row of results) {
        //             // Roles and permissions
        //             if (row.roleId && !userData.roles.includes(row.roleId)) {
        //                 userData.roles.push(row.roleId);
        //             }
        //             if (row.permissionId && !userData.permissions.includes(row.permissionId)) {
        //                 userData.permissions.push(row.permissionId);
        //             }
        //             if (row.isCurrentStore || row.storeName === 'All') {
        //                 userData.currentStore = row.storeName ? row.storeName : 'All';
        //             }
        //             // Store grouping, include isCurrentStore (default false if null/undefined)
        //             const storeKey = row.storeName || 'All';

        //             if (!storeRolesMap.has(storeKey)) {
        //                 storeRolesMap.set(storeKey, {
        //                     storeName: storeKey,
        //                     roleIds: [],
        //                     isActive: row.storeIsActive ? true : false,
        //                     isCurrentStore: row.isCurrentStore ?? false,
        //                 });
        //             }

        //             const storeRoleEntry = storeRolesMap.get(storeKey)!;

        //             if (row.roleId && !storeRoleEntry.roleIds.includes(row.roleId)) {
        //                 storeRoleEntry.roleIds.push(row.roleId);
        //             }

        //             // If any row has isCurrentStore = true, keep it true (because user can have multiple rows)
        //             if (row.isCurrentStore) {
        //                 storeRoleEntry.isCurrentStore = true;
        //             }
        //         }
        //         userData.storeRoles = Array.from(storeRolesMap.values());
        //         return userData;
        //     } catch (error: any) {
        //         throw new Error(`Failed to fetch user: ${error.message}`);
        //     }
        // },
        async getUserByIdForSession(userId: string): Promise<UserDataForSession> {
            try {
                const results = await db
                    .select({
                        userId: users.userId,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        emailId: users.emailId,
                        phoneNumber: users.phoneNumber,
                        userIsActive: users.isActive,
                        userIsDeleted: users.isDeleted,
                        userType: users.userType,
                        password: users.password,

                        orgName: organizations.orgName,
                        orgIsActive: organizations.isActive,

                        storeName: userRoles.storeName,
                        storeIsActive: stores.isActive,
                        timezone: stores.timezone,

                        roleId: userRoles.roleId,
                        permissionId: rolePermissions.permissionId,

                        isCurrentStore: storeUsers.isCurrentStore,
                    })
                    .from(users)
                    .leftJoin(userRoles, eq(users.userId, userRoles.userId))
                    .leftJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
                    .innerJoin(organizations, eq(organizations.orgName, userRoles.orgName))
                    .leftJoin(
                        stores,
                        and(
                            eq(stores.orgName, userRoles.orgName),
                            eq(stores.storeName, userRoles.storeName)
                        )
                    )
                    .leftJoin(
                        storeUsers,
                        and(
                            eq(storeUsers.orgName, userRoles.orgName),
                            eq(storeUsers.storeName, userRoles.storeName)
                        )
                    )
                    .where(eq(users.userId, userId))
                    .limit(100);

                if (!results || results.length === 0) {
                    throw new Error('User not found');
                }

                const firstRow = results[0];

                const userData: UserDataForSession = {
                    userId: firstRow?.userId ?? '',
                    firstName: firstRow?.firstName ?? '',
                    lastName: firstRow?.lastName ?? '',
                    emailId: firstRow?.emailId ?? '',
                    phoneNumber: firstRow?.phoneNumber ?? '',
                    isActive: firstRow?.userIsActive ?? false,
                    isDeleted: firstRow?.userIsDeleted ?? false,
                    userType: firstRow?.userType ?? 'human',
                    password: firstRow?.password ?? '',

                    organization: {
                        orgName: firstRow?.orgName ?? '',
                        isActive: firstRow?.orgIsActive ?? false,
                    },
                    currentStore: 'All',
                    storeRoles: [],
                    roles: [],
                    permissions: [],
                };

                // Map store -> StoreRoleForSession
                const storeRolesMap = new Map<string, StoreRoleForSession>();

                // To help with overall unique roles/permissions
                const globalRoleSet = new Set<string>();
                const globalPermissionSet = new Set<string>();

                // Helper map to track roles inside each store (to prevent duplicates)
                const storeRoleTrackers = new Map<string, Map<string, Set<string>>>(); // storeName -> roleId -> permissionIds

                for (const row of results) {
                    const storeKey = row.storeName ?? 'All';
                    const roleId = row.roleId;
                    const permissionId = row.permissionId;

                    if (!storeRolesMap.has(storeKey)) {
                        storeRolesMap.set(storeKey, {
                            storeName: storeKey,
                            isActive: row.storeIsActive ?? false,
                            timezone: row.timezone ?? 'UTC',
                            isCurrentStore: row.isCurrentStore ?? false,
                            roles: [],
                        });

                        storeRoleTrackers.set(storeKey, new Map());
                    }

                    const storeEntry = storeRolesMap.get(storeKey)!;
                    const roleTracker = storeRoleTrackers.get(storeKey)!;

                    // Set current store
                    if (row.isCurrentStore || row.storeName === 'All') {
                        userData.currentStore = storeKey;
                        storeEntry.isCurrentStore = true;
                    }

                    if (roleId) {
                        globalRoleSet.add(roleId);

                        // Check if this role already exists in the store
                        let permissionsSet = roleTracker.get(roleId);
                        if (!permissionsSet) {
                            permissionsSet = new Set();
                            roleTracker.set(roleId, permissionsSet);

                            storeEntry.roles.push({
                                roleId,
                                permissions: [],
                            });
                        }

                        if (permissionId) {
                            globalPermissionSet.add(permissionId);
                            permissionsSet.add(permissionId);
                        }
                    }
                }

                // Finalize: assign collected permission sets to store roles
                for (const [storeName, roleTracker] of storeRoleTrackers.entries()) {
                    const storeEntry = storeRolesMap.get(storeName)!;

                    for (const role of storeEntry.roles) {
                        const perms = roleTracker.get(role.roleId);
                        role.permissions = perms ? Array.from(perms) : [];
                    }
                }

                userData.storeRoles = Array.from(storeRolesMap.values());
                userData.roles = Array.from(globalRoleSet);
                userData.permissions = Array.from(globalPermissionSet);

                return userData;
            } catch (error: any) {
                throw new Error(`Failed to fetch user: ${error.message}`);
            }
        },


        // Update user
        async updateUser(
            userData: Partial<NewUser> & { storeRoles?: Array<{ storeName: string; roleIds: string[], isCurrentStore: boolean }> },
            orgName: string,
            tx?: typeof db
        ): Promise<User> {
            if (!userData.userId) {
                throw new Error('userId is required to update user');
            }

            console.log(`updating user Data: ${JSON.stringify(userData)} `);
            const dbInstance = tx ?? db;

            try {
                return await dbInstance.transaction(async (trx) => {
                    console.log(`update user Data: `, userData);

                    const { storeRoles, ...userUpdateData } = userData;

                    // 1. Update base user info
                    const [user] = await trx.update(users)
                        .set({
                            ...userUpdateData,
                            updatedAt: new Date().toISOString(),
                            updatedBy: userData.updatedBy ?? 'system',
                        })
                        .where(eq(users.userId, userData.userId ? userData.userId : ''))
                        .returning();

                    if (!user) {
                        throw new Error('User not found');
                    }

                    // 2. Update roles
                    if (storeRoles && storeRoles.length > 0) {
                        // Delete old userRoles for this user
                        await trx.delete(userRoles).where(eq(userRoles.userId, userData.userId ? userData.userId : ''));

                        // Re-insert updated userRoles
                        const now = new Date().toISOString();
                        const newRoleRows = storeRoles.flatMap(store => {
                            if (!store.storeName || !store.roleIds?.length) return [];
                            return store.roleIds.map(roleId => ({
                                id: createId(),
                                userId: userData.userId!,
                                roleId,
                                orgName: orgName || '',
                                storeName: store.storeName,
                                createdAt: now,
                                updatedAt: now,
                                createdBy: userData.updatedBy ?? 'system',
                                updatedBy: userData.updatedBy ?? 'system',
                            }));
                        });

                        if (newRoleRows.length > 0) {
                            await trx.insert(userRoles).values(newRoleRows);
                        }

                        // 3. update storeUsers table if needed
                        const storeUserRows = storeRoles.map(store => ({
                            id: createId(),
                            orgName,
                            storeName: store.storeName,
                            userId: userData.userId!,
                            isCurrentStore: store.isCurrentStore ?? false,
                            createdAt: now,
                            updatedAt: now,
                            createdBy: userData.updatedBy ?? 'system',
                            updatedBy: userData.updatedBy ?? 'system',
                        }));

                        if (storeUserRows.length > 0) {
                            await trx.delete(storeUsers).where(eq(storeUsers.userId, userData.userId ? userData.userId : ''));
                            await trx.insert(storeUsers).values(storeUserRows);
                        }
                    }
                    return user;
                });
            } catch (error: any) {
                throw new Error(`Failed to update user: ${error.message}`);
            }
        },


        // Delete user
        async deleteUser(
            userId: string,
            orgName: string,
            storeName: string
        ): Promise<{ message: string }> {
            if (!userId || !orgName || !storeName) {
                throw new Error('User ID, organization ID, and store name are required');
            }

            try {
                await db.transaction(async (tx) => {
                    // 1. Delete from userRoles for this store/org
                    await tx.delete(userRoles).where(and(
                        eq(userRoles.userId, userId),
                        eq(userRoles.orgName, orgName),
                        eq(userRoles.storeName, storeName)
                    ));

                    // 2. Delete from storeUsers
                    await tx.delete(storeUsers).where(and(
                        eq(storeUsers.userId, userId),
                        eq(storeUsers.orgName, orgName),
                        eq(storeUsers.storeName, storeName)
                    ));

                    // 3. Check if user has any remaining roles
                    const remainingRoles = await tx.select().from(userRoles).where(eq(userRoles.userId, userId));

                    // 4. Delete user only if no remaining roles
                    if (remainingRoles.length === 0) {
                        const [deletedUser] = await tx.delete(users)
                            .where(eq(users.userId, userId))
                            .returning();

                        if (!deletedUser) {
                            throw new Error('User not found');
                        }
                    }
                });

                return { message: `User ${userId} deleted successfully.` };
            } catch (error: any) {
                throw new Error(`Failed to delete user: ${error.message}`);
            }
        },

        // Get users by isActive
        async getUsersByStatus(status: boolean): Promise<User[]> {
            try {
                return await db.select().from(users).where(eq(users.isActive, status)).orderBy(desc(users.createdAt));
            } catch (error: any) {
                throw new Error(`Failed to fetch users by status: ${error.message}`);
            }
        },

        // Activate user
        async activateUser(userId: string, orgName: string, storeName: string, updatedBy: string): Promise<User> {
            void orgName;
            void storeName;
            try {
                const [user] = await db.update(users)
                    .set({ isActive: true, updatedBy })
                    .where(and(
                        eq(users.userId, userId),
                        // eq(users.orgName, orgName),
                        // eq(users.storeName, storeName)
                    )).returning();

                if (!user) throw new Error('User not found');
                return user;
            } catch (error: any) {
                throw new Error(`Failed to activate user: ${error.message}`);
            }
        },

        // Deactivate user
        async deactivateUser(userId: string,
            orgName: string,
            storeName: string,
            updatedBy: string
        ): Promise<User> {
            void orgName;
            void storeName;
            try {
                const [user] = await db.update(users)
                    .set({ isActive: false, updatedBy })
                    .where(and(
                        eq(users.userId, userId),
                        // eq(users.orgName, orgName),
                        // eq(users.storeName, storeName)
                    )).returning();

                if (!user) throw new Error('User not found');
                return user;
            } catch (error: any) {
                throw new Error(`Failed to deactivate user: ${error.message}`);
            }
        },

        // Update password
        async updateUserPassword(
            userId: string,
            orgName: string,
            storeName: string,
            oldPassword: string,
            newPassword: string
        ): Promise<User> {
            void orgName;
            void storeName;
            // TODO: validate oldPassword against stored hash
            try {
                const [user] = await db.update(users)
                    .set({ password: newPassword })
                    .where(and(
                        eq(users.password, oldPassword),
                        eq(users.userId, userId),
                        // eq(users.orgName, orgName),
                        // eq(users.storeName, storeName)
                    )).returning();

                if (!user) throw new Error('User not found');
                return user;
            } catch (error: any) {
                throw new Error(`Failed to update user password: ${error.message}`);
            }
        },

        // First, deactivate all other stores for this user
        // This will set the isCurrentStore flag to true for the user in the storeUsers table for the given store
        async setUserCurrentStore(
            userId: string,
            orgName: string,
            storeName: string
        ): Promise<any> {
            if (!userId || !orgName || !storeName) {
                throw new Error('User ID, organization ID, and store name are required');
            }
            try {
                // First, deactivate all other stores for this user

                await db.update(storeUsers)
                    .set({ isCurrentStore: false })
                    .where(and(
                        eq(storeUsers.userId, userId),
                        eq(storeUsers.orgName, orgName)
                    )).returning();

                // Then, activate the specified store for this user
                const [userStore] = await db.update(storeUsers)
                    .set({ isCurrentStore: true })
                    .where(and(
                        eq(storeUsers.userId, userId),
                        eq(storeUsers.orgName, orgName),
                        eq(storeUsers.storeName, storeName)
                    )).returning();

                return userStore;
            } catch (error: any) {
                throw new Error(`Failed to set user active store: ${error.message}`);
            }
        }
    };
};
