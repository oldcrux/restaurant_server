import { FastifyInstance } from 'fastify';
import { orderCounters } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { DateTime } from 'luxon';

export const OrderCounterService = (fastify: FastifyInstance) => {
  const db = fastify.db;

  return {
    /**
     * Get or increment today's order counter for a given store (based on local day).
     */
    async getOrderCounter(
      orgName: string,
      storeName: string,
      storeTimezone: string
    ) {
      try {
        // Get local start-of-day for store, then convert it to UTC
        const nowUtc = DateTime.utc();
        const localStartOfDay = nowUtc.setZone(storeTimezone).startOf('day');
        const orderDateUtc = localStartOfDay.toUTC().toISO(); // ISO string in UTC

        // Query today's counter (based on local midnight in UTC)
        const existing = await db
          .select()
          .from(orderCounters)
          .where(
            and(
              eq(orderCounters.orgName, orgName),
              eq(orderCounters.storeName, storeName),
              eq(orderCounters.orderDate, orderDateUtc?? '')
            )
          )
          .limit(1);

        if (existing.length === 0) {
          const [newCounter] = await this.createOrderCounter(orgName, storeName, orderDateUtc?? '');
          // fastify.log.info({ newCounter }, 'New order counter created');
          return newCounter;
        } else {
          const current = existing[0];
          const [updatedCounter] = await this.updateOrderCounter(orgName, storeName, orderDateUtc?? '', current?.orderNumber as any);
          // fastify.log.info({ updatedCounter }, 'Order counter updated');
          return updatedCounter;
        }
      } catch (error: any) {
        throw new Error(`Failed to fetch or update order counter: ${error.message}`);
      }
    },

    async createOrderCounter(
      orgName: string,
      storeName: string,
      orderDateUtc: string
    ) {
      try {
        return await db.insert(orderCounters).values({
          orgName,
          storeName,
          orderNumber: 1,
          orderDate: orderDateUtc,
        }).returning();
      } catch (error: any) {
        throw new Error(`Failed to create order counter: ${error.message}`);
      }
    },

    async updateOrderCounter(
      orgName: string,
      storeName: string,
      orderDateUtc: string,
      currentOrderNumber: number
    ) {
      try {
        return await db
          .update(orderCounters)
          .set({
            orderNumber: currentOrderNumber + 1,
          })
          .where(
            and(
              eq(orderCounters.orgName, orgName),
              eq(orderCounters.storeName, storeName),
              eq(orderCounters.orderDate, orderDateUtc)
            )
          )
          .returning();
      } catch (error: any) {
        throw new Error(`Failed to update order counter: ${error.message}`);
      }
    }
  };
};
