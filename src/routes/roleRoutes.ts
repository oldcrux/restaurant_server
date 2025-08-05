
import { RoleService } from '../services/roleService.js';
import { FastifyInstance } from 'fastify';
// import { verifySession } from "supertokens-node/recipe/session/framework/fastify";
// import { FastifyRequest } from "fastify";

export async function roleRoutes(fastify: FastifyInstance) {
  const roleService = RoleService(fastify); // Inject Fastify instance

  // GET /api/role - Get all roles with optional pagination and filtering
  fastify.get('/', {
    schema: {
      querystring: {
        // type: 'object',
        // required: ['orgName'],
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    },
    // preHandler: [verifySession()]
  }, async (_request, reply) => {
    const result = await roleService.getAllRoles();
    reply.code(201).send({ success: true, data: result });
  });

}
