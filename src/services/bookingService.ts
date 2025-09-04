import { FastifyInstance } from 'fastify';
import { DateTime } from "luxon";
import { ne, eq, InferSelectModel, sql, SQL, and, gte, lt, asc } from 'drizzle-orm';
import { bookings, slotReservations, slotReservationHistory } from '../db/schema.js';
import { createId } from '@paralleldrive/cuid2';
import { StoreService } from './storeService.js';

type Bookings = InferSelectModel<typeof bookings>;

// Map Luxon weekday numbers to your JSON keys
const WEEKDAY_MAP: Record<number, keyof StoreHours> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
    7: "sunday",
};

// storeHours type, assuming your DB column is JSON
type StoreHours = {
    [day in
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"]: [string, string] | null;
};

/** helper: floor date to slot minutes */
function floorToSlot(dt: Date, slotMinutes: number) {
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

/** generate day slots in UTC (slotStart as ISO string) for the given store timezone and opening hours */
export function generateDaySlotsForStore(
    date: string,                 // 'YYYY-MM-DD'
    slotMinutes: number,
    storeTimezone = "UTC",
    storeHours = {} as StoreHours
) {
    const dt = DateTime.fromISO(date, { zone: storeTimezone });
    const weekdayKey = WEEKDAY_MAP[dt.weekday];

    if(!weekdayKey){
        return [];
    }
    const hours = storeHours[weekdayKey];
    if (!hours) {
        // Store closed this day
        return [];
    }

    const [openStr, closeStr] = hours; // e.g., ["09:00", "19:00"]
    const openTime = DateTime.fromISO(`${date}T${openStr}`, { zone: storeTimezone });
    const closeTime = DateTime.fromISO(`${date}T${closeStr}`, { zone: storeTimezone });

    console.log('openTime', openTime, 'closeTime', closeTime, 'storeHours', storeHours);
    if (!openTime.isValid || !closeTime.isValid || closeTime <= openTime) {
        return [];
    }
    if (closeTime <= openTime) {
        throw new Error("closeTime must be after openTime");
    }

    const slots: string[] = [];
    let cur = openTime;
    while (cur < closeTime) {
        slots.push(cur.toUTC().toISO({ suppressMilliseconds: true }));
        cur = cur.plus({ minutes: slotMinutes });
    }
    return slots;
}

/** Advisory locks */
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
            items.map(item => sql.raw(JSON.stringify(item))),
            sql.raw(',')
        ),
        sql.raw(`}'::${postgresType}`)
    ];
    return sql.join(parts);
}

export const BookingService = (fastify: FastifyInstance) => {
    const db = fastify.db;
    const storeService = StoreService(fastify);

    /** ensure slot_reservations for the day */
    async function ensureDaySlotsExist(params: {
        orgName: string;
        storeName: string;
        date: string; // YYYY-MM-DD
        slotMinutes: number;
        storeTimezone?: string;
        storeHour?: StoreHours;
        tx?: any;
    }) {
        const {
            orgName,
            storeName,
            date,
            slotMinutes,
            storeTimezone = "UTC",
            storeHour = {},
            tx = null,
        } = params;

        const slotStarts = generateDaySlotsForStore(date, slotMinutes, storeTimezone, storeHour as StoreHours);
        if (slotStarts.length === 0) return;

        const now = new Date().toISOString();
        const rows = slotStarts.map((slotStartIso) => ({
            id: createId(),
            orgName,
            storeName,
            slotStart: slotStartIso,
            slotMinutes,
            reservedCount: 0,
            createdAt: now,
            updatedAt: now,
        }));

        if (tx) {
            await tx.insert(slotReservations).values(rows).onConflictDoNothing().execute();
        } else {
            await db.insert(slotReservations).values(rows).onConflictDoNothing().execute();
        }
    }

    return {

        async allBookings() {
            return await db.select().from(bookings).where(ne(bookings.status, 'cancelled')).execute();
        },

        async createBooking(bookingData: Bookings) {
            const store = await storeService.getStoreByStoreName(bookingData.orgName, bookingData.storeName);
            const restaurantCapacity = store.dineInCapacity;
            const slotMinutes = store.slotDurationMinutes;
            const storeTimezone = store.timezone || "UTC";
            const storeHour = store.storeHour || {};

            if (!slotMinutes) throw new Error('invalid slot duration');
            if (!restaurantCapacity) throw new Error('invalid restaurant capacity');

            const start = new Date(bookingData.startTime);
            const end = new Date(bookingData.endTime);
            const slotStarts = generateSlots(start, end, slotMinutes);
            if (slotStarts.length === 0) throw new Error('invalid times');

            const now = new Date().toISOString();

            const startLocalDate = DateTime.fromJSDate(start).setZone(storeTimezone).startOf('day');
            const endLocalDate = DateTime.fromJSDate(end).setZone(storeTimezone).startOf('day');

            const dates: string[] = [];
            let cur = startLocalDate;
            while (cur <= endLocalDate) {
                dates.push(cur.toISODate() as string);
                cur = cur.plus({ days: 1 });
            }

            return await db.transaction(async (tx) => {
                for (const date of dates) {
                    await ensureDaySlotsExist({
                        orgName: bookingData.orgName,
                        storeName: bookingData.storeName,
                        date,
                        slotMinutes,
                        storeTimezone,
                        storeHour: storeHour as StoreHours,
                        tx
                    });
                }

                const lockKeys = slotStarts.map(s => `${bookingData.orgName}:${bookingData.storeName}:${s.toISOString()}`);
                await runWithSlotLocks(tx, lockKeys, async () => {
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

                    const slotStartIsos = slotStarts.map(s => s.toISOString());
                    const { rows } = await tx.execute(sql
                        `SELECT id, reserved_count, slot_start FROM slot_reservations
                         WHERE org_name=${bookingData.orgName}
                           AND store_name=${bookingData.storeName}
                           AND slot_start = ANY(${createSqlArrayLiteral(slotStartIsos, 'timestamptz[]')})
                         FOR UPDATE`
                    );

                    for (const row of rows) {
                        const reserved = Number(row.reserved_count);
                        if (reserved + bookingData.guestsCount > restaurantCapacity) {
                            throw { code: 'CAPACITY_EXCEEDED', slotStart: row.slot_start, reserved, capacity: restaurantCapacity };
                        }
                    }

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

        async updateBooking(bookingData: Bookings) {
            const bookingId = bookingData.id;
            const store = await storeService.getStoreByStoreName(
                bookingData.orgName,
                bookingData.storeName
            );
            const restaurantCapacity = store.dineInCapacity;
            const slotMinutes = store.slotDurationMinutes ?? 30;

            if (!restaurantCapacity) throw new Error("Restaurant capacity not found");
            const now = new Date().toISOString();

            return await db.transaction(async (tx) => {
                const existing = await tx
                    .select({
                        id: bookings.id,
                        orgName: bookings.orgName,
                        storeName: bookings.storeName,
                        customerName: bookings.customerName,
                        customerPhoneNumber: bookings.customerPhoneNumber,
                        guestsCount: bookings.guestsCount,
                        notes: bookings.notes,
                        startTime: bookings.startTime,
                        endTime: bookings.endTime,
                    })
                    .from(bookings)
                    .where(eq(bookings.id, bookingId))
                    .for("update")
                    .execute();

                const b = existing[0];
                if (!b) throw new Error("Booking not found");

                const oldSlots = generateSlots(new Date(b.startTime), new Date(b.endTime), slotMinutes);
                const newStart = bookingData.startTime ? new Date(bookingData.startTime) : new Date(b.startTime);
                const newEnd = bookingData.endTime ? new Date(bookingData.endTime) : new Date(b.endTime);
                const newSlots = generateSlots(newStart, newEnd, slotMinutes);

                const unionSlots = Array.from(new Set([
                    ...oldSlots.map((s) => s.toISOString()),
                    ...newSlots.map((s) => s.toISOString()),
                ])).map((s) => new Date(s));

                const lockKeys = unionSlots.map((s) => `${b.orgName}:${b.storeName}:${s.toISOString()}`);

                return await runWithSlotLocks(tx, lockKeys, async () => {
                    for (const slot of unionSlots) {
                        await tx.insert(slotReservations).values({
                            id: createId(),
                            orgName: b.orgName,
                            storeName: b.storeName,
                            slotStart: slot.toISOString(),
                            slotMinutes,
                            reservedCount: 0,
                            createdAt: now,
                            updatedAt: now,
                        }).onConflictDoNothing().execute();
                    }

                    const { rows } = await tx.execute(sql`
                        SELECT id, slot_start, reserved_count
                        FROM slot_reservations
                        WHERE org_name=${b.orgName}
                          AND store_name=${b.storeName}
                          AND slot_start = ANY(${createSqlArrayLiteral(unionSlots.map(s => s.toISOString()), 'timestamptz[]')})
                        FOR UPDATE
                    `);

                    const map = new Map<string, { id: string; reserved: number }>();
                    for (const r of rows) {
                        map.set(new Date(r.slot_start as string).toISOString(), {
                            id: r.id as string,
                            reserved: Number(r.reserved_count),
                        });
                    }

                    const oldGuests = b.guestsCount;
                    const newGuests = bookingData.guestsCount ?? b.guestsCount;

                    for (const slot of unionSlots) {
                        const key = slot.toISOString();
                        const rec = map.get(key);
                        if (!rec) throw new Error("Missing slot row");

                        let reserved = rec.reserved;
                        if (oldSlots.some((s) => s.toISOString() === key)) reserved -= oldGuests;
                        if (newSlots.some((s) => s.toISOString() === key)) reserved += newGuests;
                        if (reserved < 0) reserved = 0;
                        if (reserved > restaurantCapacity) {
                            throw { code: "CAPACITY_EXCEEDED", slotStart: key, reserved, capacity: restaurantCapacity };
                        }
                    }

                    for (const slot of unionSlots) {
                        const key = slot.toISOString();
                        const rec = map.get(key)!;
                        let delta = 0;
                        if (oldSlots.some((s) => s.toISOString() === key)) delta -= oldGuests;
                        if (newSlots.some((s) => s.toISOString() === key)) delta += newGuests;

                        if (delta !== 0) {
                            await tx.update(slotReservations).set({
                                reservedCount: sql`${slotReservations.reservedCount} + ${delta}`,
                                updatedAt: sql`CURRENT_TIMESTAMP`,
                            }).where(eq(slotReservations.id, rec.id)).execute();

                            await tx.insert(slotReservationHistory).values({
                                id: createId(),
                                slotReservationId: rec.id,
                                bookingId,
                                delta,
                                note: "update booking",
                                createdAt: now,
                            }).execute();
                        }
                    }

                    await tx.update(bookings).set({
                        customerName: bookingData.customerName ?? b.customerName,
                        customerPhoneNumber: bookingData.customerPhoneNumber ?? b.customerPhoneNumber,
                        guestsCount: newGuests,
                        startTime: newStart.toISOString(),
                        endTime: newEnd.toISOString(),
                        notes: bookingData.notes ?? b.notes,
                        updatedBy: bookingData.updatedBy,
                        updatedAt: sql`CURRENT_TIMESTAMP`,
                    }).where(eq(bookings.id, bookingId)).execute();

                    return { bookingId };
                });
            });
        },

        async getAllAvailability(orgName?: string, storeName?: string, date?: string, partySize?: number) {
            if (!orgName || !storeName || !date) {
                throw new Error("orgName, storeName, and date are required");
            }

            const store = await storeService.getStoreByStoreName(orgName, storeName);
            const restaurantCapacity = store.dineInCapacity;
            const slotMinutes = store.slotDurationMinutes || 30;
            const storeTimezone = store.timezone || "UTC";
            const storeHour = store.storeHour || { };

            if (!restaurantCapacity) throw new Error("Store capacity not found");

            const partyCount = partySize ?? 0;

            await ensureDaySlotsExist({
                orgName,
                storeName,
                date,
                slotMinutes,
                storeTimezone,
                storeHour: storeHour as StoreHours,
                tx: null
            });

            const startLocal = DateTime.fromISO(date, { zone: storeTimezone }).startOf("day");
            const endLocal = startLocal.endOf("day");
            const dayStart = startLocal.toUTC().toISO();
            const dayEnd = endLocal.toUTC().toISO();

            const slots = await db.select().from(slotReservations).where(and(
                eq(slotReservations.orgName, orgName),
                eq(slotReservations.storeName, storeName),
                gte(slotReservations.slotStart, dayStart as any),
                lt(slotReservations.slotStart, dayEnd as any)
            )).orderBy(asc(slotReservations.slotStart));

            const formatted = slots.map((slot) => {
                const availableSeats = restaurantCapacity - slot.reservedCount;
                return {
                    start: slot.slotStart,
                    minutes: slot.slotMinutes,
                    reservedCount: slot.reservedCount,
                    availableSeats,
                    isAvailable: availableSeats >= partyCount,
                };
            });

            const filtered = formatted.filter((slot) => slot.isAvailable);

            return {
                slots: filtered,
                meta: {
                    total: formatted.length,
                    available: filtered.length,
                    partySize: partyCount,
                },
            };
        },

        async cancelBooking(bookingId: string, cancelledBy: string) {
            const now = new Date().toISOString();

            return await db.transaction(async (tx) => {
                // 1. Lock booking row
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
                    .for("update")
                    .execute();

                const b = existing[0];
                if (!b) {
                    throw new Error("booking not found");
                }

                // 2. Load store config (slot duration)
                const store = await storeService.getStoreByStoreName(
                    b.orgName,
                    b.storeName
                );
                const slotMinutes = store.slotDurationMinutes ?? 30;

                // 3. Compute slots for this booking
                const slots = generateSlots(
                    new Date(b.startTime),
                    new Date(b.endTime),
                    slotMinutes
                );

                const lockKeys = slots.map(
                    (s) => `${b.orgName}:${b.storeName}:${s.toISOString()}`
                );

                // 4. Acquire advisory locks just like create/update
                return await runWithSlotLocks(tx, lockKeys, async () => {
                    // Ensure slot rows exist (edge case: cancel on slots never reserved)
                    for (const slot of slots) {
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

                    // 5. Lock the slot rows
                    const { rows } = await tx.execute(sql`
                SELECT id, slot_start, reserved_count
                FROM slot_reservations
                WHERE org_name=${b.orgName}
                  AND store_name=${b.storeName}
                  AND slot_start = ANY(${createSqlArrayLiteral(slots.map(s => s.toISOString()), 'timestamptz[]')})
                FOR UPDATE
            `);

                    // 6. Apply decrements with floor at 0
                    for (const r of rows) {
                        const newReserved = Math.max(
                            0,
                            Number(r.reserved_count) - b.guestsCount
                        );

                        await tx
                            .update(slotReservations)
                            .set({
                                reservedCount: newReserved,
                                updatedAt: sql`CURRENT_TIMESTAMP`,
                            })
                            .where(eq(slotReservations.id, r.id as string))
                            .execute();

                        await tx.insert(slotReservationHistory).values({
                            id: createId(),
                            slotReservationId: r.id as string,
                            bookingId,
                            delta: -b.guestsCount,
                            note: "cancel booking",
                            createdAt: now,
                        }).execute();
                    }

                    // 7. Mark booking as cancelled
                    await tx
                        .update(bookings)
                        .set({
                            status: "cancelled",
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
            console.log(`seating booking ${bookingId} by ${updatedBy}`);
            await db.transaction(async (tx) => {
                await tx.update(bookings).set({
                    status: 'seated',
                    updatedBy: updatedBy,
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
