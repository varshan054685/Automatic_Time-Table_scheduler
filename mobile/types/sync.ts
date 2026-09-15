/**
 * Types for the local sync foundation.
 *
 * Phase 2 establishes the queue structure only — nothing is sent to the
 * server until the Phase 6 sync engine is built.
 */

export type SyncOperationType = "CREATE" | "UPDATE" | "DELETE";

export type SyncOpStatus = "pending" | "processing" | "synced" | "failed" | "conflict";

export type EntityType =
  | "workspace"
  | "workspace_member"
  | "department"
  | "classroom"
  | "faculty"
  | "section"
  | "subject"
  | "time_slot"
  | "timetable"
  | "timetable_entry"
  | "change_request";

export interface SyncQueueItem {
  id: number;
  entityType: EntityType;
  /** Local row id; for offline creates this may be null until a temp id is assigned. */
  entityId: number | null;
  /** Client UUID of the affected row (stable across retries → idempotency). */
  clientId: string;
  operation: SyncOperationType;
  /** JSON payload with the full/partial row data to push. */
  payload: Record<string, unknown>;
  status: SyncOpStatus;
  retryCount: number;
  /** Server id once the operation has been acknowledged. */
  serverId: number | null;
  idempotencyKey: string;
  createdAt: string;
  lastAttemptAt: string | null;
  error: string | null;
}

/** Connectivity states exposed by the app. */
export type ConnectivityState = "online" | "offline";

/**
 * Overall sync state. Phase 2 only produces ONLINE/OFFLINE; SYNCING / SYNCED /
 * SYNC_FAILED are reserved for the Phase 6 sync engine but already represented
 * so the SyncStatus UI and stores are future-proof.
 */
export type SyncState =
  | "idle"
  | "online"
  | "offline"
  | "syncing"
  | "synced"
  | "sync_failed";

export interface SyncStatusSnapshot {
  state: SyncState;
  lastSyncedAt: string | null;
  error: string | null;
  pendingOps: number;
}
