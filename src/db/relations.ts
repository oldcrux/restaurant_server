import { relations } from "drizzle-orm/relations";
import { orders, orderDetails } from "./schema.js";

export const orderDetailsRelations = relations(orderDetails, ({one}) => ({
	order: one(orders, {
		fields: [orderDetails.orderNumber],
		references: [orders.orderNumber]
	}),
}));

export const ordersRelations = relations(orders, ({many}) => ({
	orderDetails: many(orderDetails),
}));