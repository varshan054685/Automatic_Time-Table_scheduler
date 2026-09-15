import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { getInstitutionId } from "@/lib/desktop-api";

/**
 * Timetable hooks — same names/signatures as the legacy REST versions, backed
 * by IPC. Generation now goes through window.api.scheduler (added in the
 * scheduler phase); until that IPC domain exists, useRegenerateAll throws a
 * clear "not yet available" error instead of silently failing.
 */

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
      if (!window.api.scheduler) {
        throw new Error("Timetable generation arrives with the scheduler phase (IPC not wired yet).");
      }
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
      if (!window.api.scheduler) {
        throw new Error("Timetable generation arrives with the scheduler phase (IPC not wired yet).");
      }
      const institutionId = await getInstitutionId();
      return window.api.scheduler.generate({ allSections: true, institutionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
  });
}

/**
 * Progress hook. With the scheduler IPC present it subscribes to push events;
 * otherwise it stays idle (no polling, no fake progress).
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
