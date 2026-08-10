// scripts/seeds/permission-seed.ts
// Permission seeder for TEMBO S3-API object storage service

import { db } from "../../src/index.js";

interface PermissionDefinition {
  name: string;
  description: string;
  resource: string;
  action: string;
  category?: string;
}

const defaultPermissions: PermissionDefinition[] = [
  // ── User Management ──────────────────────────────────────────────────────
  { name: "users.view", description: "View user accounts and profiles", resource: "users", action: "view", category: "User Management" },
  { name: "users.create", description: "Create new user accounts", resource: "users", action: "create", category: "User Management" },
  { name: "users.update", description: "Update user information", resource: "users", action: "update", category: "User Management" },
  { name: "users.delete", description: "Delete user accounts", resource: "users", action: "delete", category: "User Management" },
  { name: "users.manage", description: "Full user management access", resource: "users", action: "manage", category: "User Management" },
  { name: "users.suspend", description: "Suspend or reinstate user accounts", resource: "users", action: "suspend", category: "User Management" },

  // ── API Key Management ────────────────────────────────────────────────────
  { name: "apikeys.view", description: "View API keys and their scopes", resource: "apikeys", action: "view", category: "API Keys" },
  { name: "apikeys.create", description: "Generate new API keys", resource: "apikeys", action: "create", category: "API Keys" },
  { name: "apikeys.revoke", description: "Revoke or deactivate API keys", resource: "apikeys", action: "revoke", category: "API Keys" },
  { name: "apikeys.manage", description: "Full API key management access", resource: "apikeys", action: "manage", category: "API Keys" },

  // ── Bucket Management ─────────────────────────────────────────────────────
  { name: "buckets.view", description: "View bucket details and configuration", resource: "buckets", action: "view", category: "Bucket Management" },
  { name: "buckets.create", description: "Create new storage buckets", resource: "buckets", action: "create", category: "Bucket Management" },
  { name: "buckets.update", description: "Update bucket configuration and quotas", resource: "buckets", action: "update", category: "Bucket Management" },
  { name: "buckets.delete", description: "Delete storage buckets", resource: "buckets", action: "delete", category: "Bucket Management" },
  { name: "buckets.manage", description: "Full bucket management access", resource: "buckets", action: "manage", category: "Bucket Management" },
  { name: "buckets.tier", description: "Change bucket storage tier", resource: "buckets", action: "tier", category: "Bucket Management" },
  { name: "buckets.stats", description: "View bucket usage statistics", resource: "buckets", action: "stats", category: "Bucket Management" },

  // ── Object Management ─────────────────────────────────────────────────────
  { name: "objects.view", description: "View and list objects", resource: "objects", action: "view", category: "Object Management" },
  { name: "objects.read", description: "Download / read object content", resource: "objects", action: "read", category: "Object Management" },
  { name: "objects.write", description: "Upload / overwrite object content", resource: "objects", action: "write", category: "Object Management" },
  { name: "objects.delete", description: "Delete objects", resource: "objects", action: "delete", category: "Object Management" },
  { name: "objects.manage", description: "Full object management access", resource: "objects", action: "manage", category: "Object Management" },
  { name: "objects.versions", description: "View and restore object versions", resource: "objects", action: "versions", category: "Object Management" },
  { name: "objects.tier", description: "Transition objects between storage tiers", resource: "objects", action: "tier", category: "Object Management" },
  { name: "objects.tags", description: "Update object metadata and tags", resource: "objects", action: "tags", category: "Object Management" },

  // ── Upload Management ─────────────────────────────────────────────────────
  { name: "uploads.view", description: "View upload sessions and progress", resource: "uploads", action: "view", category: "Upload Management" },
  { name: "uploads.create", description: "Initiate new multipart uploads", resource: "uploads", action: "create", category: "Upload Management" },
  { name: "uploads.cancel", description: "Cancel or abort in-progress uploads", resource: "uploads", action: "cancel", category: "Upload Management" },
  { name: "uploads.manage", description: "Full upload management access", resource: "uploads", action: "manage", category: "Upload Management" },

  // ── WORM & Retention ───────────────────────────────────────────────────────
  { name: "worm.view", description: "View WORM and retention records", resource: "worm", action: "view", category: "Compliance & Retention" },
  { name: "worm.enable", description: "Enable WORM protection on objects", resource: "worm", action: "enable", category: "Compliance & Retention" },
  { name: "worm.manage", description: "Full WORM policy management access", resource: "worm", action: "manage", category: "Compliance & Retention" },
  { name: "lock.view", description: "View object lock records and legal holds", resource: "lock", action: "view", category: "Compliance & Retention" },
  { name: "lock.apply", description: "Apply object locks and legal holds", resource: "lock", action: "apply", category: "Compliance & Retention" },
  { name: "lock.release", description: "Release object locks (compliance-permitting)", resource: "lock", action: "release", category: "Compliance & Retention" },
  { name: "lock.manage", description: "Full object lock management access", resource: "lock", action: "manage", category: "Compliance & Retention" },

  // ── Access Logs ────────────────────────────────────────────────────────────
  { name: "accesslogs.view", description: "View bucket and object access logs", resource: "accesslogs", action: "view", category: "Access Logs" },
  { name: "accesslogs.export", description: "Export access logs", resource: "accesslogs", action: "export", category: "Access Logs" },

  // ── Metrics & Analytics ────────────────────────────────────────────────────
  { name: "metrics.view", description: "View storage and performance metrics", resource: "metrics", action: "view", category: "Analytics" },
  { name: "analytics.view", description: "View usage and session analytics", resource: "analytics", action: "view", category: "Analytics" },
  { name: "analytics.export", description: "Export analytics reports", resource: "analytics", action: "export", category: "Analytics" },
  { name: "reports.storage", description: "Access storage usage and quota reports", resource: "reports", action: "storage", category: "Analytics" },
  { name: "reports.access", description: "Access request/latency reports", resource: "reports", action: "access", category: "Analytics" },

  // ── Notifications ──────────────────────────────────────────────────────────
  { name: "notifications.view", description: "View notifications", resource: "notifications", action: "view", category: "Notifications" },
  { name: "notifications.manage", description: "Manage notification preferences and channels", resource: "notifications", action: "manage", category: "Notifications" },

  // ── Dashboard Access ───────────────────────────────────────────────────────
  { name: "dashboard.admin", description: "Access admin dashboard", resource: "dashboard", action: "admin", category: "Dashboard" },
  { name: "dashboard.user", description: "Access standard user dashboard", resource: "dashboard", action: "user", category: "Dashboard" },
  { name: "dashboard.viewer", description: "Access read-only viewer dashboard", resource: "dashboard", action: "viewer", category: "Dashboard" },

  // ── Settings & Configuration ───────────────────────────────────────────────
  { name: "settings.view", description: "View system and account settings", resource: "settings", action: "view", category: "Settings" },
  { name: "settings.update", description: "Update system and account settings", resource: "settings", action: "update", category: "Settings" },
  { name: "settings.manage", description: "Full settings and configuration access", resource: "settings", action: "manage", category: "Settings" },

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  { name: "audit.view", description: "View system audit logs", resource: "audit", action: "view", category: "Security" },
  { name: "audit.export", description: "Export audit logs", resource: "audit", action: "export", category: "Security" },
];

export async function seedPermissions(): Promise<void> {
  console.log('[-] Seeding permissions...');

  try {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const permission of defaultPermissions) {
      const existing = await db.permission.findUnique({
        where: { name: permission.name },
      });

      if (existing) {
        const descriptionChanged = existing.description !== permission.description;
        const resourceChanged = existing.resource !== permission.resource;
        const actionChanged = existing.action !== permission.action;

        if (descriptionChanged || resourceChanged || actionChanged) {
          await db.permission.update({
            where: { name: permission.name },
            data: {
              description: permission.description,
              resource: permission.resource,
              action: permission.action,
            },
          });
          console.log(`- Updated permission: ${permission.name}`);
          updated++;
        } else {
          console.log(`⏭️  Skipped (no changes): ${permission.name}`);
          skipped++;
        }
        continue;
      }

      await db.permission.create({ data: permission });
      console.log(` Created permission: ${permission.name}`);
      created++;
    }

    console.log('\n🎉 Permission seeding completed!');
    console.log('📊 Summary:');
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Total:   ${created + updated + skipped}`);

    const totalInDb = await db.permission.count();
    console.log(`\n📊 Total permissions in database: ${totalInDb}\n`);

  } catch (error) {
    console.error('[*] Error seeding permissions:', error);
    throw error;
  }
}