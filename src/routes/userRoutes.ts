import { validateBody, validateParams, validateQueryParams } from '../middleware/validation.js';
import { UserService } from '../services/userService.js';
import { updateUserSchema, userIdSchema, updatePasswordSchema, createUserSchema } from '../validations/userValidation.js';
import { FastifyInstance } from 'fastify';
// import { verifySession } from "supertokens-node/recipe/session/framework/fastify";
// import { FastifyRequest } from "fastify";

export async function userRoutes(fastify: FastifyInstance) {
  const userService = UserService(fastify); // Inject Fastify instance

  // GET /api/user - Get all users with optional pagination and filtering
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        required: ['orgName'],
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    },
    // preHandler: [verifySession()]
  }, async (request, reply) => {
    const { page = 1, limit = 10, status, orgName, storeName } = request.query as { page?: number; limit?: number; status?: boolean, orgName: string, storeName: string };
    const result = await userService.getAllUsers(page, limit, status, orgName, storeName);
    reply.code(201).send({ success: true, data: result });
  });

  // GET /api/user/:userId - Get user by userId
  fastify.get('/:userId', { preHandler: [validateParams(userIdSchema)] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // const { orgName, storeName } = request.query as { orgName: string; storeName: string }; // TODO: will extract from JWT in future
    const user = await userService.getUserById(userId);
    reply.code(201).send({ success: true, data: user });
  });

  // POST /api/user/create - Create new user
  fastify.post('/create', { preHandler: [validateBody(createUserSchema)] }, async (request, reply) => {
    const body = request.body as any;
    const { orgName, storeName } = request.query as { orgName: string; storeName: string };
    body.createdBy = "system"; // TODO: Replace with value from JWT
    body.updatedBy = "system"; // TODO: Replace with value from JWT
    const user = await userService.createUser(body, orgName, storeName);
    reply.code(201).send({ success: true, message: 'User created successfully', data: user });
  });

  // POST /api/user/activate - Activate user
  fastify.post('/activate', { preHandler: [validateQueryParams(userIdSchema)] }, async (request, reply) => {
    const { userId, orgName, storeName } = request.query as { userId: string; orgName: string; storeName: string };
    const user = await userService.activateUser(userId, orgName, storeName);
    reply.code(201).send({ success: true, message: 'User activated successfully', data: user });
  });

  // POST /api/user/deactivate - Deactivate user
  fastify.post('/deactivate', { preHandler: [validateQueryParams(userIdSchema)] }, async (request, reply) => {
    const { userId, orgName, storeName } = request.query as { userId: string; orgName: string; storeName: string };
    const user = await userService.deactivateUser(userId, orgName, storeName);
    reply.code(201).send({ success: true, message: 'User deactivated successfully', data: user });
  });

  // POST /api/user/update - Update user
  fastify.post('/update', { preHandler: [validateBody(updateUserSchema)] }, async (request, reply) => {
    const body = request.body as any;
    const user = await userService.updateUser(body);
    reply.code(201).send({ success: true, message: 'User updated successfully', data: user });
  });

  // POST /api/user/update/password - Update user password
  fastify.post('/update/password', { preHandler: [validateBody(updatePasswordSchema)] }, async (request, reply) => {
    const body = request.body as any;
    const { userId, orgName, storeName, oldPassword, newPassword } = body;
    const user = await userService.updateUserPassword(userId, orgName, storeName, oldPassword, newPassword);
    reply.code(201).send({ success: true, message: 'Password updated successfully', data: user });
  });

  // DELETE /api/user/:userId - Delete user
  fastify.delete('/:userId', { preHandler: [validateParams(userIdSchema)] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { orgName, storeName } = request.query as { orgName: string; storeName: string }; // TODO: will extract from JWT in future
    const result = await userService.deleteUser(userId, orgName, storeName);
    reply.code(201).send({ success: true, message: 'User deleted successfully', data: result });
  });
}
