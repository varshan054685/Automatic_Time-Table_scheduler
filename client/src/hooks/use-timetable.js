import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useTimetable(filters) {
  const queryKey = [api.timetable.list.path, filters?.sectionId, filters?.facultyId];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.sectionId) params.append("sectionId", filters.sectionId);
      if (filters?.facultyId) params.append("facultyId", filters.facultyId);
      
      const res = await fetch(`${api.timetable.list.path}?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timetable");
      return api.timetable.list.responses[200].parse(await res.json());
    },
  });
}

export function useGenerateTimetable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await fetch(api.timetable.generate.path, {
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
        throw new Error("Failed to generate timetable");
      }
      return api.timetable.generate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.timetable.list.path] });
    },
  });
}
