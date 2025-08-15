import { z } from 'zod';

// Organization schemas
export const createOrganizationSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters long'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters long'),
  orgName: z.string().min(2, 'Organization name is required'),
  emailId: z.string().email('Invalid email_id'),
  phoneNumber: z.string().regex(/^(\+?[1-9][0-9]{7,14})$/, 'Invalid phone number format'),
  address1: z.string().min(5, 'Address line 1 is required'),
  address2: z.string().optional(),
  city: z.string().min(2, 'City must be at least 2 characters long'),
  state: z.string().min(2, 'State must be at least 2 characters long'),
  zip: z.string().min(5, 'Zip code must be at least 5 characters long'),
  country: z.string().min(1, 'Country is required'),
  createdBy: z.string().min(2, 'Created by is required'),
  updatedBy: z.string().min(2, 'Updated by is required'),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const orgNameSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be a valid string')
});
