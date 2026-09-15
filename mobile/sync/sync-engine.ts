/**
 * Sync engine — single-flight orchestration.
 *
 * Order per cycle:
 *   1. upload pending local changes (reconciles conflicts with the server)
 *   2. download incremental changes since the last sync cursor
 *   3. on first sync ever (no cursor), download the full bootstrap snapshot
 *   4. persist the sync cursor + lastSyncedAt, refresh the status store
 *
 * Only one sync job runs at a time (module-level promise). If a cycle is
 * already running, new requests await it instead of starting a duplicate job.
 */
import { fetchBootstrap, fetchChanges } from "@/services/sync";
import { uploadPendingChanges } from "./upload";
import { applyBootstrap, applyRemoteChange, refreshTimetableIndex } from "./download";
import {
  getSyncMetadata,
  setSyncMetadata,
  countPendingOperations,
} from "@/database/repositories/sync";
import { updateLastSyncedAt } from "@/database/repositories/session";
import { syncStatusStore } from "@/stores/sync-status-store";

const CURSOR_KEY = "sync_cursor";
const BOOTSTRAPPED_KEY = "bootstrap_done";

export interface SyncCycleResult {
  ok: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: number;
  error: string | null;
}

let running: Promise<SyncCycleResult> | null = null;

function getCursor(): string | null {
  return getSyncMetadata(CURSOR_KEY);
}

function isBootstrapped(): boolean {
  return getSyncMetadata(BOOTSTRAPPED_KEY) === "1";
}

/**
 * Run a full sync cycle. Safe to call repeatedly; concurrent calls share the
 * in-flight job.
 */
export function runSyncCycle(workspaceId: number): Promise<SyncCycleResult> {
  if (running) return running;
  running = doCycle(workspaceId).finally(() => {
    running = null;
  });
  return running;
}

async function doCycle(workspaceId: number): Promise<SyncCycleResult> {
  syncStatusStore.beginSync();
  const result: SyncCycleResult = { ok: false, uploaded: 0, downloaded: 0, conflicts: 0, error: null };

  try {
    // 1. Upload pending local changes first.
    const upload = await uploadPendingChanges();
    result.uploaded = upload.pushed;
    result.conflicts = upload.conflicts;

    // 2. Download remote changes.
    let cursor = getCursor();
    let downloaded = 0;

    if (!cursor || !isBootstrapped()) {
      // First sync: full snapshot.
      const bootstrap = await fetchBootstrap();
      applyBootstrap(bootstrap);
      refreshTimetableIndex(workspaceId);
      cursor = bootstrap.serverTime;
      setSyncMetadata(BOOTSTRAPPED_KEY, "1");
    } else {
      const changesRes = await fetchChanges(cursor);
      for (const change of changesRes.changes) {
        const applied = applyRemoteChange(change);
        if (applied) downloaded++;
      }
      cursor = changesRes.serverTime;
      refreshTimetableIndex(workspaceId);
    }

    setSyncMetadata(CURSOR_KEY, cursor);
    const syncedAt = cursor;
    updateLastSyncedAt(syncedAt);

    const pendingOps = countPendingOperations();
    syncStatusStore.finishSync(syncedAt, pendingOps);
    result.ok = true;
    result.downloaded = downloaded;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    result.error = message;
    result.ok = false;
    syncStatusStore.failSync(message);
    return result;
  }
}

/** Reset sync state (e.g. after logout or a full re-sync request). */
export function resetSyncState(): void {
  setSyncMetadata(CURSOR_KEY, "");
  setSyncMetadata(BOOTSTRAPPED_KEY, "0");
  syncStatusStore.reset();
}

/** Test helper — expose the internal cursor. */
export function getSyncCursor(): string | null {
  return getCursor();
}
