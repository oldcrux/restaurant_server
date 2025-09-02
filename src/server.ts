import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyFormBody from '@fastify/formbody';  // Fastify plugin for parsing form data
import fastifyWs from '@fastify/websocket';

// import fastifySwagger from '@fastify/swagger';
// import fastifySwaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { organizationRoutes } from './routes/organizationRoutes.js';
import { storeRoutes } from './routes/storeRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { menuItemRoutes } from './routes/menuItemRoutes.js';
import { orderRoutes } from './routes/orderRoutes.js';
import dbPlugin from './db/database.js';
import supertokens from "supertokens-node";
import mailerPlugin from './mailer/plugin/nodemailer.js';

import { errorHandler } from "supertokens-node/framework/fastify";
import { supertokensConfig } from './auth/supertokens/supertokensConfig.js';
import { plugin } from "supertokens-node/framework/fastify";
import { verifyBotOrUserSession } from './auth/plugin/auth.js';
import { roleRoutes } from './routes/roleRoutes.js';
import { bookingRoutes } from './routes/bookingRoutes.js';

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

  await server.register(supertokensConfig);

  await server.register(cors, { // TODO understand cors
    origin: config.isDevelopment ? true : config.corsOrigins,
    allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  await server.register(plugin);
  await server.register(errorHandler);

  await server.register(rateLimit, { // TODO understand rate limit
    max: 100,
    timeWindow: '1 minute',
  });

  // Error handler
  server.setErrorHandler(async (error, request, reply) => {
    errorHandler();
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

  await server.register(mailerPlugin);
  // await server.register(mailerService)

  // Register routes
  await server.register(healthRoutes);

  await server.register(async function (secureRoutes) {
    secureRoutes.addHook('preHandler', verifyBotOrUserSession());

    await secureRoutes.register(organizationRoutes, { prefix: 'api/organization' });
    await secureRoutes.register(storeRoutes, { prefix: 'api/store' });
    await secureRoutes.register(userRoutes, { prefix: 'api/user' });
    await secureRoutes.register(roleRoutes, { prefix: 'api/role' });
    await secureRoutes.register(menuItemRoutes, { prefix: 'api/menu-items' });
    await secureRoutes.register(orderRoutes, { prefix: 'api/order' });
    await secureRoutes.register(bookingRoutes, { prefix: 'api/booking' });
  });

  return server;
}