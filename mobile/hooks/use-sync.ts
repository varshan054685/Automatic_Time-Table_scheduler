/**
 * Sync lifecycle hook.
 *
 * Runs the sync engine:
 *   - once when a signed-in session becomes available (initial sync)
 *   - whenever the app transitions offline → online
 *   - on demand (retry / pull-to-refresh)
 *
 * The hook never blocks rendering: it reports a `syncing` boolean for UI
 * affordances but the app shell renders from local SQLite regardless.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/services/connectivity";
import { useSession } from "./use-session";
import { runSyncCycle, resetSyncState, SyncCycleResult } from "@/sync/sync-engine";
import { useQueryClient } from "@tanstack/react-query";

export function useSyncEngine() {
  const { session } = useSession();
  const { isOnline } = useConnectivity();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncCycleResult | null>(null);
  const didInitialSync = useRef<number | null>(null);

  // A real workspace has a non-zero id; the placeholder (id 0) is only used
  // before the user creates/joins a workspace, so no sync happens yet.
  const workspaceId = (session?.workspace?.id ?? 0) > 0 ? session!.workspace!.id : null;
  const workspaceRole = session?.workspace?.role ?? null;

  const sync = useCallback(async (): Promise<SyncCycleResult> => {
    if (!workspaceId) return { ok: false, uploaded: 0, downloaded: 0, conflicts: 0, error: "No workspace" };
    setSyncing(true);
    const result = await runSyncCycle(workspaceId);
    setLastResult(result);
    setSyncing(false);
    await queryClient.invalidateQueries({ queryKey: ["local"] });
    return result;
  }, [workspaceId, queryClient]);

  // Initial sync when a signed-in session with a real workspace is present.
  // Also re-syncs when the workspace changes (e.g. after workspace setup).
  useEffect(() => {
    if (workspaceId != null && didInitialSync.current !== workspaceId) {
      didInitialSync.current = workspaceId;
      void sync();
    }
  }, [workspaceId, sync]);

  // Offline → online transitions.
  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !wasOnline.current && workspaceId != null) {
      void sync();
    }
    wasOnline.current = isOnline;
  }, [isOnline, workspaceId, sync]);

  // Logout — reset sync state for the next user.
  useEffect(() => {
    if (workspaceId == null) {
      resetSyncState();
      didInitialSync.current = null;
    }
  }, [workspaceId]);

  return { syncing, lastResult, sync, isOwner: workspaceRole === "owner" };
}
