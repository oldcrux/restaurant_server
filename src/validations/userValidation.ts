import { z } from 'zod';

// User schemas
export const createUserSchema = z.object({
    userId: z.string().min(5, 'User ID is required'),
    emailId: z.string().email('Invalid email_id'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    role: z.enum(['ADMIN', 'SYSTEM', 'USER']).optional(),
    isActive: z.boolean().optional(),
    address1: z.string().min(5, 'Address line 1 is required'),
    address2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    // orgName: z.string().min(1, 'Organization ID is required'),
    // storeName: z.string().min(1, 'Store number is required'),
});

export const updateUserSchema = createUserSchema.partial();

export const updatePasswordSchema = z.object({
    user_id: z.string().min(5, 'User ID is required'),
    oldPassword: z.string().min(8, 'Password must be at least 8 characters long'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
    // orgName: z.string().min(1, 'Organization ID is required'),
    // storeName: z.string().min(1, 'Store number is required'),
});

export const userIdSchema = z.object({
  userId: z.string().min(5, 'user Id must be a valid string'),
  // storeName: z.string().min(2, 'Store number is required'),
  // orgName: z.string().min(2, 'Organization name is required'),
});
