/**
 * Sync status store (external store, no extra dependencies).
 *
 * Phase 2 only feeds ONLINE/OFFLINE (via connectivity). SYNCING / SYNCED /
 * SYNC_FAILED transitions are reserved for the Phase 6 sync engine but the
 * API surface is already in place so the SyncStatus UI is future-proof.
 */
import { useSyncExternalStore } from "react";

export interface SyncStoreState {
  syncState: "idle" | "syncing" | "synced" | "sync_failed";
  isOnline: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  pendingOps: number;
}

let state: SyncStoreState = {
  syncState: "idle",
  isOnline: true,
  lastSyncedAt: null,
  error: null,
  pendingOps: 0,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const syncStatusStore = {
  getSnapshot: (): SyncStoreState => state,
  subscribe,
  useSnapshot: (): SyncStoreState => useSyncExternalStore(subscribe, syncStatusStore.getSnapshot),

  setConnection(isOnline: boolean): void {
    if (state.isOnline === isOnline) return;
    state = { ...state, isOnline };
    emit();
  },

  beginSync(): void {
    state = { ...state, syncState: "syncing", error: null };
    emit();
  },

  finishSync(lastSyncedAt: string | null, pendingOps = 0): void {
    state = {
      ...state,
      syncState: "synced",
      lastSyncedAt,
      pendingOps,
      error: null,
    };
    emit();
  },

  failSync(error: string): void {
    state = { ...state, syncState: "sync_failed", error };
    emit();
  },

  setPendingOps(pendingOps: number): void {
    if (state.pendingOps === pendingOps) return;
    state = { ...state, pendingOps };
    emit();
  },

  reset(): void {
    state = {
      syncState: "idle",
      isOnline: state.isOnline,
      lastSyncedAt: null,
      error: null,
      pendingOps: 0,
    };
    emit();
  },
};

/** Test helper — replaces the store contents wholesale. */
export function _setSyncStore(next: Partial<SyncStoreState>): void {
  state = { ...state, ...next };
  emit();
}
