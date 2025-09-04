import { pgTable, foreignKey, integer, text, doublePrecision, timestamp, uniqueIndex, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const orderStatus = pgEnum("OrderStatus", ['CREATED', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
export const orderDetailStatus = pgEnum("OrderDetailStatus", ['CREATED', 'PROCESSING', 'READY', 'DELIVERED', 'CANCELLED'])


export const orderDetails = pgTable("order_details", {
	id: text().primaryKey().notNull(),
	orderId: text("order_id").notNull(),
	status: orderDetailStatus().default('CREATED').notNull(),
	item: text().notNull(),
	itemPrice: doublePrecision("item_price").notNull(),
	quantity: integer().notNull(),
	notes: text("notes"),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.orderId],
		foreignColumns: [orders.id],
		name: "order_details_order_number_fkey"
	}).onUpdate("cascade").onDelete("cascade"),
]);

export const orders = pgTable("orders", {
	id: text().primaryKey().notNull(),
	customerName: text("customer_name").notNull(),
	customerPhoneNumber: text("customer_phone_number").notNull(),
	totalCost: doublePrecision("total_cost").notNull(),
	totalDiscount: doublePrecision("total_discount").default(0).notNull(),
	status: orderStatus().default('CREATED').notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	orgName: text("org_name").notNull(),
	storeName: text("store_name").notNull(),
	orderNumber: integer("order_number").notNull(),
	notes: text("notes"),
});

export const orderCounters = pgTable("order_counters", {
	orgName: text("org_name").notNull(),
	storeName: text("store_name").notNull(),
	orderNumber: integer("order_number").notNull(),
	orderDate: timestamp("order_date", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
});

export const organizations = pgTable("organizations", {
	id: text().primaryKey().notNull(),
	orgName: text("org_name").notNull(),
	timezone: text("timezone").notNull().default('UTC'),
	isActive: boolean("is_active").default(false).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
	phoneNumber: text("phone_number").notNull(),
	emailId: text("email_id").notNull(),
	address1: text("address_1").notNull(),
	address2: text("address_2"),
	city: text().notNull(),
	state: text().notNull(),
	zip: text().notNull(),
	country: text().notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("organizations_email_id_key").using("btree", table.emailId.asc().nullsLast().op("text_ops")),
	uniqueIndex("organizations_org_name_key").using("btree", table.orgName.asc().nullsLast().op("text_ops")),
]);


// ALTER TABLE stores
// ALTER COLUMN store_hour
// SET DATA TYPE jsonb
// USING store_hour::jsonb;

export const stores = pgTable("stores", {
	id: text().primaryKey().notNull(),
	orgName: text("org_name").notNull(),
	storeName: text("store_name").notNull(),
	timezone: text("timezone").notNull().default('UTC'),
	storeHour: jsonb("store_hour"),
	dineInCapacity: integer('dinein_capacity'),
	slotDurationMinutes: integer('slot_duration_minutes'),
	isActive: boolean("is_active").default(true).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
	phoneNumber: text("phone_number").notNull(),
	trunkPhoneNumber: text("trunk_phone_number"),
	address1: text("address_1").notNull(),
	address2: text("address_2"),
	city: text().notNull(),
	state: text().notNull(),
	zip: text().notNull(),
	country: text().notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("stores_org_name_store_name_key").using("btree", table.orgName.asc().nullsLast().op("text_ops"), table.storeName.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	emailId: text("email_id").notNull(),
	userId: text("user_id").notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	phoneNumber: text("phone_number"),
	// role: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
	address1: text("address_1").notNull(),
	address2: text("address_2"),
	city: text().notNull(),
	state: text().notNull(),
	zip: text().notNull(),
	country: text().notNull(),
	// authType: text("auth_type").notNull(),
	userType: text("user_type").notNull().default('human'), // human, bot
	password: text(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
	// orgName: text("org_name").notNull(),
	// storeName: text("store_name").notNull(),
}, (table) => [
	// uniqueIndex("users_email_id_key").using("btree", table.emailId.asc().nullsLast().op("text_ops")),
	uniqueIndex("users_user_id_org_name_store_name_key").using("btree", table.userId.asc().nullsLast().op("text_ops"),
		// table.orgName.asc().nullsLast().op("text_ops"), table.storeName.asc().nullsLast().op("text_ops")
	),
]);

export const storeUsers = pgTable('store_users', {
	id: text().primaryKey().notNull(),
	orgName: text("org_name").notNull(),
	storeName: text("store_name"),
	userId: text("user_id").notNull(),
	isCurrentStore: boolean("is_current_store").default(false).notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
});

export const menuItems = pgTable("menu_items", {
	id: text().primaryKey().notNull(),
	orgName: text("org_name").notNull(),
	storeName: text("store_name").notNull(),
	itemName: text("item_name").notNull(),
	itemDescription: text("item_description").notNull(),
	itemPrice: doublePrecision("item_price").notNull(),
	itemComposition: text("item_composition").notNull(),
	customizable: boolean("customizable").default(false).notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("menu_items_org_name_store_name_item_name_key").using("btree", table.orgName.asc().nullsLast().op("text_ops"), table.storeName.asc().nullsLast().op("text_ops"), table.itemName.asc().nullsLast().op("text_ops")),
]);

export const permissions = pgTable('permissions', {
	permissionId: text("permission_id").primaryKey().notNull(),
	permissionName: text("permission_name").notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
});

export const roles = pgTable('roles', {
	roleId: text("role_id").primaryKey().notNull(),
	roleName: text("role_name").notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
	roleId: text("role_id").notNull(),
	permissionId: text("permission_id").notNull(),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
});

export const userRoles = pgTable('user_roles', {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	roleId: text("role_id").notNull(),
	orgName: text("org_name").notNull(),
	storeName: text("store_name"),
	createdBy: text("created_by").notNull(),
	updatedBy: text("updated_by").notNull(),
	createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
});

export const bookings = pgTable('bookings', {
  id: text().primaryKey().notNull(),
  orgName: text("org_name").notNull(),
  storeName: text("store_name").notNull(),
  customerName: text('customer_name').notNull(),
  customerPhoneNumber: text('customer_phone_number').notNull(),
  guestsCount: integer('guests_count').notNull(),
  startTime: timestamp('start_time', { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
  status: text('status').default('booked').notNull(),
  noShowAt: timestamp('no_show_at', { precision: 3, withTimezone: true, mode: 'string' })
});

export const slotReservations = pgTable('slot_reservations', {
  id: text().primaryKey().notNull(),
  orgName: text('org_name').notNull(),
  storeName: text('store_name').notNull(),
  slotStart: timestamp('slot_start', { precision: 3, withTimezone: true, mode: 'string' }).notNull(),
  slotMinutes: integer('slot_minutes').default(30).notNull(),
  reservedCount: integer('reserved_count').default(0).notNull(),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at', { precision: 3, withTimezone: true, mode: 'string' }).notNull()
}, (table) => [
  uniqueIndex('slot_unique_idx').on(table.orgName, table.storeName, table.slotStart, table.slotMinutes)
]);

export const slotReservationHistory = pgTable('slot_reservation_history', {
  id: text().primaryKey().notNull(),
  slotReservationId: text('slot_reservation_id'),
  bookingId: text('booking_id'),
  delta: integer('delta').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { precision: 3, withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull()
});

// export const prismaMigrations = pgTable("_prisma_migrations", {
// 	id: varchar({ length: 36 }).primaryKey().notNull(),
// 	checksum: varchar({ length: 64 }).notNull(),
// 	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
// 	migrationName: varchar("migration_name", { length: 255 }).notNull(),
// 	logs: text(),
// 	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
// 	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
// 	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
// });
