import { getDb } from "../sqlite";
import { nowIso } from "@/utils/date";
import {
  EntityType,
  SyncOpStatus,
  SyncOperationType,
  SyncQueueItem,
} from "@/types/sync";

// ─── sync_metadata ────────────────────────────────────────────────────────

export function getSyncMetadata(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string | null }>(
    `SELECT "value" FROM "sync_metadata" WHERE "key" = ?`,
    [key],
  );
  return row?.value ?? null;
}

export function setSyncMetadata(key: string, value: string): void {
  getDb().runSync(
    `INSERT INTO "sync_metadata" ("key", "value", "updated_at")
     VALUES (?, ?, ?)
     ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updated_at" = excluded."updated_at"`,
    [key, value, nowIso()],
  );
}

export function getSyncMetadataAsNumber(key: string): number | null {
  const value = getSyncMetadata(key);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getSyncMetadataAsObject<T>(key: string): T | null {
  const value = getSyncMetadata(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// ─── sync_queue ────────────────────────────────────────────────────────────

export interface EnqueueParams {
  entityType: EntityType;
  entityId?: number | null;
  clientId: string;
  operation: SyncOperationType;
  payload: Record<string, unknown>;
}

/**
 * Queue a local change for future upload. Nothing is sent to the server yet —
 * the Phase 6 sync engine consumes these entries.
 *
 * Idempotency is guaranteed by the clientId+operation key. If the same change
 * is enqueued again while still pending (user edited the same entity twice
 * offline), the NEW payload replaces the old one — latest-wins — and the row's
 * entity_id/server_id are refreshed so the queued op always targets the right
 * record.
 */
export function enqueueOperation(params: EnqueueParams): SyncQueueItem {
  const db = getDb();
  const idempotencyKey = `${params.entityType}:${params.clientId}:${params.operation}`;
  const existing = db.getFirstSync<{ id: number; status: string }>(
    `SELECT "id", "status" FROM "sync_queue" WHERE "idempotency_key" = ?`,
    [idempotencyKey],
  );
  if (existing) {
    const row = getQueueItem(existing.id);
    if (row && (row.status === "pending" || row.status === "failed" || row.status === "processing")) {
      // Same operation re-recorded — replace the payload and refresh targets.
      db.runSync(
        `UPDATE "sync_queue" SET
           "entity_id" = ?, "server_id" = ?, "payload" = ?, "error" = NULL,
           "retry_count" = 0, "status" = 'pending', "last_attempt_at" = NULL
         WHERE "id" = ?`,
        [params.entityId ?? null, row.serverId, JSON.stringify(params.payload), existing.id],
      );
      const updated = getQueueItem(existing.id);
      if (updated) return updated;
    }
    if (row) return row;
  }
  const result = db.runSync(
    `INSERT INTO "sync_queue"
       ("entity_type", "entity_id", "client_id", "operation", "payload", "status", "retry_count", "server_id", "idempotency_key", "created_at", "last_attempt_at", "error")
     VALUES (?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?, NULL, NULL)`,
    [
      params.entityType,
      params.entityId ?? null,
      params.clientId,
      params.operation,
      JSON.stringify(params.payload),
      idempotencyKey,
      nowIso(),
    ],
  );
  const item = getQueueItem(Number(result.lastInsertRowId));
  if (!item) throw new Error("Failed to enqueue sync operation");
  return item;
}

function mapRow(row: Record<string, unknown>): SyncQueueItem {
  return {
    id: Number(row.id),
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id == null ? null : Number(row.entity_id),
    clientId: String(row.client_id),
    operation: row.operation as SyncOperationType,
    payload: parsePayload(row.payload),
    status: row.status as SyncOpStatus,
    retryCount: Number(row.retry_count ?? 0),
    serverId: row.server_id == null ? null : Number(row.server_id),
    idempotencyKey: String(row.idempotency_key),
    createdAt: String(row.created_at),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
    error: row.error ? String(row.error) : null,
  };
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getQueueItem(id: number): SyncQueueItem | null {
  const row = getDb().getFirstSync<Record<string, unknown>>(
    `SELECT * FROM "sync_queue" WHERE "id" = ?`,
    [id],
  );
  return row ? mapRow(row) : null;
}

export function listPendingOperations(limit = 100): SyncQueueItem[] {
  const rows = getDb().getAllSync(
    `SELECT * FROM "sync_queue" WHERE "status" IN ('pending', 'failed') ORDER BY "created_at" LIMIT ?`,
    [limit],
  );
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export function listConflictOperations(limit = 100): SyncQueueItem[] {
  const rows = getDb().getAllSync(
    `SELECT * FROM "sync_queue" WHERE "status" = 'conflict' ORDER BY "created_at" LIMIT ?`,
    [limit],
  );
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export function countPendingOperations(): number {
  const row = getDb().getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM "sync_queue" WHERE "status" IN ('pending', 'failed')`,
  );
  return row?.n ?? 0;
}

export function markOperationProcessing(id: number): void {
  getDb().runSync(
    `UPDATE "sync_queue" SET "status" = 'processing', "last_attempt_at" = ? WHERE "id" = ?`,
    [nowIso(), id],
  );
}

export function markOperationSynced(id: number, serverId?: number | null): void {
  getDb().runSync(
    `UPDATE "sync_queue" SET "status" = 'synced', "server_id" = ?, "last_attempt_at" = ?, "error" = NULL WHERE "id" = ?`,
    [serverId ?? null, nowIso(), id],
  );
}

export function markOperationFailed(id: number, error: string): void {
  getDb().runSync(
    `UPDATE "sync_queue" SET "status" = 'failed', "retry_count" = "retry_count" + 1, "last_attempt_at" = ?, "error" = ? WHERE "id" = ?`,
    [nowIso(), error, id],
  );
}

export function markOperationConflict(id: number, error: string): void {
  getDb().runSync(
    `UPDATE "sync_queue" SET "status" = 'conflict', "last_attempt_at" = ?, "error" = ? WHERE "id" = ?`,
    [nowIso(), error, id],
  );
}

export function removeOperation(id: number): void {
  getDb().runSync(`DELETE FROM "sync_queue" WHERE "id" = ?`, [id]);
}

export function clearSucceededOperations(): void {
  getDb().runSync(`DELETE FROM "sync_queue" WHERE "status" = 'synced'`);
}
