import { FastifyInstance } from 'fastify';
import { roles } from '../db/schema.js';
import { InferSelectModel } from 'drizzle-orm';

type Role = InferSelectModel<typeof roles>;

export const RoleService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        // Get all users with optional status
        async getAllRoles(): Promise<{
            roles: Role[];
        }> {
            try {
                const result = await db.select().from(roles);
                if (result.length === 0) {
                    throw new Error('Menu item not found');
                }
                return {roles:result};
            } catch (error: any) {
                throw new Error(`Failed to fetch users: ${error.message}`);
            }
        },

    }
};
