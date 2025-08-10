import { FastifyInstance } from 'fastify';
import { roles } from '../db/schema.js';
import { InferSelectModel, eq, not } from 'drizzle-orm';

type Role = InferSelectModel<typeof roles>;

export const RoleService = (fastify: FastifyInstance) => {
    const db = fastify.db;

    return {
        // Get all users with optional status
        async getAllRoles(): Promise<{
            roles: Role[];
        }> {
            console.log('Fetching all roles from the database');
            try {
                const result = await db.select().from(roles).where(not(eq(roles.roleId, 'role_system')));
                if (result.length === 0) {
                    throw new Error('No roles found');
                }
                return {roles:result};
            } catch (error: any) {
                throw new Error(`Failed to fetch roles: ${error.message}`);
            }
        },

    }
};
