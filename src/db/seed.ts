
import { permissions, roles, rolePermissions } from "./schema.js";
import dotenv from 'dotenv';
dotenv.config();
import { createServer } from "../server.js";

// Admin user ID who will be the creator/updater
const ADMIN_USER_ID = 'system-admin';

// Permissions data
export const seedPermissions = [
  { permissionId: 'perm_all', permissionName: 'ALL' },
  { permissionId: 'perm_read', permissionName: 'READ' },
  { permissionId: 'perm_write', permissionName: 'WRITE' },
];

// Roles data
export const seedRoles = [
  { roleId: 'role_admin', roleName: 'ADMIN' },
  { roleId: 'role_manager', roleName: 'MANAGER' },
  { roleId: 'role_staff', roleName: 'STAFF' },
];

// Role-Permissions mapping
export const seedRolePermissions = [
  // ADMIN has ALL permissions
  { roleId: 'role_admin', permissionId: 'perm_all' },
  
  // MANAGER has READ and WRITE permissions
  { roleId: 'role_manager', permissionId: 'perm_read' },
  { roleId: 'role_manager', permissionId: 'perm_write' },
  
  // STAFF has READ permission
  { roleId: 'role_staff', permissionId: 'perm_read' },
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
