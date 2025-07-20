import { z } from 'zod';

export const OrderStatusConstant = Object.freeze({
  CREATED: 'CREATED',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

// export const orderStatusValues = Object.values(OrderStatusConstant);
const orderStatusValues = Object.values(OrderStatusConstant) as [string, ...string[]];

// const orderStatusValues = ['CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export const orderDetailSchema = z.object({
  item: z.string().min(1, 'Item name is required').max(100, 'Item name must be less than 100 characters'),
  quantity: z.number().int('Quantity must be an integer').min(1, 'Quantity must be at least 1'),
  itemPrice: z.number().positive('Item price must be a positive number'),
  specialInstructions: z.string().max(500, 'Special instructions must be less than 500 characters').optional(),
});

export const createOrderSchema = z.object({
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').max(100, 'Customer name must be less than 100 characters'),
  customerPhoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  status: z.enum(orderStatusValues).optional(),
  storeName: z.string().min(2, 'Store number is required'),
  orgName: z.string().min(2, 'Organization name is required'),
  orderDetails: z.array(orderDetailSchema).min(1, 'At least one order detail is required'),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
});

export const updateOrderSchema = z.object({
  orderNumber: z.number().int('Order number must be an integer').positive('Order number must be a positive number'),
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').max(100, 'Customer name must be less than 100 characters').optional(),
  customerPhoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  storeName: z.string().min(2, 'Store number is required'),
  orgName: z.string().min(2, 'Organization name is required'),
  orderDetails: z.array(orderDetailSchema).min(1, 'At least one order detail is required').optional()
});

export const idSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid number').transform((val) => parseInt(val))
});

export const upadateStatusSchema = z.object({
  orderNumber: z.number().int('Order number must be an integer').positive('Order number must be a positive number'),
  status: z.enum(orderStatusValues, { message: 'Invalid order status' }),
  updatedBy: z.string().optional(),
});

export const getOrderSchema = z.object({
  customerPhoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  storeName: z.string().min(2, 'Store number is required'),
  orgName: z.string().min(2, 'Organization name is required'),
  limit: z.number().int('Limit must be an integer').min(1, 'Limit must be at least 1').optional(),
});
