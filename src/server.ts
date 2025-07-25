import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyFormBody from '@fastify/formbody';  // Fastify plugin for parsing form data
import fastifyWs from '@fastify/websocket';
import { join } from 'path';
import pino from 'pino';

// import fastifySwagger from '@fastify/swagger';
// import fastifySwaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
// import { twillioRoutes } from './voice/routes/twillioRoutes';
import { organizationRoutes } from './routes/organizationRoutes.js';
import { storeRoutes } from './routes/storeRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { menuItemRoutes } from './routes/menuItemRoutes.js';
import { orderRoutes } from './routes/orderRoutes.js';
import dbPlugin from './db/database.js';


export async function createServer() {
  const server = Fastify({
    logger: {
      name: 'restaurant_server',
      level: config.logLevel,
      transport: { // TODO add transport for production
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'hostname',
            },
          },
    },
    disableRequestLogging: !config.isDevelopment,
  });

  // await server.register(fastifySwagger, {
  //   openapi: { info: { title: 'API Docs', version: '1.0.0' } }
  // });
  // await server.register(fastifySwaggerUi, { routePrefix: '/docs' });


  await server.register(dbPlugin);
  server.register(fastifyFormBody);  // Register the form-body parsing plugin
  server.register(fastifyWs);  // Register WebSocket support for real-time communication

  // Security plugins
  await server.register(helmet, {
    contentSecurityPolicy: config.isDevelopment ? false : true, // TODO review this
  });

  await server.register(cors, { // TODO understand cors
    origin: config.isDevelopment ? true : config.corsOrigins,
    credentials: true,
  });

  await server.register(rateLimit, { // TODO understand rate limit
    max: 100,
    timeWindow: '1 minute',
  });

  // Error handler
  server.setErrorHandler(async (error, request, reply) => {
    server.log.error(error);
    void request; // pretending to use request.  Will be removed is actually used
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : error.message;

    await reply.status(statusCode).send({
      error: true,
      message,
      ...(config.isDevelopment && { stack: error.stack }),
    });
  });

  // Not found handler
  server.setNotFoundHandler(async (request, reply) => {
    void request; // pretending to use request.  Will be removed is actually used
    await reply.status(404).send({
      error: true,
      message: 'Route not found',
    });
  });

  // Register routes
  await server.register(healthRoutes);
  // await server.register(userRoutes, { prefix: '/api/v1' });
  // await server.register(twillioRoutes);

  await server.register(organizationRoutes, { prefix: 'api/organization' });
  await server.register(storeRoutes, { prefix: 'api/store' });
  await server.register(userRoutes, { prefix: 'api/user' });
  await server.register(menuItemRoutes, { prefix: 'api/menu-items' });
  await server.register(orderRoutes, { prefix: 'api/order' });

  return server;
}