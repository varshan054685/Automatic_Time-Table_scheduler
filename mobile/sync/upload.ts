/**
 * Upload side of the sync engine.
 *
 * Reads pending operations from the local sync_queue and pushes them to the
 * server in one batched request (the server rate limit makes per-item HTTP
 * calls prohibitive). Per-item results drive queue state:
 *   - ok       → mark synced, record server_id, bump local row version
 *   - conflict → mark the queue item 'conflict' for manual resolution
 *   - error    → mark failed with a retry count (transient network/validation)
 *
 * Dependencies: a CREATE for entity X must come before the UPDATE/DELETE for
 * the same row; the server maps client_id → server row, so ordering within the
 * batch matters. The engine sorts operations by createdAt before pushing.
 */
import { pushOperations, SyncPushOperation, SyncPushItemResult } from "@/services/sync";
import {
  listPendingOperations,
  markOperationSynced,
  markOperationFailed,
  markOperationConflict,
} from "@/database/repositories/sync";
import { SyncQueueItem } from "@/types/sync";
import { nowIso } from "@/utils/date";
import { getDb } from "@/database/sqlite";
import { ENTITY_REPOS } from "./download";

export interface UploadResult {
  pushed: number;
  synced: number;
  conflicts: number;
  failed: number;
  error: string | null;
}

function toPushOp(item: SyncQueueItem): SyncPushOperation {
  const payload = item.payload ?? {};
  return {
    entityType: item.entityType,
    operation: item.operation,
    clientId: item.clientId,
    // DELETE ops carry the target server id in the payload when the queue
    // row itself was created without one; prefer the queue's server_id.
    serverId: item.serverId ?? (payload.serverId as number | null | undefined) ?? null,
    baseVersion: payload.__baseVersion as number | null | undefined,
    payload,
  };
}

/** After a successful push, reconcile the local row with the acknowledged server state. */
function reconcileLocalRow(item: SyncQueueItem, result: SyncPushItemResult): void {
  const serverId = result.result.serverId;
  const version = result.result.version;
  if (!serverId) return;

  const repo = ENTITY_REPOS[item.entityType];
  if (!repo) return;

  const db = getDb();
  const existing = repo.findByServerId(serverId) as Record<string, unknown> | undefined;
  const rowId = existing
    ? db.getFirstSync<{ id: number }>(`SELECT "id" FROM "${repo.table}" WHERE "server_id" = ?`, [serverId])?.id
    : undefined;

  if (rowId) {
    db.runSync(
      `UPDATE "${repo.table}" SET "sync_status" = 'synced', "server_id" = ?, "version" = ?, "client_id" = ?, "updated_at" = ? WHERE "id" = ?`,
      [serverId, version ?? 1, item.clientId, nowIso(), rowId],
    );
  } else if (item.entityId) {
    // Row was locally created (dirty) — match by local id.
    db.runSync(
      `UPDATE "${repo.table}" SET "sync_status" = 'synced', "server_id" = ?, "version" = ?, "updated_at" = ? WHERE "id" = ?`,
      [serverId, version ?? 1, nowIso(), item.entityId],
    );
  }
}

/**
 * Push all pending operations in one batch.
 * Returns summary counts. Callers decide whether to retry on error.
 */
export async function uploadPendingChanges(): Promise<UploadResult> {
  const pending = listPendingOperations(200);
  if (pending.length === 0) return { pushed: 0, synced: 0, conflicts: 0, failed: 0, error: null };

  // CREATE ops first, then UPDATE/DELETE, each chronologically — the server
  // resolves client_id references so a create must land before its updates.
  const sorted = [...pending].sort((a, b) => {
    const rank = (op: SyncQueueItem["operation"]) => (op === "CREATE" ? 0 : 1);
    const rankDiff = rank(a.operation) - rank(b.operation);
    return rankDiff !== 0 ? rankDiff : a.createdAt.localeCompare(b.createdAt);
  });

  const ops = sorted.map(toPushOp);

  let response: { results: SyncPushItemResult[]; serverTime: string };
  try {
    response = await pushOperations(ops);
  } catch (err) {
    // Network failure — mark everything as failed (retry later, nothing lost).
    const message = err instanceof Error ? err.message : "Sync upload failed";
    for (const item of pending) markOperationFailed(item.id, message);
    return { pushed: pending.length, synced: 0, conflicts: 0, failed: pending.length, error: message };
  }

  const summary: UploadResult = { pushed: pending.length, synced: 0, conflicts: 0, failed: 0, error: null };

  // Map back by idempotency key (client_id + entity + operation) so we can
  // mark the exact queue rows regardless of sort order.
  const byKey = new Map<string, SyncQueueItem>();
  for (const item of sorted) {
    byKey.set(`${item.entityType}:${item.clientId}:${item.operation}`, item);
  }

  for (const res of response.results) {
    const key = `${res.entityType}:${res.clientId}:${res.operation}`;
    const item = byKey.get(key);
    if (!item) continue;

    switch (res.result.status) {
      case "ok":
        markOperationSynced(item.id, res.result.serverId ?? null);
        reconcileLocalRow(item, res);
        summary.synced++;
        break;
      case "conflict": {
        // Persist the server's current row + version alongside the queue item so
        // the conflict-resolution UI can offer "use server version".
        const serverRow = res.result.row as Record<string, unknown> | undefined;
        const serverVersion = res.result.version ?? null;
        const snapshot = JSON.stringify({
          serverRow: serverRow ?? null,
          serverVersion,
          message: res.result.error ?? "Conflict detected",
        });
        markOperationConflict(item.id, snapshot);
        summary.conflicts++;
        break;
      }
      case "error":
        markOperationFailed(item.id, res.result.error ?? "Server rejected operation");
        summary.failed++;
        break;
    }
  }

  // Clean up fully-synced records to keep the queue small.
  getDb().runSync(`DELETE FROM "sync_queue" WHERE "status" = 'synced'`);

  return summary;
}
