import { validateBody, validateParams, validateQueryParams } from '../middleware/validation.js';
import { StoreService } from '../services/storeService.js';
import { storeNameSchema, updateStoreSchema, createStoreSchema, storeOrgNameSchema, trunkPhoneNumberSchema } from '../validations/storeValidation.js';
import { FastifyInstance } from 'fastify';

export async function storeRoutes(fastify: FastifyInstance) {
  const storeService = StoreService(fastify); // Inject Fastify instance

  // GET /api/store - Get all stores with optional pagination and filtering
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        required: ['orgName'],
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' },
          orgName: { type: 'string' },
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 10, status, orgName } = request.query as { page?: number; limit?: number; status?: boolean, orgName: string };
    const result = await storeService.getAllStores(page, limit, orgName, status);
    reply.code(201).send({ success: true, data: result });
  });

  // GET /api/store/:storeName - Get store by storeName
  fastify.get('/:orgName/:storeName', { preHandler: validateParams(storeNameSchema) }, async (request, reply) => {
    const { orgName, storeName } = request.params as { orgName: string, storeName: string };
    const store = await storeService.getStoreByStoreNumber(orgName, storeName);
    reply.code(201).send({ success: true, data: store });
  });

  // GET /api/store/:trunkPhoneNumber - Get store by SIP phone Number
  fastify.get('/:trunkPhoneNumber', { preHandler: validateParams(trunkPhoneNumberSchema) }, async (request, reply) => {
    const { trunkPhoneNumber } = request.params as { trunkPhoneNumber: string };
    const store = await storeService.getStoreByTrunkPhoneNumber(trunkPhoneNumber);
    reply.code(201).send({ success: true, data: store });
  });

  // POST /api/store/create - Create new store
  fastify.post('/create', { preHandler: validateBody(createStoreSchema) }, async (request, reply) => {
    const body = request.body as any;
    body.createdBy = "system"; // TODO: Replace with value from JWT
    body.updatedBy = "system"; // TODO: Replace with value from JWT
    const store = await storeService.createStore(body);
    reply.code(201).send({ success: true, message: 'Store created successfully', data: store });
  });

  // POST /api/store/activate - Activate store
  fastify.post('/activate', { preHandler: validateQueryParams(storeOrgNameSchema) }, async (request, reply) => {
    const { orgName, storeName } = request.query as { orgName: string; storeName: string };
    const store = await storeService.activateStore(orgName, storeName);
    reply.code(201).send({ success: true, message: 'Store activated successfully', data: store });
  });

  // POST /api/store/deactivate - Deactivate store
  fastify.post('/deactivate', { preHandler: validateQueryParams(storeOrgNameSchema) }, async (request, reply) => {
    const { orgName, storeName } = request.query as { orgName: string; storeName: string };
    const store = await storeService.deactivateStore(orgName, storeName);
    reply.code(201).send({ success: true, message: 'Store deactivated successfully', data: store });
  });

  // POST /api/store/update - Update store
  fastify.post('/update', { preHandler: validateBody(updateStoreSchema) }, async (request, reply) => {
    const body = request.body as any;
    const store = await storeService.updateStore(body);
    reply.code(201).send({ success: true, message: 'Store updated successfully', data: store });
  });

  // DELETE /api/store/:storeName - Delete store
  fastify.delete('/:storeName', { preHandler: validateParams(storeNameSchema) }, async (request, reply) => {
    const { storeName } = request.params as { storeName: string };
    const result = await storeService.deleteStore(storeName);
    reply.code(201).send({ success: true, message: 'Store deleted successfully', data: result });
  });
}
