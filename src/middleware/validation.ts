import { ZodSchema, ZodError } from 'zod';
import { FastifyRequest, FastifyReply } from 'fastify';


export const errorHandler = async (error: any, request: any, reply: any) => {
  request.log.error(error);

  if (error.code === 'P2002') {
    // Prisma unique constraint violation
    return reply.status(409).send({
      success: false,
      message: 'Unique constraint violation',
      error: 'A record with this value already exists',
    });
  }

  if (error.code === 'P2025') {
    // Prisma record not found error
    return reply.status(404).send({
      success: false,
      message: 'Record not found',
      error: 'The requested resource was not found',
    });
  }

  return reply.status(error.statusCode || 500).send({
    success: false,
    message: error.statusCode === 500 ? 'Internal server error' : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};


// Validate body middleware factory
export const validateBody = (schema: ZodSchema<any>) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedBody = schema.parse(request.body);
      request.body = validatedBody;
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return reply.code(400).send({
          success: false,
          message: 'Invalid request body',
          errors: details,
        });
      }

      // Handle unexpected errors
      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  };
};

// Validate request params middleware factory
export const validateRequestParams = (schema: ZodSchema<any>) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedParams = schema.parse(request.params);
      request.params = validatedParams;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid path parameters',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }

      // Fallback for unexpected non-Zod errors
      return reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  };
};


// Validate query parameters middleware factory
export function validateQueryParams(schema: ZodSchema<any>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.query = schema.parse(request.query);
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        reply.code(400).send({
          success: false,
          message: 'Invalid query parameters',
          errors: messages,
        });
        return;
      }

      // Fallback for unexpected errors
      reply.code(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}