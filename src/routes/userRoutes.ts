import { SessionRequest } from 'supertokens-node/framework/fastify';
import { validateBody, validateRequestParams, validateQueryParams } from '../middleware/validation.js';
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
    reply.code(200).send({ success: true, data: result });
  });

  // GET /api/user/:userId - Get user by userId
  fastify.get('/:userId', { preHandler: [validateRequestParams(userIdSchema)] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // const { orgName, storeName } = request.query as { orgName: string; storeName: string }; // TODO: will extract from JWT in future
    const user = await userService.getUserById(userId);
    reply.code(200).send({ success: true, data: user });
  });

  // GET /api/user/session/:userId - Get user by userId
  fastify.get('/session/:userId', { preHandler: [validateRequestParams(userIdSchema)] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // const { orgName, storeName } = request.query as { orgName: string; storeName: string }; // TODO: will extract from JWT in future
    const user = await userService.getUserByIdForSession(userId);
    reply.code(200).send({ success: true, data: user });
  });

  // POST /api/user/create - Create new user
  fastify.post('/create', { preHandler: [validateBody(createUserSchema)] }, async (request, reply) => {
    const body = request.body as any;
    const { orgName } = request.query as { orgName: string; };
    console.log('Creating user with body:', body, 'orgName:', orgName);
    const user = await userService.createUser(body, orgName);
    reply.code(201).send({ success: true, message: 'User created successfully', data: user });
  });

  // POST /api/user/activate - Activate user
  fastify.post('/activate', { preHandler: [validateQueryParams(userIdSchema)] }, async (request, reply) => {
    const { userId, orgName, storeName, updatedBy } = request.query as { userId: string; orgName: string; storeName: string, updatedBy: string };
    const user = await userService.activateUser(userId, orgName, storeName, updatedBy);
    reply.code(200).send({ success: true, message: 'User activated successfully', data: user });
  });

  // POST /api/user/deactivate - Deactivate user
  fastify.post('/deactivate', { preHandler: [validateQueryParams(userIdSchema)] }, async (request, reply) => {
    const { userId, orgName, storeName, updatedBy } = request.query as { userId: string; orgName: string; storeName: string, updatedBy: string };
    console.log('deactivating user', userId);
    const user = await userService.deactivateUser(userId, orgName, storeName, updatedBy);
    reply.code(200).send({ success: true, message: 'User deactivated successfully', data: user });
  });

  // POST /api/user/update - Update user
  fastify.post('/update', { preHandler: [validateBody(updateUserSchema)] }, async (request, reply) => {
    const body = request.body as any;
    const { orgName } = request.query as { orgName: string };
    const user = await userService.updateUser(body, orgName);
    reply.code(200).send({ success: true, message: 'User updated successfully', data: user });
  });

  // POST /api/user/update/password - Update user password
  fastify.post('/update/password', { preHandler: [validateBody(updatePasswordSchema)] }, async (request, reply) => {
    const body = request.body as any;
    const { userId, orgName, storeName, oldPassword, newPassword } = body;
    const user = await userService.updateUserPassword(userId, orgName, storeName, oldPassword, newPassword);
    reply.code(200).send({ success: true, message: 'Password updated successfully', data: user });
  });

  // DELETE /api/user/:userId - Delete user
  fastify.delete('/:userId', { preHandler: [validateRequestParams(userIdSchema)] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { orgName, storeName } = request.query as { orgName: string; storeName: string }; // TODO: will extract from JWT in future
    const result = await userService.deleteUser(userId, orgName, storeName);
    reply.code(200).send({ success: true, message: 'User deleted successfully', data: result });
  });

  // Update access token payload to update the current store of the user and in the database
  // POST /api/user/currentstore/update
  fastify.post("/currentstore/update", async (req: SessionRequest, reply) => {
    let session = req.session;
    const payload = session?.getAccessTokenPayload().user;
    const updatedUser = {
      ...payload,
      currentStore: req.body.storeName
    };
    await session!.mergeIntoAccessTokenPayload({ user: updatedUser });
    await userService.setUserCurrentStore(req.body.userId, req.body.orgName, req.body.storeName);
    reply.code(200).send({ success: true, message: 'Successfully updated user current store' });
  });
}
