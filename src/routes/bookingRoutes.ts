import { validateBody, validateQueryParams } from '../middleware/validation.js';
import { FastifyInstance } from 'fastify';
import { BookingService } from '../services/bookingService.js';
import { availabilityCheckSchema, bookingStatusUpdateSchema, createBookingSchema, updateBookingSchema } from '../validations/bookingValidation.js';

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
  fastify.post('/update', { preHandler: validateBody(updateBookingSchema) }, async (request, reply) => {
    const body = request.body as any;
    console.log('updating booking', body);
    const booking = await bookingService.updateBooking(body);
    reply.code(201).send({ success: true, message: 'booking updated successfully', data: booking });
  });

  // POST /api/booking/seat - Seat Booking
  fastify.post('/seat', { preHandler: validateQueryParams(bookingStatusUpdateSchema) }, async (request, reply) => {
    const { bookingId, updatedBy } = request.query as { bookingId: string, updatedBy: string };
    const result = await bookingService.seatBooking(bookingId, updatedBy);
    reply.code(201).send({ success: true, message: 'booking seated successfully', data: result });
  });

  // POST /api/booking/complete - Complete Booking
  fastify.post('/complete', { preHandler: validateQueryParams(bookingStatusUpdateSchema) }, async (request, reply) => {
    const { bookingId, updatedBy } = request.query as { bookingId: string, updatedBy: string };
    const result = await bookingService.completeBooking(bookingId, updatedBy);
    reply.code(201).send({ success: true, message: 'booking completed successfully', data: result });
  });

  // POST /api/booking/cancel - Cancel Booking
  fastify.post('/cancel', { preHandler: validateQueryParams(bookingStatusUpdateSchema) }, async (request, reply) => {
    const { bookingId, updatedBy } = request.query as { bookingId: string, updatedBy: string };
    const result = await bookingService.cancelBooking(bookingId, updatedBy);
    reply.code(201).send({ success: true, message: 'booking cancelled successfully', data: result });
  });

  // GET /api/booking/availability/all - Get all booking availability. Date in format YYYY-MM-DD, Ex- 2025-09-02
  fastify.get('/availability/all', { preHandler: validateQueryParams(availabilityCheckSchema) }, async (request, reply) => {
    const { orgName, storeName, date, partySize } = request.query as { orgName: string, storeName: string, date: string, partySize: number };
    const result = await bookingService.getAllAvailability(orgName, storeName, date, partySize);
    reply.code(200).send({ success: true, data: result });
  });
}
