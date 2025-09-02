import { FastifyInstance } from 'fastify';
import { eq, InferSelectModel, sql, SQL } from 'drizzle-orm';
import { bookings, slotReservations, slotReservationHistory } from '../db/schema.js';
import { createId } from '@paralleldrive/cuid2';
import { StoreService } from './storeService.js';

type Bookings = InferSelectModel<typeof bookings>;

/** helper: floor date to slot minutes */
function floorToSlot(dt: Date, slotMinutes: number) {
    // const ms = dt.getTime();
    const min = dt.getUTCMinutes();
    const minutes = Math.floor(min / slotMinutes) * slotMinutes;
    const floored = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), dt.getUTCHours(), 0, 0));
    floored.setUTCMinutes(minutes);
    floored.setUTCSeconds(0);
    floored.setUTCMilliseconds(0);
    return floored;
}

/** generate an array of slot starts between start and end aligned to slotMinutes */
function generateSlots(start: Date, end: Date, slotMinutes: number) {
    const slots: Date[] = [];
    let cur = floorToSlot(start, slotMinutes);
    while (cur < end) {
        slots.push(new Date(cur));
        cur = new Date(cur.getTime() + slotMinutes * 60_000);
    }
    return slots;
}

/** Use pg_advisory_xact_lock to lock on an int64 key derived from the slot; we use a hash function
         *  We'll call: SELECT pg_advisory_xact_lock(hashtext($key));
         */
async function runWithSlotLocks(tx: any, keys: string[], fn: () => Promise<any>) {
    const sorted = [...keys].sort();
    for (const k of sorted) {
        await tx.execute(sql`
            SELECT pg_advisory_xact_lock(('x' || substr(md5(${k}), 1, 16))::bit(64)::bigint)
        `);
    }
    return await fn();
}

export function createSqlArrayLiteral(items: string[], postgresType: string): SQL<unknown> {
    const parts: SQL<unknown>[] = [
        sql.raw(`'{`),
        sql.join(
            items.map(item =>
                // Escape quotes for safety
                sql.raw(JSON.stringify(item))
            ),
            sql.raw(',')
        ),
        sql.raw(`}'::${postgresType}`)
    ];
    return sql.join(parts);
}

export const BookingService = (fastify: FastifyInstance) => {
    const db = fastify.db;
    const storeService = StoreService(fastify);

    return {

        async allBookings() {
            return await db.select().from(bookings).execute();
        },
        /**
         * Create booking:
         * - compute slots
         * - in transaction:
         *    - acquire advisory lock(s) for slots
         *    - read/create slot_reservations rows FOR UPDATE
         *    - check capacity limits (stores.dineInCapacity)
         *    - if ok: insert booking + increment reserved_count per slot + history
         */
        // async createBooking({
        //     orgName,
        //     storeName,
        //     customerName,
        //     customerPhoneNumber,
        //     guestsCount,
        //     notes,
        //     startTime,
        //     endTime,
        //     createdBy,
        // }: {
        //     orgName: string,
        //     storeName: string,
        //     customerName: string,
        //     customerPhoneNumber: string,
        //     guestsCount: number,
        //     notes: string,
        //     startTime: string, // ISO
        //     endTime: string, // ISO
        //     createdBy: string,
        // }) {

        async createBooking(bookingData: Bookings) {
            
            const store = await storeService.getStoreByStoreNumber(bookingData.orgName, bookingData.storeName);
            const restaurantCapacity = store.dineInCapacity;
            const slotMinutes = store.slotDurationMinutes;

            if(!slotMinutes) throw new Error('invalid slot duration defined in store.');
            if(!restaurantCapacity) throw new Error('invalid restaurant capacity defined in store.');

            const start = new Date(bookingData.startTime);
            const end = new Date(bookingData.endTime);
            const slotStarts = generateSlots(start, end, slotMinutes);
            if (slotStarts.length === 0) throw new Error('invalid times');

            const now = new Date().toISOString();
            return await db.transaction(async (tx) => {
                const client = (tx as any).client || (tx as any).rawClient;
                // const dbInstance = tx ?? db;

                console.log('creating booking', client);
                // Acquire slot locks (one lock key per slot)
                const lockKeys = slotStarts.map(s => `${bookingData.orgName}:${bookingData.storeName}:${s.toISOString()}`);
                await runWithSlotLocks(tx, lockKeys, async () => {
                    // Select/insert slot_reservations rows for these slotStarts
                    for (const s of slotStarts) {
                        await tx.insert(slotReservations).values({
                            id: createId(),
                            orgName: bookingData.orgName,
                            storeName: bookingData.storeName,
                            slotStart: s.toISOString(),
                            slotMinutes,
                            reservedCount: 0,
                            createdAt: now,
                            updatedAt: now,
                        }).onConflictDoNothing().execute();
                    }

                    // Now read the slot reservations with FOR UPDATE semantics - with Drizzle we can issue a FOR UPDATE raw query
                    // Simpler: use SELECT ... FOR UPDATE via raw SQL
                    const { rows } = await tx.execute(sql
                        `SELECT id, reserved_count, slot_start FROM slot_reservations
                            WHERE org_name=${bookingData.orgName} 
                            AND store_name=${bookingData.storeName} 
                            AND slot_start = ANY(${createSqlArrayLiteral(slotStarts.map(s => s.toISOString()), 'timestamptz[]')})
                            FOR UPDATE`
                        );

                    // Check capacity for each slot
                    for (const row of rows) {
                        const reserved = Number(row.reserved_count);
                        if (reserved + bookingData.guestsCount > restaurantCapacity) {
                            throw { code: 'CAPACITY_EXCEEDED', slotStart: row.slot_start, reserved, capacity: restaurantCapacity };
                        }
                    }

                    // All good: insert booking
                    const id = createId();
                    await tx.insert(bookings).values({
                        id,
                        orgName: bookingData.orgName,
                        storeName: bookingData.storeName,
                        customerName: bookingData.customerName,
                        customerPhoneNumber: bookingData.customerPhoneNumber,
                        guestsCount: bookingData.guestsCount,
                        notes: bookingData.notes,
                        startTime: start.toISOString(),
                        endTime: end.toISOString(),
                        createdBy: bookingData.createdBy,
                        updatedBy: bookingData.createdBy,
                        status: 'booked',
                        createdAt: now,
                        updatedAt: now,
                    }).execute();

                    // increment reserved_count for each slot and write history
                    for (const row of rows) {
                        await tx.update(slotReservations).set({
                            reservedCount: sql`${slotReservations.reservedCount} + ${bookingData.guestsCount}`,
                            updatedAt: sql`CURRENT_TIMESTAMP`
                        }).where(sql`${slotReservations.id} = ${row.id}`).execute();

                        await tx.insert(slotReservationHistory).values({
                            id: createId(),
                            slotReservationId: row.id as string,
                            bookingId: id,
                            delta: bookingData.guestsCount,
                            note: 'create booking',
                            createdAt: now,
                        }).execute();
                    }

                    return { bookingId: id };
                });
            });
        },

        /**
         * Update booking:
         * - load existing booking and compute which slots to decrement (old slots) and which to increment (new slots)
         * - lock union of old+new slots
         * - apply decrements then increments, ensuring capacity is not exceeded
         */
        async updateBooking(bookingId: string, patch: {
            customerName?: string;
            customerPhoneNumber?: string;
            guestsCount?: number;
            notes?: string;
            startTime?: string;
            endTime?: string;
            updatedBy: string;
            restaurantCapacity: number;
            slotMinutes?: number;
        }) {
            const slotMinutes = patch.slotMinutes ?? 30;
            const now = new Date().toISOString();

            return await db.transaction(async (tx) => {
                // Use Drizzle's FOR UPDATE
                const existing = await tx
                    .select({
                        id: bookings.id,
                        orgName: bookings.orgName,
                        storeName: bookings.storeName,
                        customer_name: bookings.customerName,
                        customer_phone_number: bookings.customerPhoneNumber,
                        guests_count: bookings.guestsCount,
                        notes: bookings.notes,
                        start_time: bookings.startTime,
                        end_time: bookings.endTime,
                    })
                    .from(bookings)
                    .where(eq(bookings.id, bookingId))
                    .for('update')
                    .execute(); // or .all() depending on your setup

                if (!existing || existing.length === 0) {
                    throw new Error('booking not found');
                }

                const b = existing[0];
                if (!b) {
                    throw new Error('Booking not found');
                }
                const oldSlots = generateSlots(new Date(b.start_time), new Date(b.end_time), slotMinutes);
                const newStart = patch.startTime ? new Date(patch.startTime) : new Date(b.start_time);
                const newEnd = patch.endTime ? new Date(patch.endTime) : new Date(b.end_time);
                const newSlots = generateSlots(newStart, newEnd, slotMinutes);

                const unionSlots = Array.from(
                    new Set([
                        ...oldSlots.map((s) => s.toISOString()),
                        ...newSlots.map((s) => s.toISOString()),
                    ])
                ).map((s) => new Date(s));

                const lockKeys = unionSlots.map(
                    (s) => `${b.orgName}:${b.storeName}:${s.toISOString()}`
                );

                await runWithSlotLocks((tx as any).client, lockKeys, async () => {
                    // Ensure slotReservations exist
                    for (const slot of unionSlots) {
                        await tx
                            .insert(slotReservations)
                            .values({
                                id: createId(),
                                orgName: b.orgName,
                                storeName: b.storeName,
                                slotStart: slot.toISOString(),
                                slotMinutes,
                                reservedCount: 0,
                                createdAt: now,
                                updatedAt: now,
                            })
                            .onConflictDoNothing()
                            .execute();
                    }

                    // Direct raw SELECT FOR UPDATE for slots
                    const client = (tx as any).client;
                    const { rows } = await client.query(
                        `SELECT id, slot_start, reserved_count FROM slot_reservations
         WHERE org_name = $1
           AND store_name = $2
           AND slot_start = ANY($3::timestamptz[])
         FOR UPDATE`,
                        [b.orgName, b.storeName, unionSlots.map((s) => s.toISOString())]
                    );

                    const map = new Map<string, { id: string; reserved: number }>();
                    for (const r of rows) {
                        map.set(new Date(r.slot_start).toISOString(), {
                            id: r.id,
                            reserved: Number(r.reserved_count),
                        });
                    }

                    const oldGuests = b.guests_count;
                    const newGuests = patch.guestsCount ?? b.guests_count;

                    // Validate capacity
                    for (const slot of unionSlots) {
                        const key = slot.toISOString();
                        const rec = map.get(key);
                        if (!rec) throw new Error('missing slot row');
                        let reserved = rec.reserved;
                        if (oldSlots.some((s) => s.toISOString() === key)) reserved -= oldGuests;
                        if (newSlots.some((s) => s.toISOString() === key)) reserved += newGuests;
                        if (reserved < 0) reserved = 0;
                        if (reserved > patch.restaurantCapacity) {
                            throw { code: 'CAPACITY_EXCEEDED', slotStart: key, reserved, capacity: patch.restaurantCapacity };
                        }
                    }

                    // Apply updates
                    for (const slot of unionSlots) {
                        const key = slot.toISOString();
                        const rec = map.get(key)!;
                        let delta = 0;
                        if (oldSlots.some((s) => s.toISOString() === key)) delta -= oldGuests;
                        if (newSlots.some((s) => s.toISOString() === key)) delta += newGuests;

                        if (delta !== 0) {
                            await tx
                                .update(slotReservations)
                                .set({
                                    reservedCount: sql`${slotReservations.reservedCount} + ${delta}`,
                                    updatedAt: sql`CURRENT_TIMESTAMP`,
                                })
                                .where(eq(slotReservations.id, rec.id))
                                .execute();

                            await tx
                                .insert(slotReservationHistory)
                                .values({
                                    id: createId(),
                                    slotReservationId: rec.id,
                                    bookingId,
                                    delta,
                                    note: 'update booking',
                                    createdAt: now,
                                })
                                .execute();
                        }
                    }

                    // Finally, update booking
                    await tx
                        .update(bookings)
                        .set({
                            customerName: patch.customerName ?? b.customer_name,
                            customerPhoneNumber: patch.customerPhoneNumber ?? b.customer_phone_number,
                            guestsCount: newGuests,
                            startTime: newStart.toISOString(),
                            endTime: newEnd.toISOString(),
                            updatedBy: patch.updatedBy,
                            updatedAt: sql`CURRENT_TIMESTAMP`,
                        })
                        .where(eq(bookings.id, bookingId))
                        .execute();

                    return { bookingId };
                });
            });
        },


        /**
         * Cancel/Delete booking:
         * - lock its slots, subtract reserved_count, delete or mark cancelled
         */
        async cancelBooking(bookingId: string, cancelledBy: string) {
            const now = new Date().toISOString();

            return await db.transaction(async (tx) => {
                // 1. Select booking FOR UPDATE using Drizzle's typed select API
                const existing = await tx
                    .select({
                        id: bookings.id,
                        orgName: bookings.orgName,
                        storeName: bookings.storeName,
                        guestsCount: bookings.guestsCount,
                        startTime: bookings.startTime,
                        endTime: bookings.endTime,
                    })
                    .from(bookings)
                    .where(eq(bookings.id, bookingId))
                    .for('update')
                    .execute();

                // 2. Guard clause to ensure booking exists
                const row = existing[0];
                if (!row) {
                    throw new Error('booking not found');
                }
                const b = row;

                // 3. Compute slot times
                const slots = generateSlots(
                    new Date(b.startTime),
                    new Date(b.endTime),
                    30
                );

                // 4. Run slot‑based locking logic
                const client = (tx as unknown as { client: any }).client ||
                    (tx as unknown as { rawClient: any }).rawClient;
                const lockKeys = slots.map(
                    (s) => `${b.orgName}:${b.storeName}:${s.toISOString()}`
                );

                await runWithSlotLocks(client, lockKeys, async () => {
                    const { rows } = await client.query(
                        `SELECT id, reserved_count, slot_start
         FROM slot_reservations
         WHERE org_name = $1 AND store_name = $2 AND slot_start = ANY($3::timestamptz[])
         FOR UPDATE`,
                        [b.orgName, b.storeName, slots.map((s) => s.toISOString())]
                    );

                    // 5. Update each slot's reservation count and history
                    for (const r of rows) {
                        await tx
                            .update(slotReservations)
                            .set({
                                reservedCount: sql`${slotReservations.reservedCount} - ${b.guestsCount}`,
                                updatedAt: sql`CURRENT_TIMESTAMP`,
                            })
                            .where(eq(slotReservations.id, r.id))
                            .execute();

                        await tx.insert(slotReservationHistory).values({
                            id: createId(),
                            slotReservationId: r.id,
                            bookingId,
                            delta: -b.guestsCount,
                            note: 'cancel booking',
                            createdAt: now,
                        }).execute();
                    }

                    // 6. Mark booking as cancelled
                    await tx
                        .update(bookings)
                        .set({
                            status: 'cancelled',
                            updatedBy: cancelledBy,
                            updatedAt: sql`CURRENT_TIMESTAMP`,
                        })
                        .where(eq(bookings.id, bookingId))
                        .execute();

                    return { bookingId };
                });
            });
        },

        /** Seat booking (mark as seated). We do NOT adjust reserved_count when seating: reserved_count tracks reserved chairs.
         * Optionally we can reduce future overlapping slots if seating consumes additional resources — for now seating is a status change.
         */
        async seatBooking(bookingId: string, updatedBy: string) {
            await db.transaction(async (tx) => {
                await tx.update(bookings).set({
                    status: 'seated',
                    updatedBy,
                    updatedAt: sql`CURRENT_TIMESTAMP`
                }).where(sql`${bookings.id} = ${bookingId}`).execute();
            });
        },

        /** Mark booking completed */
        async completeBooking(bookingId: string, updatedBy: string): Promise<{
            bookings: Bookings[];
        }> {
            console.log(`Completing booking with ID: ${bookingId}`);

            try {
                let updatedBookings: Bookings[] = [];

                await db.transaction(async (tx) => {
                    await tx.update(bookings).set({
                        status: 'completed',
                        updatedBy,
                        updatedAt: sql`CURRENT_TIMESTAMP`
                    }).where(sql`${bookings.id} = ${bookingId}`).execute();

                    // Optionally fetch the updated booking after update
                    const result = await tx
                        .select()
                        .from(bookings)
                        .where(sql`${bookings.id} = ${bookingId}`);

                    if (result.length === 0) {
                        throw new Error('Booking not found after update');
                    }

                    updatedBookings = result;
                });

                return { bookings: updatedBookings };
            } catch (error: any) {
                throw new Error(`Failed to complete booking: ${error.message}`);
            }
        },

    }
};
