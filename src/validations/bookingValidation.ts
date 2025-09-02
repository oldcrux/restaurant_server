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