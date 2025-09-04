import { z } from 'zod';

export const createBookingSchema = z.object({
  orgName: z.string().min(2).max(100),
  storeName: z.string().min(2).max(100),
  customerName: z.string().min(2).max(100),
  customerPhoneNumber: z.string().min(10).max(15),
  guestsCount: z.number().min(1).max(100),
  notes: z.string().max(500).optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start time',
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end time',
  }),
  createdBy: z.string().min(2).max(100),
});

export const updateBookingSchema = z.object({
  id: z.string(),
  orgName: z.string().min(2).max(100),
  storeName: z.string().min(2).max(100),
  customerName: z.string().min(2).max(100),
  customerPhoneNumber: z.string().min(10).max(15),
  guestsCount: z.number().min(1).max(100),
  notes: z.string().max(500).optional(),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start time',
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end time',
  }),
  updatedBy: z.string().min(2).max(100),
});

export const bookingStatusUpdateSchema = z.object({
  bookingId: z.string(),
  updatedBy: z.string().min(2).max(100),
});

export const availabilityCheckSchema = z.object({
  orgName: z.string({
    required_error: 'orgName is required',
    invalid_type_error: 'orgName must be a string',
  }).min(2, 'orgName must be at least 2 characters'),
  storeName: z.string({
    required_error: 'storeName is required',
    invalid_type_error: 'storeName must be a string',
  }).min(2, 'storeName must be at least 2 characters'),
  date: z.string({
    required_error: 'date is required',
  }).refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  partySize: z.coerce.number({
    required_error: 'partySize is required',
    invalid_type_error: 'partySize must be a number',
  }).int('partySize must be an integer').positive('partySize must be a positive number').optional(),
});
