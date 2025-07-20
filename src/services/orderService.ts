import { formatISO, startOfDay, endOfDay } from 'date-fns';
import { eq, and, count, desc, inArray, gte, lte } from 'drizzle-orm';
import { orders, orderDetails } from '../db/schema.js';
import { OrderStatusConstant } from '../validations/orderValidation.js';
import { FastifyInstance } from 'fastify';
// import { createId } from '@paralleldrive/cuid2';

export const OrderService = (fastify: FastifyInstance) => {
    const db = fastify.db;
    return {
        async createOrder(orderData: any) {
            console.log('Creating order with data:', orderData);
            try {
                // Calculate total cost from order details
                const totalCost = orderData.orderDetails.reduce(
                    (sum: number, detail: any) => sum + (detail.itemPrice * detail.quantity),
                    0
                );

                const result = await db.transaction(async (tx) => {
                    // Create the order
                    const [order] = await tx
                        .insert(orders)
                        .values({
                            ...orderData,
                            // orderNumber: createId(),
                            totalCost: totalCost,
                            status: OrderStatusConstant.CREATED, // Default status
                            createdBy: orderData.createdBy,
                            updatedBy: orderData.updatedBy,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        })
                        .returning();

                    // Create order details
                    const orderDetailsData = orderData.orderDetails.map((detail: any) => ({
                        ...detail,
                        // orderDetailNumber: createId(),
                        orderNumber: order?.orderNumber,
                        createdBy: orderData.createdBy,
                        updatedBy: orderData.updatedBy,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }));

                    const createdOrderDetails = await tx
                        .insert(orderDetails)
                        .values(orderDetailsData)
                        .returning();

                    return {
                        ...order,
                        orderDetails: createdOrderDetails
                    };
                });

                return result;
            } catch (error: any) {
                throw new Error(`Failed to create order: ${error.message}`);
            }
        },

        async getAllOrders(page = 1, limit = 10, status: string | null = null, orgName?: string, storeName?: string) {
            try {
                const skip = (page - 1) * limit;

                // Build where conditions
                const whereConditions = [];
                if (status) {
                    whereConditions.push(eq(orders.status, status as any));
                }
                if (orgName) {
                    whereConditions.push(eq(orders.orgName, orgName));
                }
                if (storeName) {
                    whereConditions.push(eq(orders.storeName, storeName));
                }
                const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

                // Get orders with pagination
                const ordersList = await db
                    .select()
                    .from(orders)
                    .where(whereClause)
                    .orderBy(desc(orders.createdAt))
                    .limit(limit)
                    .offset(skip);

                // Get order details for each order
                const ordersWithDetails = await Promise.all(
                    ordersList.map(async (order) => {
                        const details = await db
                            .select()
                            .from(orderDetails)
                            .where(eq(orderDetails.orderNumber, order.orderNumber));

                        return {
                            ...order,
                            orderDetails: details
                        };
                    })
                );

                // Get total count
                const totalResult = await db
                    .select({ count: count() })
                    .from(orders)
                    .where(whereClause);

                const total = totalResult[0]?.count ?? 0;

                return {
                    orders: ordersWithDetails,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                };
            } catch (error: any) {
                throw new Error(`Failed to fetch orders: ${error.message}`);
            }
        },

        async updateOrder(updateData: any) {
            const orderNumber = updateData.orderNumber;
            try {
                // 1. Load existing order with details
                const existingOrderResult = await db
                    .select()
                    .from(orders)
                    .where(eq(orders.orderNumber, orderNumber))
                    .limit(1);

                if (existingOrderResult.length === 0) {
                    throw new Error('Order not found');
                }

                const existingOrder = existingOrderResult[0];

                if (![OrderStatusConstant.CREATED, OrderStatusConstant.CONFIRMED].includes(existingOrder?.status as any)) {
                    throw new Error('Only orders in CREATED or CONFIRMED status can be updated');
                }

                // Get existing order details
                const existingDetails = await db
                    .select()
                    .from(orderDetails)
                    .where(eq(orderDetails.orderNumber, orderNumber));

                const incomingDetails = updateData.orderDetails || [];

                // 2. Map existing details by item name for quick lookup
                const existingMap = new Map();
                for (const detail of existingDetails) {
                    existingMap.set(detail.item, detail);
                }

                // 3. Calculate new total cost
                const totalCost = incomingDetails.reduce(
                    (sum: number, d: any) => sum + d.quantity * d.item_price,
                    0
                );

                // 4. Transaction for all updates
                const result = await db.transaction(async (tx) => {
                    // Handle order details updates/creates/deletes
                    for (const incoming of incomingDetails) {
                        const match = existingMap.get(incoming.item);
                        if (match) {
                            // Update existing detail
                            await tx
                                .update(orderDetails)
                                .set({
                                    quantity: incoming.quantity,
                                    itemPrice: incoming.item_price,
                                    updatedBy: updateData.updated_by,
                                    updatedAt: new Date().toISOString()
                                })
                                .where(eq(orderDetails.orderDetailNumber, match.orderDetailNumber));

                            existingMap.delete(incoming.item); // Mark as handled
                        } else {
                            // Create new detail
                            await tx
                                .insert(orderDetails)
                                .values({
                                    orderNumber: orderNumber,
                                    item: incoming.item,
                                    quantity: incoming.quantity,
                                    itemPrice: incoming.item_price,
                                    createdBy: updateData.updated_by,
                                    updatedBy: updateData.updated_by,
                                    updatedAt: new Date().toISOString(),
                                });
                        }
                    }

                    // Delete remaining items in existingMap
                    const remainingDetailIds = Array.from(existingMap.values()).map(detail => detail.orderDetailNumber);
                    if (remainingDetailIds.length > 0) {
                        await tx
                            .delete(orderDetails)
                            .where(inArray(orderDetails.orderDetailNumber, remainingDetailIds));
                    }

                    // Update the main order
                    const [updatedOrder] = await tx
                        .update(orders)
                        .set({
                            customerName: updateData.customer_name,
                            customerPhoneNumber: updateData.customer_phone_number,
                            storeName: updateData.store_name,
                            orgName: updateData.org_name,
                            totalCost: totalCost,
                            updatedBy: updateData.updated_by,
                            updatedAt: new Date().toISOString()
                        })
                        .where(eq(orders.orderNumber, orderNumber))
                        .returning();

                    return updatedOrder;
                });

                return result;
            } catch (error: any) {
                throw new Error(`Failed to update order: ${error.message}`);
            }
        },

        async updateOrderStatus(orderNumber: number, status: string, updated_by: string) {
            // Check if order exists and get current status
            const existingOrderResult = await db
                .select()
                .from(orders)
                .where(eq(orders.orderNumber, orderNumber))
                .limit(1);

            if (existingOrderResult.length === 0) {
                throw new Error('Order not found');
            }

            const existingOrder = existingOrderResult[0];

            if (![OrderStatusConstant.CREATED, OrderStatusConstant.CONFIRMED, OrderStatusConstant.PROCESSING, OrderStatusConstant.DELIVERED, OrderStatusConstant.CANCELLED].includes(status as any)) {
                throw new Error(`Invalid order status: ${status}`);
            }
            // Validate status transitions
            if (OrderStatusConstant.CANCELLED == status
                && ![OrderStatusConstant.CREATED, OrderStatusConstant.CONFIRMED].includes(existingOrder?.status as any)) {
                throw new Error('Only orders in CREATED or CONFIRMED status can be cancelled');
            }
            else if ([OrderStatusConstant.CREATED, OrderStatusConstant.CONFIRMED].includes(status as any)
                && [OrderStatusConstant.PROCESSING, OrderStatusConstant.DELIVERED, OrderStatusConstant.CANCELLED].includes(existingOrder?.status as any)) {
                throw new Error(`Current order status is ${existingOrder?.status}, cannot update to ${status}`);
            }

            try {
                const result = await db.transaction(async (tx) => {
                    // Update order status
                    const [updatedOrder] = await tx
                        .update(orders)
                        .set({
                            status: status as any,
                            updatedBy: updated_by,
                            updatedAt: new Date().toISOString()
                        })
                        .where(eq(orders.orderNumber, orderNumber))
                        .returning();

                    // Get order details
                    const details = await tx
                        .select()
                        .from(orderDetails)
                        .where(eq(orderDetails.orderNumber, orderNumber));

                    return {
                        ...updatedOrder,
                        orderDetails: details
                    };
                });

                return result;
            } catch (error: any) {
                throw new Error(`Failed to update order status: ${error.message}`);
            }
        },

        async getOrderById(id: number) {
            try {
                const orderResult = await db
                    .select()
                    .from(orders)
                    .where(eq(orders.orderNumber, id))
                    .limit(1);

                if (orderResult.length === 0) {
                    throw new Error('Order not found');
                }

                const order = orderResult[0];

                // Get order details
                const details = await db
                    .select()
                    .from(orderDetails)
                    .where(eq(orderDetails.orderNumber, id));

                return {
                    ...order,
                    orderDetails: details
                };
            } catch (error: any) {
                throw new Error(`Failed to fetch order: ${error.message}`);
            }
        },

        async deleteOrder(id: number) {
            try {
                const result = await db.transaction(async (tx) => {
                    // First delete order details (due to foreign key constraint)
                    await tx
                        .delete(orderDetails)
                        .where(eq(orderDetails.orderNumber, id));

                    // Then delete the order
                    const deletedOrder = await tx
                        .delete(orders)
                        .where(eq(orders.orderNumber, id))
                        .returning();

                    if (deletedOrder.length === 0) {
                        throw new Error('Order not found');
                    }

                    return { message: 'Order deleted successfully' };
                });

                return result;
            } catch (error: any) {
                throw new Error(`Failed to delete order: ${error.message}`);
            }
        },

        async getOrdersByStatus(status: string, orgName: string, storeName: string) {
            try {
                const ordersList = await db
                    .select()
                    .from(orders)
                    .where(
                        and(
                            eq(orders.status, status as any),
                            eq(orders.orgName, orgName as any),
                            eq(orders.storeName, storeName as any)
                        )
                    )
                    .orderBy(desc(orders.createdAt));

                // Get order details for each order
                const ordersWithDetails = await Promise.all(
                    ordersList.map(async (order) => {
                        const details = await db
                            .select()
                            .from(orderDetails)
                            .where(eq(orderDetails.orderNumber, order.orderNumber));

                        return {
                            ...order,
                            orderDetails: details
                        };
                    })
                );

                return ordersWithDetails;
            } catch (error: any) {
                throw new Error(`Failed to fetch orders by status: ${error.message}`);
            }
        },

        async getModifiableOrder(customerPhoneNumber: string, orgName: string, storeName: string) {
            try {
                const ordersList = await db
                    .select()
                    .from(orders)
                    .where(
                        and(
                            inArray(orders.status, ['CREATED', 'CONFIRMED']),
                            eq(orders.customerPhoneNumber, customerPhoneNumber as any),
                            eq(orders.orgName, orgName as any),
                            eq(orders.storeName, storeName as any)
                        )
                    )
                    .orderBy(desc(orders.createdAt));

                // Get order details for each order
                const ordersWithDetails = await Promise.all(
                    ordersList.map(async (order) => {
                        const details = await db
                            .select()
                            .from(orderDetails)
                            .where(eq(orderDetails.orderNumber, order.orderNumber));

                        return {
                            ...order,
                            orderDetails: details
                        };
                    })
                );

                return ordersWithDetails;
            } catch (error: any) {
                throw new Error(`Failed to fetch orders by status: ${error.message}`);
            }
        },

        // This fuction fetches the latest order for a customer within the current day
        async getLatestOrder(customerPhoneNumber: string, orgName: string, storeName: string, limit: number = 1) {
            const now = new Date();
            const start = formatISO(startOfDay(now)); // "2025-07-16T00:00:00.000Z"
            const end = formatISO(endOfDay(now));  
            void start, end, gte, lte;   // TODO delete this line
            try {
                const ordersList = await db
                    .select()
                    .from(orders)
                    .where(
                        and(
                            eq(orders.customerPhoneNumber, customerPhoneNumber as any),
                            eq(orders.orgName, orgName as any),
                            eq(orders.storeName, storeName as any),
                            // gte(orders.createdAt, start),
                            // lte(orders.createdAt, end)
                        )
                    )
                    .orderBy(desc(orders.createdAt))
                    .limit(limit);

                // Get order details for each order
                const ordersWithDetails = await Promise.all(
                    ordersList.map(async (order) => {
                        const details = await db
                            .select()
                            .from(orderDetails)
                            .where(eq(orderDetails.orderNumber, order.orderNumber));

                        return {
                            ...order,
                            orderDetails: details
                        };
                    })
                );

                return ordersWithDetails;
            } catch (error: any) {
                throw new Error(`Failed to fetch orders by status: ${error.message}`);
            }
        },
    };
};

