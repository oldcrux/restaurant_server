import { FastifyInstance } from 'fastify';
import { validateBody, validateParams, validateQueryParams } from '../middleware/validation.js';
import { createOrganizationSchema, updateOrganizationSchema, orgNameSchema } from '../validations/organizationValidation.js';
import { OrganizationService } from '../services/organizationService.js';
import { verifySession } from "supertokens-node/recipe/session/framework/fastify";
import { SessionRequest } from "supertokens-node/framework/fastify";


export async function organizationRoutes(fastify: FastifyInstance) {
  const organizationService = OrganizationService(fastify); // Inject Fastify instance

  // console.log('OrganizationService initialized', fastify.db);

  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    },
    preHandler: [verifySession()]
  }, async (request: SessionRequest, reply) => {
    const { page = 1, limit = 10, status } = request.query as any;
    const result = await organizationService.getAllOrganizations(+page, +limit, status);
    reply.code(201).send({ success: true, data: result });
  });

  fastify.get('/:orgName', { preHandler: validateParams(orgNameSchema) }, async (request, reply) => {
    const { orgName } = request.params as { orgName: string; };
    const organization = await organizationService.getOrganizationById(orgName);
    reply.code(201).send({ success: true, data: organization });
  });

  fastify.post('/create', { preHandler: validateBody(createOrganizationSchema) }, async (request, reply) => {
    const body = request.body as any;
    
    // console.log('Request user in organizationRoutes.ts', (request as any).user);
    const user = (request as any).user
    if(user.isBot) {
      body.createdBy = user.userId;
      body.updatedBy = user.userId;
    }
    
    console.log('body in organizationRoutes.ts', body);
    const organization = await organizationService.createOrganization(body);
    reply.code(201).send({ success: true, message: 'Organization created successfully', data: organization });
  });

  fastify.post('/activate', { preHandler: validateQueryParams(orgNameSchema) }, async (request, reply) => {
    const { orgName, updatedBy } = request.query as { orgName: string; updatedBy: string; };
    await organizationService.activateOrganization(orgName, updatedBy);
    reply.code(201).send({ success: true, message: 'Organization activated successfully', data: orgName });
  });

  fastify.post('/deactivate', { preHandler: validateQueryParams(orgNameSchema) }, async (request, reply) => {
    const { orgName, updatedBy } = request.query as { orgName: string; updatedBy: string; };
    await organizationService.deactivateOrganization(orgName, updatedBy);
    reply.code(201).send({ success: true, message: 'Organization deactivated successfully', data: orgName });
  });

  fastify.post('/update', { preHandler: validateBody(updateOrganizationSchema) }, async (request, reply) => {
    const body = request.body as any;
    body.updated_by = "system"; // TODO: Replace with value from JWT
    const organization = await organizationService.updateOrganization(request.body);
    reply.code(201).send({ success: true, message: 'Organization updated successfully', data: organization });
  });

  // fastify.delete('/:orgName', { preHandler: validateParams(orgNameSchema) }, async (request, reply) => {
  //    const updatedBy = "system"; // TODO: Replace with value from JWT
  //   await organizationService.deleteOrganization(request.params!.orgName, updatedBy);
  //   return { success: true, message: 'Delete organization not yet implemented' };
  // });
}
