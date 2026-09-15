/**
 * Local SQLite migrations.
 *
 * Pure SQL + an injectable executor so the exact same DDL runs on device
 * (expo-sqlite) and in Node (scripts/verify-migrations.mjs uses node:sqlite).
 *
 * Schema conventions (future-proofed for the Phase 6 sync engine):
 *   - Every synchronizable entity carries: server_id, client_id, workspace_id,
 *     version, created_at, updated_at, deleted_at, sync_status.
 *   - server_id is the PostgreSQL id; client_id is a client-generated UUID used
 *     for idempotent offline creates and temp-id mapping.
 *   - No foreign keys are enforced locally: rows may reference data that has
 *     not been downloaded yet, so referential integrity stays server-side.
 */

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

export interface MigrationExecutor {
  exec(sql: string): void;
  getVersion(): number;
  setVersion(version: number): void;
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial-schema",
    statements: [
      // ── Local app session (never synced; credentials live in SecureStore) ──
      `CREATE TABLE IF NOT EXISTS "app_session" (
        "id" INTEGER PRIMARY KEY CHECK ("id" = 1),
        "user_json" TEXT NOT NULL,
        "workspace_json" TEXT NOT NULL,
        "last_synced_at" TEXT,
        "updated_at" TEXT NOT NULL DEFAULT (${NOW})
      )`,

      // ── Syncable entities ──
      `CREATE TABLE IF NOT EXISTS "workspace" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "name" TEXT NOT NULL,
        "owner_id" INTEGER,
        "referral_code" TEXT,
        "admin_referral_code" TEXT,
        "academic_year" TEXT,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_workspace_workspace_id" ON "workspace" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_workspace_sync_status" ON "workspace" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_workspace_updated_at" ON "workspace" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "workspace_member" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "user_id" INTEGER,
        "role" TEXT NOT NULL DEFAULT 'viewer',
        "name" TEXT,
        "email" TEXT,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_workspace_member_workspace_id" ON "workspace_member" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_workspace_member_sync_status" ON "workspace_member" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_workspace_member_updated_at" ON "workspace_member" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "department" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_department_workspace_id" ON "department" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_department_sync_status" ON "department" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_department_updated_at" ON "department" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "classroom" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "room_number" TEXT NOT NULL,
        "capacity" INTEGER NOT NULL,
        "type" TEXT DEFAULT 'lecture',
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_classroom_workspace_id" ON "classroom" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_classroom_sync_status" ON "classroom" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_classroom_updated_at" ON "classroom" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "faculty" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "name" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "department_id" INTEGER,
        "email" TEXT,
        "availability" TEXT,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_faculty_workspace_id" ON "faculty" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_faculty_sync_status" ON "faculty" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_faculty_updated_at" ON "faculty" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "section" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "name" TEXT NOT NULL,
        "year" INTEGER NOT NULL,
        "semester" INTEGER NOT NULL,
        "department_id" INTEGER,
        "classroom_id" INTEGER,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_section_workspace_id" ON "section" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_section_sync_status" ON "section" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_section_updated_at" ON "section" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "subject" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "weekly_hours" INTEGER NOT NULL,
        "department_id" INTEGER,
        "faculty_id" INTEGER,
        "section_id" INTEGER,
        "type" TEXT DEFAULT 'lecture',
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_subject_workspace_id" ON "subject" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_subject_sync_status" ON "subject" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_subject_updated_at" ON "subject" ("updated_at")`,

      `CREATE TABLE IF NOT EXISTS "time_slot" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "day_of_week" TEXT NOT NULL,
        "start_time" TEXT NOT NULL,
        "end_time" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_time_slot_workspace_id" ON "time_slot" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_time_slot_sync_status" ON "time_slot" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_time_slot_updated_at" ON "time_slot" ("updated_at")`,

      // Per-section timetable metadata (source: cloud solver or offline).
      `CREATE TABLE IF NOT EXISTS "timetable" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "section_id" INTEGER,
        "label" TEXT,
        "source" TEXT NOT NULL DEFAULT 'cloud',
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_workspace_id" ON "timetable" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_section_id" ON "timetable" ("section_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_sync_status" ON "timetable" ("sync_status")`,

      `CREATE TABLE IF NOT EXISTS "timetable_entry" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "section_id" INTEGER,
        "subject_id" INTEGER,
        "faculty_id" INTEGER,
        "classroom_id" INTEGER,
        "time_slot_id" INTEGER,
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_entry_workspace_id" ON "timetable_entry" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_entry_section_id" ON "timetable_entry" ("section_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_entry_faculty_id" ON "timetable_entry" ("faculty_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_entry_classroom_id" ON "timetable_entry" ("classroom_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_entry_time_slot_id" ON "timetable_entry" ("time_slot_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_timetable_entry_sync_status" ON "timetable_entry" ("sync_status")`,

      `CREATE TABLE IF NOT EXISTS "change_request" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "server_id" INTEGER UNIQUE,
        "client_id" TEXT UNIQUE,
        "workspace_id" INTEGER,
        "requested_by" INTEGER,
        "requester_name" TEXT,
        "requester_email" TEXT,
        "type" TEXT NOT NULL,
        "data" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "version" INTEGER NOT NULL DEFAULT 1,
        "created_at" TEXT,
        "updated_at" TEXT,
        "deleted_at" TEXT,
        "sync_status" TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_change_request_workspace_id" ON "change_request" ("workspace_id")`,
      `CREATE INDEX IF NOT EXISTS "idx_change_request_sync_status" ON "change_request" ("sync_status")`,
      `CREATE INDEX IF NOT EXISTS "idx_change_request_updated_at" ON "change_request" ("updated_at")`,

      // ── Sync bookkeeping ──
      `CREATE TABLE IF NOT EXISTS "sync_metadata" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT,
        "updated_at" TEXT NOT NULL DEFAULT (${NOW})
      )`,

      `CREATE TABLE IF NOT EXISTS "sync_queue" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "entity_type" TEXT NOT NULL,
        "entity_id" INTEGER,
        "client_id" TEXT NOT NULL,
        "operation" TEXT NOT NULL CHECK ("operation" IN ('CREATE','UPDATE','DELETE')),
        "payload" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending'
          CHECK ("status" IN ('pending','processing','synced','failed','conflict')),
        "retry_count" INTEGER NOT NULL DEFAULT 0,
        "server_id" INTEGER,
        "idempotency_key" TEXT NOT NULL UNIQUE,
        "created_at" TEXT NOT NULL DEFAULT (${NOW}),
        "last_attempt_at" TEXT,
        "error" TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_sync_queue_status_created" ON "sync_queue" ("status", "created_at")`,
      `CREATE INDEX IF NOT EXISTS "idx_sync_queue_client_id" ON "sync_queue" ("client_id")`,
    ],
  },
];

export function runMigrations(executor: MigrationExecutor): void {
  let version = executor.getVersion();
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    executor.exec("BEGIN TRANSACTION");
    try {
      for (const statement of migration.statements) {
        executor.exec(statement);
      }
      executor.setVersion(migration.version);
      executor.exec("COMMIT");
    } catch (err) {
      executor.exec("ROLLBACK");
      throw new Error(
        `Migration v${migration.version} (${migration.name}) failed: ${(err as Error).message}`,
      );
    }
    version = migration.version;
  }
}
