/**
 * Conflict resolution.
 *
 * The sync engine never silently overwrites a user's offline changes. When the
 * server returns a version mismatch for an UPDATE, the upload phase stores the
 * server's current row snapshot in the queue item's error column (JSON) and
 * marks it 'conflict'. The user can then choose:
 *   - Keep local changes   → re-queue the UPDATE with the server's version as
 *     the new base, so the next push overwrites the server row.
 *   - Use server version   → refresh the local row from the stored server
 *     snapshot and drop the queued change.
 *   - Dismiss              → drop the queued change without touching the row.
 */
import {
  listConflictOperations,
  getQueueItem,
  removeOperation,
} from "@/database/repositories/sync";
import { SyncQueueItem } from "@/types/sync";
import { getDb } from "@/database/sqlite";
import { ENTITY_REPOS } from "./download";

export interface ConflictSnapshot {
  serverRow: Record<string, unknown> | null;
  serverVersion: number | null;
  message: string;
}

export interface ConflictView {
  item: SyncQueueItem;
  snapshot: ConflictSnapshot | null;
}

export function parseConflictSnapshot(raw: string | null): ConflictSnapshot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConflictSnapshot;
  } catch {
    return null;
  }
}

export function listConflicts(): ConflictView[] {
  const items = listConflictOperations(100);
  return items.map((item) => ({
    item,
    snapshot: parseConflictSnapshot(item.error),
  }));
}

export function countConflicts(): number {
  return listConflictOperations(500).length;
}

/** Apply the server version: refresh the local row and drop the queued change. */
export function resolveConflictServerWins(conflictId: number): void {
  const item = getQueueItem(conflictId);
  if (!item) return;

  const snapshot = parseConflictSnapshot(item.error);
  const serverRow = snapshot?.serverRow;

  if (serverRow && (serverRow as { id?: unknown }).id != null) {
    const repo = ENTITY_REPOS[item.entityType];
    if (repo) {
      const serverId = Number(serverRow.id ?? item.serverId);
      if (serverId) repo.upsert(serverId, serverRow as Record<string, unknown>);
    }
  } else if (item.serverId) {
    const repo = ENTITY_REPOS[item.entityType];
    if (repo) repo.upsert(item.serverId, {});
  }
  removeOperation(conflictId);
}

/** Keep the local version: re-queue the UPDATE against the server's latest version. */
export function resolveConflictLocalWins(conflictId: number): void {
  const item = getQueueItem(conflictId);
  if (!item) return;

  const snapshot = parseConflictSnapshot(item.error);
  const serverVersion = snapshot?.serverVersion ?? (item.payload?.__baseVersion as number | undefined) ?? 1;

  const payload = {
    ...(item.payload ?? {}),
    __baseVersion: serverVersion,
  };
  // Re-enqueue as a fresh pending UPDATE with the corrected base version.
  getDb().runSync(
    `UPDATE "sync_queue" SET "status" = 'pending', "retry_count" = 0, "error" = NULL,
            "payload" = ?, "last_attempt_at" = NULL
     WHERE "id" = ?`,
    [JSON.stringify(payload), conflictId],
  );
}

/** Drop the queued change entirely (row keeps the current local state). */
export function dismissConflict(conflictId: number): void {
  removeOperation(conflictId);
}
