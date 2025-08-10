import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { menuItems } from '../db/schema.js';
import { FastifyInstance } from 'fastify';
import { createId } from '@paralleldrive/cuid2';

export const MenuItemService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        async createMenuItem(itemData: any) {
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
        },

        async getAllMenuItems(page = 1, limit = 10, orgName?: string, storeName?: string) {
            try {
                const skip = (page - 1) * limit;
                const whereConditions = [];

                if (!orgName && !storeName) {
                    throw new Error('Both orgName and storeName must be provided');
                }
                if (orgName) whereConditions.push(eq(menuItems.orgName, orgName));

                if (storeName && storeName !== 'All') {
                    whereConditions.push(eq(menuItems.storeName, storeName))
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
            try {
                const [updatedItem] = await db
                    .update(menuItems)
                    .set({
                        ...updateData,
                        updatedAt: new Date().toISOString()
                    })
                    .where(eq(menuItems.id, updateData.id))
                    .returning();

                if (!updatedItem) {
                    throw new Error('Menu item not found or update failed');
                }

                return updatedItem;
            } catch (error: any) {
                throw new Error(`Failed to update menu item: ${error.message}`);
            }
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
