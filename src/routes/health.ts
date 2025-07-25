import { FastifyInstance } from 'fastify';

export async function healthRoutes(
  server: FastifyInstance,
  // options: FastifyPluginOptions
) {

  // Health check endpoint
  server.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            environment: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  });

  server.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
            environment: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  });

  // Readiness check endpoint
  server.get('/ready', {
    schema: {
      description: 'Readiness check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            ready: { type: 'boolean' },
          },
        },
      },
    },
  }, async (response: any) => {
    // Add any readiness checks here (database connections, etc.)
    const isReady = true;

    if (!isReady) {
      return response.status(503).send({
        status: 'not ready',
        ready: false,
      });
    }

    return {
      status: 'ready',
      ready: true,
    };
  });
}