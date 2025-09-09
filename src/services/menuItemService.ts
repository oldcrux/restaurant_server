import { eq, and, desc, count, inArray, sql, not } from 'drizzle-orm';
import { menuItems } from '../db/schema.js';
import { FastifyInstance } from 'fastify';
import { createId } from '@paralleldrive/cuid2';

export const MenuItemService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        async createMenuItem(itemData: any) {
            console.log(`menuItemService.ts: creating menu item: ${JSON.stringify(itemData)}`, itemData);
            if (!itemData) {
                throw new Error('Menu item data is required');
            }
            if (!itemData.storeName && (!itemData.selectedStores || itemData.selectedStores.length === 0)) {
                console.log(`menuItemService.ts: creating menu item for all existing and future stores`);
                itemData.storeName = 'All';

                try {
                    const [createdItem] = await db
                        .insert(menuItems)
                        .values({
                            ...itemData,
                            id: createId(),
                            customizable: itemData.customizable ?? false,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        })
                        .returning();

                    return createdItem;
                } catch (error: any) {
                    throw new Error(`Failed to create menu item: ${error.message}`);
                }
            }
            else {
                // If selectedStores exist and length > 0, insert one item per store
                try {
                    const itemsToInsert = itemData.selectedStores.map((storeName: string) => ({
                        ...itemData,
                        storeName,
                        id: createId(),
                        customizable: itemData.customizable ?? false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    }));

                    const createdItems = await db
                        .insert(menuItems)
                        .values(itemsToInsert)
                        .returning();

                    return createdItems;
                } catch (error: any) {
                    throw new Error(`Failed to create menu items: ${error.message}`);
                }
            }

        },

        async getAllMenuItems(page = 1, limit = 10, orgName?: string, storeName?: string) {
            try {
                const skip = (page - 1) * limit;
                const whereConditions = [];

                if (!orgName && !storeName) {
                    throw new Error('Both orgName and storeName must be provided');
                }
                if (orgName) whereConditions.push(eq(menuItems.orgName, orgName));

                if (storeName) {
                    whereConditions.push(inArray(menuItems.storeName, [storeName, 'All']))
                }

                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                const items = await db
                    .select()
                    .from(menuItems)
                    .where(whereClause)
                    .orderBy(desc(menuItems.createdAt))
                    .limit(limit)
                    .offset(skip);

                const totalResult = await db
                    .select({ count: count() })
                    .from(menuItems)
                    .where(whereClause);

                const total = totalResult[0]?.count ?? 0;

                return {
                    items,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                };
            } catch (error: any) {
                throw new Error(`Failed to fetch menu items: ${error.message}`);
            }
        },

        async getMenuItemById(id: string) {
            try {
                const result = await db
                    .select()
                    .from(menuItems)
                    .where(eq(menuItems.id, id))
                    .limit(1);

                if (result.length === 0) {
                    throw new Error('Menu item not found');
                }

                return result[0];
            } catch (error: any) {
                throw new Error(`Failed to get menu item: ${error.message}`);
            }
        },

        async updateMenuItem(updateData: any) {
            console.log(`menuItemService.ts: upserting menu items: ${JSON.stringify(updateData)}`, updateData);

            return await db.transaction(async (tx) => {
                const now = new Date().toISOString();

                const newItems = updateData.selectedStores.map((storeName: string) => ({
                    id: createId(),
                    orgName: updateData.orgName,
                    storeName,
                    itemName: updateData.itemName,
                    itemDescription: updateData.itemDescription,
                    itemPrice: updateData.itemPrice,
                    itemComposition: updateData.itemComposition,
                    customizable: updateData.customizable,
                    createdBy: updateData.createdBy,
                    updatedBy: updateData.updatedBy,
                    createdAt: now,
                    updatedAt: now,
                }));

                // 1. Delete orphaned records
                await tx
                    .delete(menuItems)
                    .where(and(
                        eq(menuItems.orgName, updateData.orgName),
                        eq(menuItems.itemName, updateData.itemName),
                        not(inArray(menuItems.storeName, updateData.selectedStores))
                    ));

                // 2. Upsert current records
                const insertedOrUpdated = await tx
                    .insert(menuItems)
                    .values(newItems)
                    .onConflictDoUpdate({
                        target: [menuItems.orgName, menuItems.storeName, menuItems.itemName],
                        set: {
                            itemDescription: sql`excluded.item_description`,
                            itemPrice: sql`excluded.item_price`,
                            itemComposition: sql`excluded.item_composition`,
                            customizable: sql`excluded.customizable`,
                            updatedBy: sql`excluded.updated_by`,
                            updatedAt: sql`excluded.updated_at`,
                        },
                    })
                    .returning();

                return insertedOrUpdated;
            });
        },

        async updateMenuItemById(id: string, updateData: any) {
            try {
                const [updatedItem] = await db
                    .update(menuItems)
                    .set({
                        ...updateData,
                        updatedAt: new Date().toISOString()
                    })
                    .where(eq(menuItems.id, id))
                    .returning();

                if (!updatedItem) {
                    throw new Error('Menu item not found or update failed');
                }

                return updatedItem;
            } catch (error: any) {
                throw new Error(`Failed to update menu item: ${error.message}`);
            }
        },

        async deleteMenuItem(menuItemName: string, orgName: string, storeName: string) {
            if (!menuItemName || !orgName) {
                throw new Error('menuItemName and orgName are required to delete a menu item');
            }
            try {
                const whereConditions = [];

                whereConditions.push(eq(menuItems.itemName, menuItemName));
                whereConditions.push(eq(menuItems.orgName, orgName));
                if (storeName) {
                    whereConditions.push(eq(menuItems.storeName, storeName));
                }
                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                const [deletedItem] = await db
                    .delete(menuItems)
                    .where(whereClause)
                    .returning();

                if (!deletedItem) {
                    throw new Error('Menu item not found or already deleted');
                }

                return { message: `Menu item ${menuItemName} deleted successfully` };
            } catch (error: any) {
                throw new Error(`Failed to delete menu item: ${error.message}`);
            }
        },
    };
};
