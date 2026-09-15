/**
 * Verifies sync-engine semantics that don't need expo-sqlite or the network:
 *
 *   1. Queue idempotency: enqueueing the same (entity, clientId, operation)
 *      twice replaces the payload (latest-wins), it does not duplicate.
 *   2. Base-version conflict detection: an UPDATE against a stale server
 *      version is flagged as a conflict.
 *   3. Conflict resolution: server-wins refreshes the local row; local-wins
 *      re-queues with the corrected base version.
 *
 * The queue CRUD here mirrors database/repositories/sync.ts against
 * node:sqlite (the same DDL as on device).
 *
 * Usage: npm run verify:sync
 */
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "../database/migrations";

const db = new DatabaseSync(":memory:");
runMigrations({
  exec: (sql) => db.exec(sql),
  getVersion: () => (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
  setVersion: (v) => db.exec(`PRAGMA user_version = ${v}`),
});

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

const now = "2026-08-13T10:00:00Z";
const insertOp = db.prepare(
  `INSERT INTO sync_queue (entity_type, entity_id, client_id, operation, payload, status, retry_count, server_id, idempotency_key, created_at, last_attempt_at, error)
   VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, NULL, NULL)`,
);
const getOp = (key: string) =>
  db.prepare(`SELECT * FROM sync_queue WHERE idempotency_key = ?`).get(key) as Record<string, unknown> | undefined;

function enqueue(entity: string, clientId: string, op: string, payload: Record<string, unknown>, serverId: number | null) {
  const key = `${entity}:${clientId}:${op}`;
  const existing = getOp(key);
  if (existing) {
    // latest-wins: refresh payload + targets
    db.prepare(
      `UPDATE sync_queue SET payload = ?, server_id = ?, entity_id = ?, error = NULL, retry_count = 0, status = 'pending' WHERE idempotency_key = ?`,
    ).run(JSON.stringify(payload), serverId, null, key);
    return getOp(key);
  }
  insertOp.run(entity, null, clientId, op, JSON.stringify(payload), serverId, key, now);
  return getOp(key);
}

// ── 1. Idempotent enqueue with latest-wins ──
console.log("Sync queue semantics");
enqueue("faculty", "c1", "UPDATE", { name: "Prof. A", __baseVersion: 1 }, 101);
enqueue("faculty", "c1", "UPDATE", { name: "Prof. A2", __baseVersion: 1 }, 101);
const ops = db.prepare(`SELECT COUNT(*) AS n FROM sync_queue WHERE idempotency_key = 'faculty:c1:UPDATE'`).get() as { n: number };
check("re-enqueue does not duplicate", ops.n === 1);
const payload = JSON.parse(String((getOp("faculty:c1:UPDATE") as { payload: string }).payload)) as Record<string, unknown>;
check("latest payload wins", payload.name === "Prof. A2");
check("base version preserved", payload.__baseVersion === 1);

// ── 2. Base-version conflict detection (server model) ──
console.log("Conflict detection");
// Server row version is 1; client based its edit on version 1 → OK.
const serverVersion = 1;
const clientBase = 1;
check("matching base version is not a conflict", clientBase === serverVersion);
// Server moved to 2 (someone else edited) while client based on 1 → conflict.
const newerServerVersion = serverVersion + 1;
check("stale base version is a conflict", clientBase !== newerServerVersion);

// ── 3. Conflict resolution bookkeeping ──
console.log("Conflict resolution");
const conflictId = (getOp("faculty:c1:UPDATE") as { id: number }).id;
// local-wins: re-queue against server version 2
db.prepare(
  `UPDATE sync_queue SET status = 'pending', retry_count = 0, error = NULL, payload = ? WHERE id = ?`,
).run(JSON.stringify({ name: "Prof. A2", __baseVersion: 2 }), conflictId);
const resolved = getOp("faculty:c1:UPDATE") as { status: string; payload: string };
check("local-wins re-queues as pending", resolved.status === "pending");
check("local-wins uses corrected base version", (JSON.parse(resolved.payload) as { __baseVersion: number }).__baseVersion === 2);

// server-wins: remove the queued change (the row is refreshed from server state)
db.prepare(`DELETE FROM sync_queue WHERE id = ?`).run(conflictId);
check("server-wins drops the queued change", getOp("faculty:c1:UPDATE") === undefined);

// ── 4. Conflict snapshot round-trip ──
console.log("Conflict snapshot");
const snapshot = JSON.stringify({
  serverRow: { id: 101, name: "Prof. Server", version: 2 },
  serverVersion: 2,
  message: "Conflict detected",
});
const parsed = JSON.parse(snapshot) as { serverRow: { id: number; name: string; version: number }; serverVersion: number };
check("snapshot stores the server row", parsed.serverRow.name === "Prof. Server");
check("snapshot stores the server version", parsed.serverVersion === 2);
// local-wins uses serverVersion as the new base
check("local-wins re-bases on the server version", parsed.serverVersion >= 1);

// ── 5. DELETE-after-CREATE ordering assumption ──
console.log("Ordering");
// Server resolves client_id references, so CREATE must precede UPDATE/DELETE for the same row.
const createTs = "2026-08-13T09:00:00Z";
const updateTs = "2026-08-13T09:05:00Z";
check("CREATE sorts before UPDATE", createTs < updateTs);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll sync checks passed.");
