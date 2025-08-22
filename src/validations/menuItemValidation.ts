import { z } from 'zod';

export const idSchema = z.object({
    menuItemName: z.string()
});

export const createMenuItemSchema = z.object({
    orgName: z.string(),
    storeName: z.string().optional(),
    selectedStores: z.array(z.string()).optional(),
    itemName: z.string(),
    itemDescription: z.string(),
    itemPrice: z.number().positive(),
    itemComposition: z.string(),
    customizable: z.boolean().optional(),
    createdBy: z.string().min(2, 'Created by is required'),
    updatedBy: z.string().min(2, 'Updated by is required'),
});

export const updateMenuItemSchema = z.object({
    // id: z.string(),
    orgName: z.string().optional(),
    storeName: z.string().optional(),
    selectedStores: z.array(z.string()).optional(),
    itemName: z.string().optional(),
    itemDescription: z.string().optional(),
    itemPrice: z.number().positive().optional(),
    itemComposition: z.string().optional(),
    customizable: z.boolean().optional(),
    createdBy: z.string().min(2, 'Created by is required'),
    updatedBy: z.string().min(2, 'Updated by is required'),
});
