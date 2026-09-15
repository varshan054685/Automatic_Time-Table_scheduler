/**
 * Sync API client — the ONLY network surface the sync engine uses.
 *
 * Endpoints (added in the server for offline-first clients):
 *   GET  /api/sync/bootstrap  — full workspace snapshot
 *   GET  /api/sync/changes?since= — incremental CREATE/UPDATE/DELETE since a timestamp
 *   POST /api/sync/push       — batched client operations with per-item results
 *
 * All responses are scoped to the authenticated user's workspace via the
 * Passport session cookie attached by the shared api client.
 */
import { api } from "./api";

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

export interface SyncPushOperation {
  entityType: string;
  operation: SyncOperation;
  /** Client UUID — idempotency anchor for offline creates. */
  clientId?: string | null;
  /** Server id for UPDATE/DELETE of an already-synced row. */
  serverId?: number | null;
  /** Server version the client last saw (optimistic concurrency). */
  baseVersion?: number | null;
  payload?: Record<string, unknown>;
}

export type SyncPushItemResult = SyncPushOperation & {
  result: {
    status: "ok" | "conflict" | "error";
    serverId?: number | null;
    version?: number;
    row?: unknown;
    error?: string;
  };
};

export interface BootstrapResponse {
  workspace: {
    id: number;
    name: string;
    ownerId: number;
    referralCode: string;
    adminReferralCode?: string | null;
    academicYear?: string | null;
  } | null;
  serverTime: string;
  departments: Record<string, unknown>[];
  classrooms: Record<string, unknown>[];
  faculty: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  subjects: Record<string, unknown>[];
  timeSlots: Record<string, unknown>[];
  timetableEntries: Record<string, unknown>[];
  changeRequests: Record<string, unknown>[];
  members: Record<string, unknown>[];
}

export interface RemoteChange {
  entity: string;
  id: number;
  operation: SyncOperation;
  row: Record<string, unknown>;
}

export interface ChangesResponse {
  changes: RemoteChange[];
  serverTime: string;
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await api.get<BootstrapResponse>("/api/sync/bootstrap", { timeoutMs: 60_000 });
  return res.data;
}

export async function fetchChanges(since: string): Promise<ChangesResponse> {
  const res = await api.get<ChangesResponse>(
    `/api/sync/changes?since=${encodeURIComponent(since)}`,
    { timeoutMs: 60_000 },
  );
  return res.data;
}

export async function pushOperations(
  operations: SyncPushOperation[],
): Promise<{ results: SyncPushItemResult[]; serverTime: string }> {
  const res = await api.post<{ results: SyncPushItemResult[]; serverTime: string }>(
    "/api/sync/push",
    { operations },
    { timeoutMs: 60_000 },
  );
  return res.data;
}
