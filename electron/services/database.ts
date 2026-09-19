/**
 * DatabaseService — embedded SQLite via better-sqlite3.
 * Single connection owned by the main process; WAL mode for safe concurrent
 * readers; foreign keys enforced; migrations run before any query is served.
 */
import Database from "better-sqlite3";
import fs from "fs";
import { getAppPaths } from "./paths";
import { log, logError } from "./logger";
import { runMigrations, verifyChecksums, getSchemaVersion, type MigrationResult } from "./migrations";
import { createBackup, BackupInfo } from "./backup";

export type DB = Database.Database;

let db: DB | null = null;

export function getDb(): DB {
  if (!db) throw new Error("Database not initialized — call initDatabase() first");
  return db;
}

export interface InitResult {
  versionBefore: number;
  versionAfter: number;
  applied: number;
  backupPath?: string;
}

/**
 * Open (or create) the database and bring it to the latest schema version.
 * Order of operations on every startup (spec §16):
 *   open → integrity check → migrate (backup first if migrations pending) → verify
 */
export async function initDatabase(): Promise<InitResult> {
  const { dbFile } = getAppPaths();
  log(`Opening database: ${dbFile}`, "db");

  db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  // Basic integrity gate — a corrupt file must never be silently extended.
  const integrity = (db.pragma("integrity_check", { simple: true }) as string) || "ok";
  if (!/ok|ok \(.*\)/i.test(integrity)) {
    logError(`Database integrity check failed: ${integrity}`, null, "db");
    throw new Error(`Database file is corrupted (integrity_check: ${integrity}). Restore a backup from Settings → Data.`);
  }

  // Catch a DB modified by a different app version even when up-to-date.
  verifyChecksums(db);

  const versionBefore = getSchemaVersion(db);

  let migration: MigrationResult = { applied: 0, from: versionBefore, to: versionBefore };
  let backupPath: string | undefined;
  if (versionBefore > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema v${versionBefore} is newer than this application (v${LATEST_SCHEMA_VERSION}). ` +
      `Please update the application instead of downgrading.`
    );
  }

  if (versionBefore < LATEST_SCHEMA_VERSION) {
    // Safety net before any schema change (spec §15/§16).
    // Skipped on fresh installs (v0 = empty file) — nothing to protect yet.
    if (versionBefore > 0) {
      backupPath = (await createBackup("pre-migration")).filePath;
      log(`Pre-migration backup created: ${backupPath}`, "db");
    }
    migration = runMigrations(db);
  }

  verifySchema(db);

  log(`Database ready (schema v${migration.to}, ${migration.applied} migration(s) applied this boot)`, "db");
  return { versionBefore, versionAfter: migration.to, applied: migration.applied, backupPath };
}

/** Lightweight structural verification after migrations. */
function verifySchema(db: DB): void {
  const required = ["schema_migrations", "institutions", "academic_years", "app_settings"];
  for (const table of required) {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table) as { name: string } | undefined;
    if (!row) throw new Error(`Schema verification failed: table '${table}' missing after migrations`);
  }
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
      db.close();
      log("Database closed (WAL checkpointed)", "db");
    } catch (err) {
      logError("Error closing database", err, "db");
    }
    db = null;
  }
}

/**
 * Flush pending writes to disk without closing the connection.
 *
 * Used by the pre-update gate (spec §15) before a backup is taken: the install
 * may still be refused, in which case the application keeps running, so the
 * connection must remain usable.
 */
export function flushDatabase(): void {
  if (!db) return;
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch (err) {
    logError("WAL checkpoint failed", err, "db");
  }
}

/** Run a mutation inside a transaction; rolls back on throw. */
export function inTransaction<T>(fn: (db: DB) => T): T {
  const d = getDb();
  return d.transaction(fn)(d);
}

export { getSchemaVersion, createBackup };
export type { BackupInfo };
export const LATEST_SCHEMA_VERSION = 2; // keep in sync with migrations/sqlite/*.sql
