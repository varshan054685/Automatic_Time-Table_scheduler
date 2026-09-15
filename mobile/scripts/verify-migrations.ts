/**
 * Verifies the local SQLite migrations run cleanly and produce the expected
 * schema. Runs the SAME migrations.ts used on-device (expo-sqlite) against
 * Node's built-in SQLite, then sanity-checks the resulting tables.
 *
 * Usage: npm run verify:db
 */
import { DatabaseSync } from "node:sqlite";
import { runMigrations, MIGRATIONS } from "../database/migrations";

const db = new DatabaseSync(":memory:");

runMigrations({
  exec: (sql) => db.exec(sql),
  getVersion: () => {
    const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
    return row.user_version;
  },
  setVersion: (version) => db.exec(`PRAGMA user_version = ${version}`),
});

const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map((r) => r.name);

const expected = [
  "app_session",
  "workspace",
  "workspace_member",
  "department",
  "classroom",
  "faculty",
  "section",
  "subject",
  "time_slot",
  "timetable",
  "timetable_entry",
  "change_request",
  "sync_metadata",
  "sync_queue",
];

const missing = expected.filter((t) => !tables.includes(t));
if (missing.length > 0) {
  console.error(`MISSING TABLES: ${missing.join(", ")}`);
  process.exit(1);
}

// Verify the sync columns exist on every syncable table.
const syncColumns = ["server_id", "client_id", "workspace_id", "version", "created_at", "updated_at", "deleted_at", "sync_status"];
const syncable = expected.filter((t) => t !== "app_session" && t !== "sync_metadata" && t !== "sync_queue");
let bad = 0;
for (const table of syncable) {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  const missingCols = syncColumns.filter((c) => !cols.includes(c));
  if (missingCols.length > 0) {
    console.error(`${table} missing: ${missingCols.join(", ")}`);
    bad++;
  }
}

// Sanity: enqueue works and CHECK constraints hold.
const insert = db.prepare(
  `INSERT INTO sync_queue (entity_type, entity_id, client_id, operation, payload, status, retry_count, server_id, idempotency_key, created_at, last_attempt_at, error)
   VALUES ('faculty', 1, 'abc-123', 'UPDATE', '{}', 'pending', 0, NULL, 'faculty:abc-123:UPDATE', '2026-01-01T00:00:00Z', NULL, NULL)`,
);
insert.run();
const count = (db.prepare("SELECT COUNT(*) AS n FROM sync_queue").get() as { n: number }).n;

const version = (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

console.log(`✓ ${MIGRATIONS.length} migration(s) applied (user_version=${version})`);
console.log(`✓ ${expected.length} tables present`);
console.log(`✓ sync columns verified on ${syncable.length - bad}/${syncable.length} syncable tables`);
console.log(`✓ sync_queue round-trip ok (${count} row(s))`);

if (bad > 0) process.exit(1);
console.log("All checks passed.");
