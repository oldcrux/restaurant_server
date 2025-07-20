// export const validateRequest = (schema) => {
//     return (req, res, next) => {
//         try {
//             const validatedData = schema.parse(req.body);
//             req.body = validatedData;
//             next();
//         } catch (error) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Validation failed',
//                 errors: error.errors?.map(err => ({
//                     path: err.path.join('.'),
//                     message: err.message
//                 })) || [{ message: error.message }]
//             });
//         }
//     };
// };

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
export const validateBody = (schema: any) => {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.body);
      request.body = validatedData;
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: 'Validation error',
        if(error: any){
          details: error.errors?.map((err: { path: any[]; message: any; }) => ({
            field: err.path.join('.'),
            message: err.message
          })) || [{ message: error.message }]
        }
        }
        );
    }
  };
};

// Validate params middleware factory
export const validateParams = (schema: any) => {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.params);
      request.params = validatedData;
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid parameters',
        if(error: any){
          details: error.errors?.map((err: { path: any[]; message: any; }) => ({
            field: err.path.join('.'),
            message: err.message
          })) || [{ message: error.message }]
        }
      });
    }
  };
};

// Validate query parameters middleware factory
export const validateQueryParams = (schema: any) => {
  return async (request: any, reply: any) => {
    try {
      const validatedData = schema.parse(request.query);
      request.query = validatedData;
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid query parameters',
        if(error: any){
          details: error.errors?.map((err: { path: any[]; message: any; }) => ({
            field: err.path.join('.'),
            message: err.message
          })) || [{ message: error.message }]
        }
      });
    }
  };
};


// module.exports = {
//     validateRequest,
//     errorHandler,
//     validateBody,
//     validateParams,
//     validateQueryParams
// };