import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { getInstitutionId } from "@/lib/desktop-api";

/**
 * Timetable hooks — same names/signatures as the legacy REST versions, backed
 * by Electron IPC. Generation runs in the Electron main process (local Python
 * + OR-Tools) and reports progress by push events, never by HTTP polling.
 *
 * Safe-apply workflow (spec §11): a finished job only stages its rows; the
 * user reviews them and explicitly accepts, which creates a new active
 * timetable version while keeping the previous one for rollback.
 */

function schedulerGuard() {
  if (!window.api?.scheduler) {
    throw new Error(
      "Timetable generation is unavailable: the desktop scheduler bridge is missing. Run the app through Electron."
    );
  }
}

export function useTimetable(filters) {
  return useQuery({
    queryKey: ["timetable", filters?.sectionId ?? null, filters?.facultyId ?? null],
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.timetable.entries({
        institutionId,
        sectionId: filters?.sectionId ? Number(filters.sectionId) : null,
        teacherId: filters?.facultyId ? Number(filters.facultyId) : null,
      });
    },
  });
}

/**
 * Placeholder for the scheduler-phase IPC. Present so the Timetable page
 * compiles; clearly fails until window.api.scheduler ships.
 */
export function useGenerateTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      schedulerGuard();
      const institutionId = await getInstitutionId();
      return window.api.scheduler.generate({ ...data, institutionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

export function useRegenerateAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      schedulerGuard();
      const institutionId = await getInstitutionId();
      return window.api.scheduler.generate({ allSections: true, institutionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

/** Cancel a running generation job (staged rows are discarded). */
export function useCancelGeneration() {
  return useMutation({
    mutationFn: async (jobId) => {
      schedulerGuard();
      return window.api.scheduler.cancel(jobId);
    },
  });
}

/** Full job record incl. per-section status and explainable diagnostics. */
export function useSchedulerJob(jobId) {
  return useQuery({
    queryKey: ["scheduler-job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => window.api.scheduler.job(jobId),
  });
}

export function useSchedulerHistory() {
  return useQuery({
    queryKey: ["scheduler-history"],
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.scheduler.history(institutionId);
    },
  });
}

/** Pre-flight feasibility audit (no solving) — powers pre-generation hints. */
export function useSchedulerAudit(enabled = true) {
  return useQuery({
    queryKey: ["scheduler-audit"],
    enabled,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.scheduler.audit({ institutionId });
    },
  });
}

/** Promote staged results into a new active timetable version. */
export function useAcceptStaged() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, label }) => {
      schedulerGuard();
      return window.api.scheduler.accept(jobId, label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["scheduler-history"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
    },
  });
}

/** Throw away staged results without touching the live timetable. */
export function useDiscardStaged() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId) => {
      schedulerGuard();
      return window.api.scheduler.discard(jobId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduler-history"] });
    },
  });
}

/** Real double-booking detection over the active timetable version. */
export function useConflicts() {
  return useQuery({
    queryKey: ["conflicts"],
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.timetable.conflicts(institutionId);
    },
  });
}

export function useTimetableVersions() {
  return useQuery({
    queryKey: ["timetable-versions"],
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.timetable.versions(institutionId);
    },
  });
}

/** Restore an earlier timetable version by making it the active one. */
export function useActivateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId) => window.api.timetable.activateVersion(versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      queryClient.invalidateQueries({ queryKey: ["timetable-versions"] });
      queryClient.invalidateQueries({ queryKey: ["conflicts"] });
    },
  });
}

/** Delete a stored (non-active) version. */
export function useDeleteVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId) => window.api.timetable.deleteVersion(versionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timetable-versions"] }),
  });
}

/**
 * Progress hook. Subscribes to scheduler push events (no polling, no fake
 * progress). Terminal states are kept so the UI can show the review step until
 * the user accepts or discards the staged result.
 */
export function useGenerationStatus() {
  const [jobId, setJobId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [data, setData] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!jobId || !isPolling || !window.api?.scheduler?.onProgress) return;
    const off = window.api.scheduler.onProgress((progress) => {
      if (progress.jobId !== jobId) return;
      setData(progress);
      if (["completed", "failed", "partial", "cancelled"].includes(progress.status)) {
        setIsPolling(false);
        queryClient.invalidateQueries({ queryKey: ["timetable"] });
      }
    });
    return () => typeof off === "function" && off();
  }, [jobId, isPolling, queryClient]);

  const startPolling = useCallback((newJobId) => {
    setJobId(newJobId);
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => setIsPolling(false), []);
  const reset = useCallback(() => {
    setJobId(null);
    setIsPolling(false);
    setData(null);
  }, []);

  return { data, isPolling: isPolling && !!data, startPolling, stopPolling, reset };
}
