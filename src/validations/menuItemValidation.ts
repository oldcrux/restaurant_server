import { z } from 'zod';

export const idSchema = z.object({
    menuItemName: z.string()
});

export const createMenuItemSchema = z.object({
    orgName: z.string(),
    storeName: z.string(),
    itemName: z.string(),
    itemDescription: z.string(),
    itemPrice: z.number().positive(),
    itemComposition: z.string(),
    customizable: z.boolean().optional()
});

export const updateMenuItemSchema = z.object({
    id: z.string(),
    orgName: z.string().optional(),
    storeName: z.string().optional(),
    itemName: z.string().optional(),
    itemDescription: z.string().optional(),
    itemPrice: z.number().positive().optional(),
    itemComposition: z.string().optional(),
    customizable: z.boolean().optional()
});
