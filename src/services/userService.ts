import { FastifyInstance } from 'fastify';
import { rolePermissions, userRoles, users } from '../db/schema.js';
import { eq, and, count, desc, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { createUserInSuperTokens } from '../auth/supertokens/supertokensService.js';

type User = InferSelectModel<typeof users>;
type NewUser = InferInsertModel<typeof users> & { roles?: string[] };

export const UserService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        // Create a new user
        async createUser(
            userData: Partial<NewUser>,
            orgName: string,
            storeName: string,
            tx?: any, // Use the actual transaction type if available
            role?: string
        ): Promise<User> {

            console.log(`create user Data: `, userData, orgName, storeName);
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

            // const hashedPassword = await bcrypt.hash('12345', 10);
            const isActive = userData.isActive ?? true;
            const authType = userData.authType ?? 'DB';

            const updatedUserData: NewUser = {
                ...userData,
                id: createId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: userData.createdBy ? userData.createdBy : 'system',
                updatedBy: userData.updatedBy ? userData.updatedBy : 'system',
                // password: hashedPassword,
                isActive,
                authType,
            } as NewUser;

            const insertUserAndRole = async (trx: any) => {
                const [user] = await trx.insert(users).values({
                    ...updatedUserData,
                }).returning();

                const { roles } = userData;
                if (roles && roles.length > 0) {

                    //     await trx.insert(userRoles).values({
                    //     id: createId(),
                    //     userId: userData.userId!,
                    //     roleId: role, // TODO change the default role
                    //     orgName: orgName,
                    //     storeName: storeName,
                    //     createdBy: userData.createdBy ? userData.createdBy : 'system',
                    //     updatedBy: userData.updatedBy ? userData.updatedBy : 'system',
                    //     createdAt: new Date().toISOString(),
                    //     updatedAt: new Date().toISOString(),
                    // });

                    const newRoleRows = roles.map(roleId => ({
                        id: createId(),
                        userId: userData.userId!,
                        roleId,
                        orgName: orgName || '',
                        storeName: storeName || '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        createdBy: userData.createdBy ? userData.createdBy : 'system',
                        updatedBy: userData.updatedBy ? userData.updatedBy : 'system',
                    }));

                    await trx.insert(userRoles).values(newRoleRows);
                }

                // console.log(`User created:, ${user.emailId}, ${hashedPassword}`);
                // TODO remove this api call to active org/user
                await createUserInSuperTokens(user.emailId, fastify);
                return user;
            };

            if (tx) {
                // Use existing transaction
                return await insertUserAndRole(tx);
            } else {
                // Create new transaction
                try {
                    const result = await db.transaction(insertUserAndRole);
                    return result!;
                } catch (error: any) {
                    throw new Error(`Failed to create user: ${error.message}`);
                }
            }
        },

        // Get all users with optional status
        async getAllUsers(
            page: number = 1,
            limit: number = 10,
            status: boolean | null = null,
            orgName: string,
            storeName: string
        ): Promise<{
            users: Array<User & { orgName?: string; storeName?: string; roles: string[] }>;
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

                if (storeName) {
                    whereConditions.push(inArray(userRoles.storeName, [storeName, 'All']));
                }

                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                // Get paginated users with join
                const joinedResults = await db.select().from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .where(whereClause)
                    .offset(skip)
                    .limit(limit)
                    .orderBy(desc(users.createdAt));

                // Get total count
                const totalResult = await db.select({ count: count() })
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

                // Group users and their roles
                const userMap = new Map<string, User & { orgName?: string; storeName?: string; roles: string[] }>();

                for (const row of joinedResults) {
                    const user = row.users;
                    const role = row.user_roles;

                    if (!userMap.has(user.userId)) {
                        userMap.set(user.userId, {
                            ...user,
                            orgName: role.orgName,
                            storeName: role.storeName || '',
                            roles: [],
                        });
                    }

                    const existingUser = userMap.get(user.userId)!;

                    if (!existingUser.roles.includes(role.roleId)) {
                        existingUser.roles.push(role.roleId);
                    }
                }

                const usersWithRoles = Array.from(userMap.values());

                return {
                    users: usersWithRoles,
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
        async getUserById(
            userId: string,
            // orgName: string,
            // storeName: string
        ): Promise<any> {
            try {
                const results = await db.select()
                    .from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
                    .where(and(
                        eq(users.userId, userId),
                        // eq(userRoles.orgName, orgName),
                        // eq(userRoles.storeName, storeName)
                    ))
                    .limit(100);

                if (!results || results.length === 0) {
                    throw new Error('User not found');
                }

                console.log(`data loaded: `, results);
                const userData: {
                    user: typeof results[0]['users'] & { orgName?: string; storeName?: string };
                    roles: string[];
                    permissions: string[];
                } = {
                    user: results[0]?.users as any,
                    roles: [],
                    permissions: [],
                };

                for (const row of results) {

                    const role = row.user_roles;
                    const permission = row.role_permissions;

                    userData.user.orgName = role.orgName;
                    userData.user.storeName = role.storeName ? role.storeName : '';

                    // Add role if not already added
                    if (!userData.roles.includes(role.roleId)) {
                        userData.roles.push(role.roleId);
                    }

                    // Add permission if not already added
                    if (!userData.permissions.includes(permission.permissionId)) {
                        userData.permissions.push(permission.permissionId);
                    }
                }

                console.log(`userData: `, userData);
                return userData;
            } catch (error: any) {
                throw new Error(`Failed to fetch user: ${error.message}`);
            }
        },

        // Update user
        async updateUser(
            userData: Partial<NewUser> & { roles?: string[] },
            orgName: string,
            storeName: string,
            tx?: typeof db, // Adjust this to your actual DB transaction type (e.g., Drizzle transaction type)
        ): Promise<User> {
            if (!userData.userId) {
                throw new Error('userId is required to update user');
            }

            const dbInstance = tx ?? db; // use transaction if provided, else fallback to base db

            try {
                return await dbInstance.transaction(async (trx) => {
                    console.log(`update user Data: `, userData);

                    const { roles, ...userUpdateData } = userData;

                    // 1. Update user data
                    const [user] = await trx.update(users)
                        .set(userUpdateData)
                        .where(eq(users.userId, userData.userId ? userData.userId : ''))
                        .returning();

                    if (!user) throw new Error('User not found');

                    // 2. Update roles
                    if (roles && roles.length > 0) {
                        // Delete old roles
                        await trx.delete(userRoles).where(eq(userRoles.userId, userData.userId ? userData.userId : ''));

                        // Insert new roles
                        const now = new Date().toISOString();

                        const newRoleRows = roles.map(roleId => ({
                            id: createId(),
                            userId: userData.userId!,
                            roleId,
                            orgName: orgName || '',
                            storeName: storeName || '',
                            createdAt: now,
                            updatedAt: now,
                            createdBy: userData.updatedBy || '',
                            updatedBy: userData.updatedBy || '',
                        }));

                        await trx.insert(userRoles).values(newRoleRows);
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
                    // First, delete from user_roles
                    await tx
                        .delete(userRoles)
                        .where(and(
                            eq(userRoles.userId, userId),
                            eq(userRoles.orgName, orgName),
                            eq(userRoles.storeName, storeName)
                        ));

                    // Then delete from users table
                    const [deletedUser] = await tx
                        .delete(users)
                        .where(and(
                            eq(users.userId, userId),
                        ))
                        .returning();

                    if (!deletedUser) {
                        throw new Error('User not found');
                    }

                    return deletedUser;
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
        async activateUser(userId: string, orgName: string, storeName: string): Promise<User> {
            void orgName;
            void storeName;
            try {
                const [user] = await db.update(users)
                    .set({ isActive: true })
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
            storeName: string
        ): Promise<User> {
            void orgName;
            void storeName;
            try {
                const [user] = await db.update(users)
                    .set({ isActive: false })
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
    };
};
