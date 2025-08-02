import { validateBody, validateParams } from '../middleware/validation.js';
import { OrderService } from '../services/orderService.js';
import { createOrderSchema, updateOrderSchema, idSchema, upadateStatusSchema } from '../validations/orderValidation.js';
import { FastifyInstance } from 'fastify';

export async function orderRoutes(fastify: FastifyInstance) {

  const orderService = OrderService(fastify); // Inject Fastify instance properly

  // GET /api/order
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        required: ['orgName', 'storeName'],
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string' }
        }
      }
    },
  }, async (request, reply) => {
    // const { page = 1, limit = 10, status } = request.query as { page?: number; limit?: number; status?: string };
    const { page = 1, limit = 10, orgName, storeName } = request.query as {
      page: number;
      limit: number;
      orgName: string;
      storeName: string;
    };
    const status = '';
    const result = await orderService.getAllOrders(page, limit, status, orgName, storeName);
    reply.code(201).send({ success: true, data: result });
  });
  
  // GET /api/order/:id
  fastify.get('/:id', { preHandler: validateParams(idSchema) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await orderService.getOrderById(id);
    reply.code(201).send({ success: true, data: order });
  });

  // GET /api/order/latestOrder
  fastify.get('/latestOrder', { 
    schema: {
      querystring: {
        type: 'object',
        required: ['customerPhoneNumber', 'orgName', 'storeName'],
        properties: {
          customerPhoneNumber: { type: 'integer', default: 10 },
          orgName: { type: 'string' },
          storeName: { type: 'string' },
          limit: { type: 'integer', default: 1 }
        }
      }
    }
   }, async (request, reply) => {
    const { customerPhoneNumber, orgName, storeName, limit } = request.query as { customerPhoneNumber: string; orgName: string; storeName: string; limit: number };
    const order = await orderService.getLatestOrder(customerPhoneNumber, orgName, storeName, limit);
    reply.code(201).send({ success: true, data: order });
  });

  // POST /api/order/create
  fastify.post('/create', { preHandler: validateBody(createOrderSchema) }, async (request, reply) => {
    console.log('Creating order with body:', request.body);
    const body = request.body as any;
    body.createdBy = body.createdBy?.trim() || "system";  // TODO: Replace with value from JWT
    body.updatedBy = body.updatedBy?.trim() || "system"; // TODO: Replace with value from JWT

    const order = await orderService.createOrder(body);
    reply.code(201).send({ success: true, message: 'Order created successfully', data: order });
  });

  // POST /api/order/update
  fastify.post('/update', { preHandler: validateBody(updateOrderSchema) }, async (request, reply) => {
    const body = request.body as any;
    body.updatedBy = "system"; // TODO: Replace with value from JWT
    const order = await orderService.updateOrder(body); // TODO: Hardcoded orderId — fix in future
    reply.code(201).send({ success: true, message: 'Order updated successfully', data: order });
  });

  // POST /api/order/update/status
  fastify.post('/update/status', { preHandler: validateBody(upadateStatusSchema) }, async (request, reply) => {
    console.log('Updating order status with body:', request.body);
    const { id, status, updatedBy } = request.body as any;
    const order = await orderService.updateOrderStatus(id, status, updatedBy);
    reply.code(201).send({ success: true, message: 'Order updated successfully', data: order });
  });

  // PUT /api/order/:id
  fastify.put('/:id', {
    preHandler: [
      validateParams(idSchema),
      validateBody(updateOrderSchema)
    ]
  }, async (request, reply) => {
    const body = request.body as any;
    const order = await orderService.updateOrder(body);
    reply.code(201).send({ success: true, message: 'Order updated successfully', data: order });
  });

  // DELETE /api/order/:id
  fastify.delete('/:id', { preHandler: validateParams(idSchema) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await orderService.deleteOrder(id);
    reply.code(201).send({ success: true, message: 'Order deleted successfully', data: result });
  });

}
