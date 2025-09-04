import { z } from 'zod';

const timeOnlyRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeRangeSchema = z
  .tuple([
    z.string().regex(timeOnlyRegex, 'Time must be in HH:MM 24-hour format (e.g., 09:00)'),
    z.string().regex(timeOnlyRegex, 'Time must be in HH:MM 24-hour format (e.g., 19:00)'),
  ])
  .or(z.null());

// Store schemas
export const createStoreSchema = z.object({
  storeName: z.string().min(2, 'Store number is required'),
  orgName: z.string().min(2, 'Organization name is required'),
  storeHour: z
    .record(
      z.enum([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]),
      timeRangeSchema
    )
    .optional(),
  phoneNumber: z.string().regex(/^(\+?[1-9][0-9]{7,14})$/, 'Invalid phone number format'),
  trunkPhoneNumber: z.string().optional().refine(
    (val) => !val || /^\+?[1-9]\d{1,14}$/.test(val),
    { message: 'Invalid phone number format' }),
  address1: z.string().min(5, 'Address line 1 is required'),
  address2: z.string().optional(),
  city: z.string().min(2, 'City must be at least 2 characters long'),
  state: z.string().min(2, 'State must be at least 2 characters long'),
  zip: z.string().min(5, 'Zip code must be at least 5 characters long'),
  country: z.string().min(1, 'Country is required'),
  isActive: z.boolean().default(false),
  slotDurationMinutes: z.number().min(1, 'Slot duration must be at least 1 minute').optional(),
  dineInCapacity: z.coerce.number({
    required_error: 'dine-in capacity is required',
    invalid_type_error: 'dine-in capacity must be a number',
  }).int('dine-in capacity must be an integer').optional(),
  timezone: z.string().min(2, 'Timezone is required'),
  createdBy: z.string().min(2, 'Created by is required'),
  updatedBy: z.string().min(2, 'Updated by is required'),
});

export const updateStoreSchema = createStoreSchema.partial();

export const storeOrgNameSchema = z.object({
  storeName: z.string().min(2, 'Store name is required'),
  orgName: z.string().min(2, 'Organization name is required'),
  updatedBy: z.string().min(2, 'Updated by is required'),
});

export const storeNameSchema = z.object({
  orgName: z.string().min(2, 'Organization name is required'),
  storeName: z.string().min(2, 'Store name is required'),
});

export const storePhoneNumberSchema = z.object({
  phoneNumber: z.string().regex(/^(\+?[1-9][0-9]{7,14})$/, 'Invalid phone number format'),
});

export const trunkPhoneNumberSchema = z.object({
  trunkPhoneNumber: z.string().regex(/^(\+?[1-9][0-9]{7,14})$/, 'Invalid phone number format'),
});