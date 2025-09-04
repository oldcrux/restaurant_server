import { FastifyInstance } from 'fastify';
import { stores } from '../db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { UserService } from './userService.js';
import { OrganizationService } from './organizationService.js';

type Store = InferSelectModel<typeof stores>;
type NewStore = InferInsertModel<typeof stores>;

export const StoreService = (fastify: FastifyInstance) => {
    const db = fastify.db;
    const userService = UserService(fastify);
    const organizationService = OrganizationService(fastify);

    return {
        // Create a new store
        async createStore(storeData: Partial<NewStore>): Promise<Store> {
            const now = new Date();
            // TODO : orgName should be validated before creating a store.
            // TODO : phone number, trunk phone number should be validated before creating a store.  Phone number is unique across all stores.
            // TODO : orgName + storeName should be unique
            console.log('Creating store with data:', storeData);
            return await db.transaction(async (tx) => {
                // TODO: Validate orgName, phone numbers, and uniqueness (outside or inside tx as needed)
                const newStore: NewStore = {
                    ...storeData,
                    id: createId(),
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    isActive: storeData.isActive !== undefined ? storeData.isActive : false,
                    isDeleted: false,
                } as NewStore;

                const [store] = await tx.insert(stores).values(newStore).returning();

                if (storeData.trunkPhoneNumber) {
                    const org = await organizationService.getOrganizationById(storeData.orgName || '');
                    if (!org) {
                        throw new Error('Organization not found for the store');
                    }

                    const userData = {
                        userId: storeData.trunkPhoneNumber,
                        emailId: org.emailId,
                        firstName: 'Store',
                        lastName: 'Admin',
                        userType: 'bot', // bot for trunk phone number
                        phoneNumber: storeData.trunkPhoneNumber,
                        createdBy: storeData.createdBy || 'system',
                        updatedBy: storeData.createdBy || 'system',
                        storeRoles: [
                            {
                                storeName: storeData.storeName || '',
                                roleIds: ['role_staff'],
                                isCurrentStore: true,
                            },
                        ],
                    };
                    await userService.createUser(userData, storeData.orgName || '', tx as any);
                    // TODO Transfer the trunk number to twilio
                }

                return store!;
            });
        },

        // Activate a store
        async activateStore(orgName: string, storeName: string, updatedBy: string): Promise<Store> {
            try {
                const [store] = await db
                    .update(stores)
                    .set({ isActive: true, updatedAt: new Date().toISOString(), updatedBy })
                    .where(and(eq(stores.orgName, orgName), eq(stores.storeName, storeName)))
                    .returning();

                if (!store) throw new Error('Store not found');
                return store;
            } catch (error: any) {
                throw new Error(`Failed to activate store: ${error.message}`);
            }
        },

        // Deactivate a store
        async deactivateStore(orgName: string, storeName: string, updatedBy: string): Promise<Store> {
            try {
                const [store] = await db
                    .update(stores)
                    .set({ isActive: false, updatedAt: new Date().toISOString(), updatedBy })
                    .where(and(eq(stores.orgName, orgName), eq(stores.storeName, storeName)))
                    .returning();

                if (!store) throw new Error('Store not found');
                return store;
            } catch (error: any) {
                throw new Error(`Failed to deactivate store: ${error.message}`);
            }
        },

        // Get all stores
        async getAllStores(
            page: number = 1,
            limit: number = 10,
            orgName: string,
            status: boolean | null = null
        ): Promise<{
            stores: Store[];
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }> {
            try {
                const skip = (page - 1) * limit;

                const whereConditions = status !== null ? [eq(stores.isActive, status)] : [];
                whereConditions.push(eq(stores.orgName, orgName));
                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                const [storesList, totalResult] = await Promise.all([
                    db.select().from(stores).where(whereClause).offset(skip).limit(limit).orderBy(desc(stores.createdAt)),
                    db.select({ count: count() }).from(stores).where(whereClause),
                ]);

                const total = totalResult[0]?.count ?? 0;

                return {
                    stores: storesList,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit),
                    },
                };
            } catch (error: any) {
                throw new Error(`Failed to fetch stores: ${error.message}`);
            }
        },

        // Get store by org + store name
        async getStoreByStoreName(orgName: string, storeName: string): Promise<Store> {
            try {
                const [store] = await db
                    .select()
                    .from(stores)
                    .where(and(eq(stores.orgName, orgName), eq(stores.storeName, storeName)))
                    .limit(1);

                if (!store) throw new Error('Store not found');
                return store;
            } catch (error: any) {
                throw new Error(`Failed to fetch store: ${error.message}`);
            }
        },

        // Get store by trunk Phone Number
        async getStoreByTrunkPhoneNumber(trunkPhoneNumber: string): Promise<Store> {
            console.log(`Fetching store by trunk phone number: ${trunkPhoneNumber}`);
            try {
                const [store] = await db
                    .select()
                    .from(stores)
                    .where(and(eq(stores.trunkPhoneNumber, trunkPhoneNumber)))
                    .limit(1);

                if (!store) throw new Error('Store not found');
                return store;
            } catch (error: any) {
                throw new Error(`Failed to fetch store: ${error.message}`);
            }
        },

        // Update store
        async updateStore(storeData: Partial<Store>): Promise<Store> {
            const updateData = {
                ...storeData,
                updatedAt: new Date().toISOString(),
            };
            console.log('Updating store with data:', updateData);
            // TODO : phone number should be validated.  Phone number is unique across all stores.
            // TODO: validate the new store name. If already present, throw an error.
            return await db.transaction(async (tx) => {
                try {
                    const [store] = await tx
                        .update(stores)
                        .set(updateData)
                        .where(and(eq(stores.storeName, updateData.storeName!), eq(stores.orgName, updateData.orgName!)))
                        .returning();

                    if (!store) throw new Error('Store not found');
                    if (storeData.trunkPhoneNumber) {
                        const user = await userService.getUserById(storeData.trunkPhoneNumber);
                        if (!user) {
                            const org = await organizationService.getOrganizationById(storeData.orgName || '');
                            if (!org) {
                                throw new Error('Organization not found for the store');
                            }

                            const userData = {
                                userId: storeData.trunkPhoneNumber,
                                emailId: org.emailId,
                                firstName: 'Store',
                                lastName: 'Admin',
                                userType: 'bot', // bot for trunk phone number
                                phoneNumber: storeData.trunkPhoneNumber,
                                address1: storeData.address1 || '',
                                address2: storeData.address2 || '',
                                city: storeData.city || '',
                                state: storeData.state || '',
                                zip: storeData.zip || '',
                                country: storeData.country || '',
                                createdBy: storeData.createdBy || 'system',
                                updatedBy: storeData.createdBy || 'system',
                                storeRoles: [
                                    {
                                        storeName: storeData.storeName || '',
                                        roleIds: ['role_staff'],
                                        isCurrentStore: true,
                                    },
                                ],
                            };
                            await userService.createUser(userData, storeData.orgName || '', tx as any);
                            // TODO Transfer the trunk number to twilio
                        }
                    }
                    return store;
                } catch (error: any) {
                    throw new Error(`Failed to update store: ${error.message}`);
                }
            });
        },

        // Soft delete store
        async deleteStore(storeName: string): Promise<{ message: string }> {
            try {
                await db
                    .update(stores)
                    .set({ isDeleted: true, updatedAt: new Date().toISOString() })
                    .where(eq(stores.storeName, storeName));
                return { message: `Store ${storeName} soft-deleted.` };
            } catch (error: any) {
                throw new Error(`Failed to delete store: ${error.message}`);
            }
        },
    };
};
