import { FastifyInstance } from 'fastify';
import { eq, and, count, desc } from 'drizzle-orm';
import { organizations } from '../db/schema.js';
import { createId } from '@paralleldrive/cuid2';
import { UserService } from './userService.js';
import { InferInsertModel } from 'drizzle-orm';
import { users as usersTable } from '../db/schema.js'; // For type

type NewUser = InferInsertModel<typeof usersTable>;

export const OrganizationService = (fastify: FastifyInstance) => {
    const db = fastify.db;
    const userService = UserService(fastify);

    return {
        async createOrganization(organizationData: any) {
            const updatedOrganizationData = {
                ...organizationData,
                isActive: false,
                id: createId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const result = await db.transaction(async (tx) => {
                const [organization] = await tx.insert(organizations)
                    .values(updatedOrganizationData)
                    .returning();

                const userData: Partial<NewUser> = {
                    userId: updatedOrganizationData.emailId,
                    emailId: updatedOrganizationData.emailId,
                    firstName: updatedOrganizationData.firstName,
                    lastName: updatedOrganizationData.lastName,
                    phoneNumber: updatedOrganizationData.phoneNumber,
                    address1: updatedOrganizationData.address1,
                    address2: updatedOrganizationData.address2 || null,
                    city: updatedOrganizationData.city || null,
                    state: updatedOrganizationData.state || null,
                    zip: updatedOrganizationData.zip || null,
                    country: updatedOrganizationData.country || null,
                };

                // Use userService.createUser and pass the transaction object
                await userService.createUser(
                    userData,
                    updatedOrganizationData.orgName,
                    updatedOrganizationData.storeName || '',
                    tx
                );

                return organization;
            });

            return result;
        },

        async activateOrganization(orgName: string, updatedBy: string) {
            const organization = await db.select({ emailId: organizations.emailId })
                .from(organizations)
                .where(eq(organizations.orgName, orgName))
                .limit(1);

            if (organization.length === 0) throw new Error('Organization not found');

            await db.transaction(async (tx) => {
                await tx.update(organizations).set({ isActive: true, updatedBy: updatedBy }).where(eq(organizations.orgName, orgName));
                // await tx.update(stores).set({ isActive: true, updatedBy: updatedBy })
                //     .where(and(eq(stores.orgName, orgName), eq(stores.storeName, '00')));
                // await tx.update(users).set({ isActive: true, updatedBy: updatedBy })
                //     .where(and(eq(users.orgName, orgName), eq(users.storeName, '00'), eq(users.userId, organization[0]?.emailId? organization[0].emailId : '')));
            });
        },

        async deactivateOrganization(orgName: string, updatedBy: string) {
            const organization = await db.select({ emailId: organizations.emailId })
                .from(organizations)
                .where(eq(organizations.orgName, orgName))
                .limit(1);

            if (organization.length === 0) throw new Error('Organization not found');

            await db.transaction(async (tx) => {
                await tx.update(organizations).set({ isActive: false, updatedBy: updatedBy }).where(eq(organizations.orgName, orgName));
                // await tx.update(stores).set({ isActive: false, updatedBy: updatedBy })
                //     .where(and(eq(stores.orgName, orgName), eq(stores.storeName, '00')));
                // await tx.update(users).set({ isActive: false, updatedBy: updatedBy })
                //     .where(and(eq(users.orgName, orgName), eq(users.storeName, '00'), eq(users.userId, organization[0]?.emailId? organization[0].emailId : '')));
            });
        },

        async getAllOrganizations(page = 1, limit = 10, status: boolean | null = null) {
            const skip = (page - 1) * limit;
            const whereConditions = status !== null ? [eq(organizations.isActive, status)] : [];
            const whereClause = whereConditions.length ? and(...whereConditions) : undefined;

            const organizationsList = await db.select()
                .from(organizations)
                .where(whereClause)
                .orderBy(desc(organizations.createdAt))
                .limit(limit)
                .offset(skip);

            const totalResult = await db.select({ count: count() })
                .from(organizations)
                .where(whereClause);

            const total = totalResult[0]?.count ?? 0;

            return {
                organizations: organizationsList,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            };
        },

        async getOrganizationById(organizationId: string) {
            const organization = await db.select()
                .from(organizations)
                .where(eq(organizations.orgName, organizationId))
                .limit(1);

            if (organization.length === 0) throw new Error('Organization not found');
            return organization[0];
        },

        async updateOrganization(updateData: any) {
            const [organization] = await db.update(organizations)
                .set({ ...updateData, updatedAt: new Date() })
                .where(eq(organizations.orgName, updateData.orgName))
                .returning();

            if (!organization) throw new Error('Organization not found');
            return organization;
        },

        // async deleteOrganization(organizationId: string, updatedBy: string) {
        //     await db.transaction(async (tx) => {
        //         throw new Error('Delete organization not yet implemented');
        //     });
        // }
    };
};
