
import { permissions, roles, rolePermissions } from "./schema.js";
import dotenv from 'dotenv';
dotenv.config();
import { createServer } from "../server.js";

// Admin user ID who will be the creator/updater
const ADMIN_USER_ID = 'system-admin';

// Permissions data
export const seedPermissions = [
  { permissionId: 'perm_all', permissionName: 'all' },
  { permissionId: 'store_create', permissionName: 'store_create' },
  { permissionId: 'store_read', permissionName: 'store_read' },
  { permissionId: 'store_write', permissionName: 'store_write' },
  { permissionId: 'order_read', permissionName: 'order_read' },
  { permissionId: 'order_write', permissionName: 'order_write' },
  { permissionId: 'menu_create', permissionName: 'menu_create' },
  { permissionId: 'menu_read', permissionName: 'menu_read' },
  { permissionId: 'user_read', permissionName: 'user_read' },
  { permissionId: 'user_write', permissionName: 'user_write' },
  { permissionId: 'appointment_read', permissionName: 'appointment_read' },
  { permissionId: 'appointment_write', permissionName: 'appointment_write' },
];

// Roles data
export const seedRoles = [
  { roleId: 'role_system', roleName: 'system' },
  { roleId: 'role_admin', roleName: 'admin' },
  { roleId: 'role_viewer', roleName: 'viewer' },
  { roleId: 'role_manager', roleName: 'manager' },
  { roleId: 'role_staff', roleName: 'staff' },
];

// Role-Permissions mapping
export const seedRolePermissions = [
  // SYSTEM has ALL permissions
  { roleId: 'role_system', permissionId: 'perm_all' },
  
  // ADMIN has READ and WRITE permissions for all
  { roleId: 'role_admin', permissionId: 'store_create' },
  { roleId: 'role_admin', permissionId: 'store_read' },
  { roleId: 'role_admin', permissionId: 'store_write' },
  { roleId: 'role_admin', permissionId: 'order_read' },
  { roleId: 'role_admin', permissionId: 'order_write' },
  { roleId: 'role_admin', permissionId: 'user_read' },
  { roleId: 'role_admin', permissionId: 'user_write' },
  { roleId: 'role_admin', permissionId: 'appointment_read' },
  { roleId: 'role_admin', permissionId: 'appointment_write' },
  { roleId: 'role_admin', permissionId: 'menu_create' },
  { roleId: 'role_admin', permissionId: 'menu_read' },

  // VIEWER has READ permissions
  { roleId: 'role_viewer', permissionId: 'store_read' },
  { roleId: 'role_viewer', permissionId: 'order_read' },
  { roleId: 'role_viewer', permissionId: 'user_read' },
  { roleId: 'role_viewer', permissionId: 'appointment_read' },

  // MANAGER has READ and WRITE permissions
  { roleId: 'role_store_manager', permissionId: 'store_read' },
  { roleId: 'role_store_manager', permissionId: 'store_write' },
  { roleId: 'role_store_manager', permissionId: 'order_read' },
  { roleId: 'role_store_manager', permissionId: 'order_write' },
  { roleId: 'role_store_manager', permissionId: 'user_read' },
  { roleId: 'role_store_manager', permissionId: 'user_write' },
  { roleId: 'role_store_manager', permissionId: 'appointment_read' },
  { roleId: 'role_store_manager', permissionId: 'appointment_write' },
  { roleId: 'role_store_manager', permissionId: 'menu_read' },
  { roleId: 'role_store_manager', permissionId: 'menu_create' },

  // STAFF has READ permission
  { roleId: 'role_staff', permissionId: 'order_read' },
  { roleId: 'role_staff', permissionId: 'order_write' },
  { roleId: 'role_staff', permissionId: 'appointment_read' },
  { roleId: 'role_staff', permissionId: 'appointment_write' },

];

// Function to seed the database
export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  const server = await createServer();
  const db = server.db;

  try {
    // Clear existing data
    await db.delete(rolePermissions).execute();
    await db.delete(permissions).execute();
    await db.delete(roles).execute();
    
    // Add timestamps and created/updated by
    const now = new Date().toISOString();
    
    // Insert permissions
    console.log('📝 Seeding permissions...');
    await db.insert(permissions).values(
      seedPermissions.map(perm => ({
        ...perm,
        createdAt: now,
        updatedAt: now,
        createdBy: ADMIN_USER_ID,
        updatedBy: ADMIN_USER_ID,
      }))
    );
    
    // Insert roles
    console.log('👥 Seeding roles...');
    await db.insert(roles).values(
      seedRoles.map(role => ({
        ...role,
        createdAt: now,
        updatedAt: now,
        createdBy: ADMIN_USER_ID,
        updatedBy: ADMIN_USER_ID,
      }))
    );
    
    // Insert role-permissions
    console.log('🔗 Seeding role-permissions...');
    await db.insert(rolePermissions).values(
      seedRolePermissions.map(rp => ({
        ...rp,
        createdAt: now,
        updatedAt: now,
        createdBy: ADMIN_USER_ID,
        updatedBy: ADMIN_USER_ID,
      }))
    );
    
    console.log('✅ Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function if this file is executed directly

seedDatabase();
