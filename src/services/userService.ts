import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { userRoles, users } from '../db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

type User = InferSelectModel<typeof users>;
type NewUser = InferInsertModel<typeof users>;

export const UserService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        // Create a new user
        async createUser(
            userData: Partial<NewUser>,
            orgName: string,
            storeName: string,
            tx?: any // Use the actual transaction type if available
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

            const hashedPassword = await bcrypt.hash('12345', 10);
            const isActive = userData.isActive ?? true;
            const authType = userData.authType ?? 'DB';

            const updatedUserData: NewUser = {
                ...userData,
                id: createId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: 'system',
                updatedBy: 'system',
                password: hashedPassword,
                isActive,
                authType,
            } as NewUser;

            const insertUserAndRole = async (trx: any) => {
                const [user] = await trx.insert(users).values({
                    ...updatedUserData,
                }).returning();

                await trx.insert(userRoles).values({
                    userId: userData.userId!,
                    roleId: "role_staff", // TODO change the default role
                    orgName: orgName,
                    storeName: storeName,
                    createdBy: 'system',
                    updatedBy: 'system',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

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
            users: User[];
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
                    whereConditions.push(eq(userRoles.storeName, storeName));
                }

                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                // Get paginated users with join
                const joinedResults = await db.select().from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .where(whereClause)
                    .offset(skip)
                    .limit(limit)
                    .orderBy(desc(users.createdAt));

                // Get total count with join
                const totalResult = await db.select({ count: count() })
                    .from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .where(whereClause);

                const usersList = joinedResults.map((row) => row.users);
                const total = totalResult[0]?.count ?? 0;

                return {
                    users: usersList,
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
            orgName: string,
            storeName: string
        ): Promise<User> {
            try {
                const [user] = await db.select()
                    .from(users)
                    .innerJoin(userRoles, eq(users.userId, userRoles.userId))
                    .where(and(
                        eq(users.userId, userId),
                        eq(userRoles.orgName, orgName),
                        eq(userRoles.storeName, storeName)
                    ))
                    .limit(1);

                if (!user) throw new Error('User not found');
                return user?.users;
            } catch (error: any) {
                throw new Error(`Failed to fetch user: ${error.message}`);
            }
        },

        // Update user
        async updateUser(
            updateData: Partial<NewUser>
        ): Promise<User> {
            try {
                const [user] = await db.update(users)
                    .set(updateData)
                    .where(and(
                        eq(users.userId, updateData.userId ? updateData.userId : ''),
                        // eq(users.orgName, updateData.orgName!),
                        // eq(users.storeName, updateData.storeName!)
                    )).returning();

                if (!user) throw new Error('User not found');
                return user;
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
