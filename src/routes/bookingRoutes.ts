import { validateBody, validateParams, validateQueryParams } from '../middleware/validation.js';
import { FastifyInstance } from 'fastify';
import { BookingService } from '../services/bookingService.js';
import { createBookingSchema } from '../validations/bookingValidation.js';

export async function bookingRoutes(fastify: FastifyInstance) {
  const bookingService = BookingService(fastify); // Inject Fastify instance

  // GET /api/booking - Get all bookings with optional pagination and filtering
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
    console.log(`fetching all bookings`);
    const result = await bookingService.allBookings();
    reply.code(201).send({ success: true, data: result });
  });


  // POST /api/booking/create - Create new booking
  fastify.post('/create', { preHandler: validateBody(createBookingSchema) }, async (request, reply) => {
    const body = request.body as any;
    body.updatedBy = body.createdBy;
    const booking = await bookingService.createBooking(body);
    reply.code(201).send({ success: true, message: 'booking created successfully', data: booking });
  });

  // POST /api/booking/update - Update booking
//   fastify.post('/update', { preHandler: validateBody(updatebookingSchema) }, async (request, reply) => {
//     const body = request.body as any;
//     const booking = await bookingService.updatebooking(body);
//     reply.code(201).send({ success: true, message: 'booking updated successfully', data: booking });
//   });

//   // DELETE /api/booking/:bookingName - Cancel Booking
//   fastify.delete('/:bookingName', { preHandler: validateParams(bookingNameSchema) }, async (request, reply) => {
//     const { bookingName } = request.params as { bookingName: string };
//     const result = await bookingService.deletebooking(bookingName);
//     reply.code(201).send({ success: true, message: 'booking deleted successfully', data: result });
//   });
}
