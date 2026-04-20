import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";

export function useTimetable(filters) {
  const queryKey = [api.timetable.list.path, filters?.sectionId, filters?.facultyId];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.sectionId && filters.sectionId !== "none") params.append("sectionId", filters.sectionId);
      if (filters?.facultyId && filters.facultyId !== "none") params.append("facultyId", filters.facultyId);
      
      const res = await fetch(apiUrl(`${api.timetable.list.path}?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timetable");
      return api.timetable.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

/**
 * Triggers async timetable generation for a department.
 * Returns { jobId, status } immediately — does NOT block.
 */
export function useGenerateTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.timetable.generatePython.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
           const error = await res.json();
           throw new Error(error.message || "Conflict in generation");
        }
        throw new Error("Failed to start timetable generation");
      }
      return await res.json(); // { message, jobId, status }
    },
    // Don't invalidate yet — polling will handle that when job completes
  });
}

/**
 * Triggers async regeneration for ALL sections in the workspace.
 * Returns { jobId, status } immediately — does NOT block.
 */
export function useRegenerateAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/timetable/regenerate-all"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to start regeneration");
      }
      return await res.json(); // { message, jobId, status }
    },
    // Don't invalidate yet — polling will handle that when job completes
  });
}

/**
 * Polls the generation status every 2 seconds while the job is active.
 * Automatically stops polling when the job reaches a terminal state.
 * Returns { data, isPolling, startPolling, stopPolling, reset }.
 */
export function useGenerationStatus() {
  const [jobId, setJobId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["generation-status", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await fetch(apiUrl(`/api/timetable/generation-status/${jobId}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch generation status");
      return await res.json();
    },
    enabled: !!jobId && isPolling,
    refetchInterval: isPolling ? 2000 : false,
  });

  // Auto-stop polling when job reaches a terminal state
  useEffect(() => {
    if (query.data) {
      const status = query.data.status;
      if (status === "completed" || status === "failed" || status === "partial") {
        setIsPolling(false);
        // Invalidate timetable queries so the grid auto-refreshes
        queryClient.invalidateQueries({ queryKey: [api.timetable.list.path] });
      }
    }
  }, [query.data, queryClient]);

  const startPolling = useCallback((newJobId) => {
    setJobId(newJobId);
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const reset = useCallback(() => {
    setJobId(null);
    setIsPolling(false);
  }, []);

  return {
    data: query.data,
    isPolling,
    jobId,
    startPolling,
    stopPolling,
    reset,
    isError: query.isError,
    error: query.error,
  };
}
