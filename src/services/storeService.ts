import { FastifyInstance } from 'fastify';
import { stores } from '../db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

type Store = InferSelectModel<typeof stores>;
type NewStore = InferInsertModel<typeof stores>;

export const StoreService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        // Create a new store
        async createStore(storeData: Partial<NewStore>): Promise<Store> {
            const now = new Date();

            // TODO : phone number should be validated before creating a store.  Phone number is unique across all stores.
            const newStore: NewStore = {
                ...storeData,
                id: createId(),
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                isActive: false,
                isDeleted: false,
            } as NewStore;

            try {
                const [store] = await db.insert(stores).values(newStore).returning();
                return store!;
            } catch (error: any) {
                throw new Error(`Failed to create store: ${error.message}`);
            }
        },

        // Activate a store
        async activateStore(orgName: string, storeName: string): Promise<Store> {
            try {
                const [store] = await db
                    .update(stores)
                    .set({ isActive: true, updatedAt: new Date().toISOString() })
                    .where(and(eq(stores.orgName, orgName), eq(stores.storeName, storeName)))
                    .returning();

                if (!store) throw new Error('Store not found');
                return store;
            } catch (error: any) {
                throw new Error(`Failed to activate store: ${error.message}`);
            }
        },

        // Deactivate a store
        async deactivateStore(orgName: string, storeName: string): Promise<Store> {
            try {
                const [store] = await db
                    .update(stores)
                    .set({ isActive: false, updatedAt: new Date().toISOString() })
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
            status: boolean | null = null
        ): Promise<{
            stores: Store[];
            pagination: { total: number; page: number; limit: number; totalPages: number };
        }> {
            try {
                const skip = (page - 1) * limit;

                const whereConditions = status !== null ? [eq(stores.isActive, status)] : [];
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
        async getStoreByStoreNumber(orgName: string, storeName: string): Promise<Store> {
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
        async updateStore(data: Partial<Store>): Promise<Store> {
            const updateData = {
                ...data,
                updatedAt: new Date().toISOString(),
            };

            // TODO : phone number should be validated.  Phone number is unique across all stores.
            try {
                const [store] = await db
                    .update(stores)
                    .set(updateData)
                    .where(and(eq(stores.storeName, updateData.storeName!), eq(stores.orgName, updateData.orgName!)))
                    .returning();

                if (!store) throw new Error('Store not found');
                return store;
            } catch (error: any) {
                throw new Error(`Failed to update store: ${error.message}`);
            }
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
