/**
 * Migration runner. Never destroys data (spec §4/§16):
 *   - reads PRAGMA user_version
 *   - applies each pending migration inside its own transaction
 *   - verifies checksums of already-applied migrations
 *   - on failure: rolls back and rethrows (caller restores the pre-migration backup)
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { DB } from "./database";
import { log, logError } from "./logger";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export interface MigrationResult {
  applied: number;
  from: number;
  to: number;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations", "sqlite");

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  return files.map((file) => {
    const match = /^(\d{4})_(.*)\.sql$/.exec(file);
    if (!match) throw new Error(`Invalid migration filename: ${file}`);
    return {
      version: parseInt(match[1], 10),
      name: match[2],
      sql: fs.readFileSync(path.join(dir, file), "utf8"),
    };
  });
}

export function getSchemaVersion(db: DB): number {
  const row = db.pragma("user_version", { simple: true }) as number;
  return row;
}

function setSchemaVersion(db: DB, version: number): void {
  db.pragma(`user_version = ${version}`);
}

function checksum(sql: string): string {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

/**
 * Verify checksums of already-applied migrations. Runs on EVERY boot (even
 * with no pending migrations) so a database touched by a different app
 * version is caught immediately, not just at upgrade time.
 */
export function verifyChecksums(db: DB, dir: string = MIGRATIONS_DIR): void {
  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get();
  if (!hasTable) return; // fresh DB — nothing applied yet

  const migrations = loadMigrations(dir);
  const appliedRows = db.prepare("SELECT version, checksum FROM schema_migrations").all() as {
    version: number;
    checksum: string;
  }[];
  for (const row of appliedRows) {
    const m = migrations.find((x) => x.version === row.version);
    if (m && checksum(m.sql) !== row.checksum) {
      throw new Error(
        `Migration checksum mismatch for v${row.version} (${m.name}). ` +
        `The database was modified by a different version of the app. Restore a backup.`
      );
    }
  }
}

export function runMigrations(db: DB, dir: string = MIGRATIONS_DIR): MigrationResult {
  const migrations = loadMigrations(dir);
  const current = getSchemaVersion(db);

  // Ensure bookkeeping table exists (it is also created by 0001; safe no-op).
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    checksum TEXT NOT NULL
  );`);

  verifyChecksums(db, dir);

  const pending = migrations.filter((m) => m.version > current);
  let from = current;
  let to = current;
  let applied = 0;

  for (const migration of pending) {
    try {
      const apply = db.transaction(() => {
        db.exec(migration.sql);
        db.prepare("INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)").run(
          migration.version,
          migration.name,
          checksum(migration.sql)
        );
        setSchemaVersion(db, migration.version);
      });
      apply();
      applied++;
      to = migration.version;
      log(`Applied migration v${migration.version} (${migration.name})`, "db");
    } catch (err) {
      logError(`Migration v${migration.version} (${migration.name}) failed`, err, "db");
      throw new Error(
        `Migration to schema v${migration.version} failed: ${err instanceof Error ? err.message : String(err)}. ` +
        `The database was left at v${to}. Restore the automatic pre-migration backup if needed.`
      );
    }
  }

  return { applied, from, to };
}

/** Restore a backup file over the live database file. Caller must close the DB first. */
export function restoreBackupFile(backupPath: string, dbFile: string): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = dbFile + suffix;
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  fs.copyFileSync(backupPath, dbFile);
  log(`Database restored from ${backupPath}`, "db");
}
