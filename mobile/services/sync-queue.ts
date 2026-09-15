/**
 * Sync queue service.
 *
 * The entry point for recording offline changes (CREATE / UPDATE / DELETE).
 * Phase 2 establishes the structure — nothing is transmitted. Phase 6's sync
 * engine consumes the queue and talks to the server.
 */
import {
  enqueueOperation,
  listPendingOperations,
  countPendingOperations,
} from "@/database/repositories/sync";
import { EntityType, SyncOperationType, SyncQueueItem } from "@/types/sync";
import { syncStatusStore } from "@/stores/sync-status-store";

export interface QueueLocalChangeParams {
  entityType: EntityType;
  /** Local row id (null for brand-new offline creates). */
  entityId?: number | null;
  clientId: string;
  operation: SyncOperationType;
  payload: Record<string, unknown>;
}

/** Queue a local change. Idempotent per (entityType, clientId, operation). */
export function queueLocalChange(params: QueueLocalChangeParams): SyncQueueItem {
  const item = enqueueOperation({
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    clientId: params.clientId,
    operation: params.operation,
    payload: params.payload,
  });
  syncStatusStore.setPendingOps(countPendingOperations());
  return item;
}

export function getPendingOperations(limit = 100): SyncQueueItem[] {
  return listPendingOperations(limit);
}

export function getPendingCount(): number {
  return countPendingOperations();
}

export function refreshPendingCount(): void {
  syncStatusStore.setPendingOps(countPendingOperations());
}
