import { FastifyInstance } from 'fastify';
import { MenuItemService } from '../services/menuItemService.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import {
  createMenuItemSchema,
  updateMenuItemSchema,
  idSchema
} from '../validations/menuItemValidation.js';

export async function menuItemRoutes(fastify: FastifyInstance) {
  const menuItemService = MenuItemService(fastify);

  // GET /api/menu-items
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        required: ['orgName', 'storeName'],
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          orgName: { type: 'string' },
          storeName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 10, orgName, storeName } = request.query as {
      page: number;
      limit: number;
      orgName: string;
      storeName: string;
    };

    const result = await menuItemService.getAllMenuItems(page, limit, orgName, storeName);
    reply.code(201).send({ success: true, data: result });
  });


  // GET /api/menu-items/:id
  fastify.get('/:id', { preHandler: validateParams(idSchema) }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await menuItemService.getMenuItemById(id);
    reply.code(201).send({ success: true, data: item });
  });

  // POST /api/menu-items/create
  fastify.post('/create', { preHandler: validateBody(createMenuItemSchema) }, async (request, reply) => {
    const body = request.body as any;

    // console.log(`menuItemRoutes.ts: creating menu item: ${JSON.stringify(body)}`, body);
    const item = await menuItemService.createMenuItem(body);
    reply.code(201).send({ success: true, message: 'Menu item created successfully', data: item });
  });

  // POST /api/menu-items/update
  fastify.post('/update', { preHandler: validateBody(updateMenuItemSchema) }, async (request, reply) => {
    const body = request.body as any;
    // console.log(`updating menu item: ${JSON.stringify(body)}`, body);
    const item = await menuItemService.updateMenuItem(body);
    reply.code(201).send({ success: true, message: 'Menu item updated successfully', data: item });
  });

  // PUT /api/menu-items/:id
  fastify.put('/:id', {
    preHandler: [
      validateParams(idSchema),
      validateBody(updateMenuItemSchema)
    ]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const item = await menuItemService.updateMenuItemById(id, body);
    reply.code(201).send({ success: true, data: item });
  });

  // DELETE /api/menu-items/:menuItemName
  fastify.delete('/:menuItemName', { preHandler: validateParams(idSchema) }, async (request, reply) => {
    const { menuItemName } = request.params as { menuItemName: string };
    const { orgName, storeName } = request.query as { orgName: string; storeName: string };
    const result = await menuItemService.deleteMenuItem(menuItemName, orgName, storeName);
    reply.code(201).send({ success: true, message: 'Menu item deleted successfully', data: result });
  });

  // POST /api/menu-items/delete/:menuItemName
  fastify.post('/delete/:menuItemName', { preHandler: validateParams(idSchema) }, async (request, reply) => {
    const { menuItemName } = request.params as { menuItemName: string };
    const { orgName, storeName } = request.query as { orgName: string; storeName: string };
    const result = await menuItemService.deleteMenuItem(menuItemName, orgName, storeName);
    reply.code(201).send({ success: true, message: 'Menu item deleted successfully', data: result });
  });

}
