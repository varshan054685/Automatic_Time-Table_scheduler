/**
 * Connectivity detection.
 *
 * Combines NetInfo's network state with a lightweight reachability probe
 * against the backend. Exposed as an external store so the whole app can
 * subscribe without prop drilling. The app must never depend on this for core
 * functionality — it only decorates the offline experience.
 */
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";
import { API_BASE } from "./api";
import { SyncStatusSnapshot } from "@/types/sync";
import { syncStatusStore } from "@/stores/sync-status-store";

const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 4_000;

interface ConnectivitySnapshot {
  isOnline: boolean;
  networkType: string | null;
  lastChangedAt: string;
}

let snapshot: ConnectivitySnapshot = {
  isOnline: true,
  networkType: null,
  lastChangedAt: new Date().toISOString(),
};

const listeners = new Set<() => void>();
let started = false;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeNetInfo: (() => void) | null = null;

function emit() {
  for (const listener of listeners) listener();
}

async function probeReachability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/api/auth/config`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}

function setOnline(isOnline: boolean): void {
  const changed = snapshot.isOnline !== isOnline;
  snapshot = { ...snapshot, isOnline, lastChangedAt: new Date().toISOString() };
  if (changed) {
    syncStatusStore.setConnection(isOnline);
  }
  emit();
}

function onNetInfoChange(state: NetInfoState): void {
  snapshot = { ...snapshot, networkType: state.type };
  const netInfoOnline = state.isConnected !== false && state.isInternetReachable !== false;
  if (netInfoOnline !== snapshot.isOnline) {
    void probeReachability().then((reachable) => setOnline(reachable));
  }
}

function start(): void {
  if (started) return;
  started = true;
  unsubscribeNetInfo = NetInfo.addEventListener(onNetInfoChange);

  void NetInfo.fetch().then((state) => {
    snapshot = { ...snapshot, networkType: state.type };
  });

  probeTimer = setInterval(() => {
    void probeReachability().then((reachable) => setOnline(reachable));
  }, PROBE_INTERVAL_MS);
}

export function getConnectivitySnapshot(): ConnectivitySnapshot {
  return snapshot;
}

export function isOnline(): boolean {
  return snapshot.isOnline;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook: re-renders when connectivity changes. */
export function useConnectivity(): ConnectivitySnapshot {
  start();
  return useSyncExternalStore(subscribe, getConnectivitySnapshot);
}

function deriveState(store: { syncState: "idle" | "syncing" | "synced" | "sync_failed"; isOnline: boolean }): SyncStatusSnapshot["state"] {
  // The sync engine (Phase 6) drives syncing/synced/failed; until then the
  // state reflects plain connectivity. Offline wins over an idle sync state.
  if (!store.isOnline) return "offline";
  if (store.syncState === "syncing") return "syncing";
  if (store.syncState === "sync_failed") return "sync_failed";
  if (store.syncState === "synced") return "synced";
  return "online";
}

/** Combined connectivity + sync status for the SyncStatus component. */
export function useSyncStatusSnapshot(): SyncStatusSnapshot {
  const { isOnline: online } = useConnectivity();
  const status = syncStatusStore.useSnapshot();
  return {
    state: deriveState({ syncState: status.syncState, isOnline: online }),
    lastSyncedAt: status.lastSyncedAt,
    error: status.error,
    pendingOps: status.pendingOps,
  };
}

/** Non-hook accessor for contexts where hooks are unavailable. */
export function getSyncStatusSnapshot(): SyncStatusSnapshot {
  const status = syncStatusStore.getSnapshot();
  return {
    state: deriveState(status),
    lastSyncedAt: status.lastSyncedAt,
    error: status.error,
    pendingOps: status.pendingOps,
  };
}

/** Test helper — forces the connectivity state without touching the network. */
export function _forceConnectivity(isOnlineValue: boolean): void {
  setOnline(isOnlineValue);
}

/** Test teardown. */
export function _stopConnectivity(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
  if (probeTimer) clearInterval(probeTimer);
  probeTimer = null;
  started = false;
}
