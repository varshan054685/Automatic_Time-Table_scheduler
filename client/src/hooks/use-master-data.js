import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";

// Helper: invalidate both the entity list and the timetable
const invalidateTimetable = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: [api.timetable.list.path] });

// === DEPARTMENTS ===
export function useDepartments() {
  return useQuery({
    queryKey: [api.departments.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.departments.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch departments");
      return api.departments.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const validated = api.departments.create.input.parse(data);
      const res = await fetch(apiUrl(api.departments.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create department");
      return api.departments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const url = buildUrl(api.departments.update.path, { id });
      const res = await fetch(apiUrl(url), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update department");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const url = buildUrl(api.departments.delete.path, { id });
      const res = await fetch(apiUrl(url), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete department");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

// === CLASSROOMS ===
export function useClassrooms() {
  return useQuery({
    queryKey: [api.classrooms.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.classrooms.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch classrooms");
      return api.classrooms.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const validated = api.classrooms.create.input.parse({
        ...data,
        capacity: Number(data.capacity)
      });
      const res = await fetch(apiUrl(api.classrooms.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create classroom");
      return api.classrooms.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.classrooms.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useUpdateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const url = buildUrl(api.classrooms.update.path, { id });
      const res = await fetch(apiUrl(url), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, capacity: Number(data.capacity) }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update classroom");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.classrooms.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useDeleteClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const url = buildUrl(api.classrooms.delete.path, { id });
      const res = await fetch(apiUrl(url), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete classroom");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.classrooms.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

// === SUBJECTS ===
export function useSubjects() {
  return useQuery({
    queryKey: [api.subjects.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.subjects.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return api.subjects.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const validated = api.subjects.create.input.parse({
        ...data,
        weeklyHours: Number(data.weeklyHours),
        departmentId: Number(data.departmentId)
      });
      const res = await fetch(apiUrl(api.subjects.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create subject");
      return api.subjects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const url = buildUrl(api.subjects.update.path, { id });
      const res = await fetch(apiUrl(url), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          weeklyHours: Number(data.weeklyHours),
          departmentId: Number(data.departmentId)
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update subject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const url = buildUrl(api.subjects.delete.path, { id });
      const res = await fetch(apiUrl(url), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete subject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

// === FACULTY ===
export function useFaculty() {
  return useQuery({
    queryKey: [api.faculty.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.faculty.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch faculty");
      return api.faculty.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const validated = api.faculty.create.input.parse({
        ...data,
        departmentId: Number(data.departmentId)
      });
      const res = await fetch(apiUrl(api.faculty.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create faculty");
      return api.faculty.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.faculty.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useUpdateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const url = buildUrl(api.faculty.update.path, { id });
      const res = await fetch(apiUrl(url), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, departmentId: Number(data.departmentId) }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update faculty");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.faculty.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const url = buildUrl(api.faculty.delete.path, { id });
      const res = await fetch(apiUrl(url), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete faculty");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.faculty.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

// === SECTIONS ===
export function useSections() {
  return useQuery({
    queryKey: [api.sections.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.sections.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sections");
      return api.sections.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const validated = api.sections.create.input.parse({
        ...data,
        departmentId: Number(data.departmentId),
        classroomId: data.classroomId ? Number(data.classroomId) : null,
        year: Number(data.year),
        semester: Number(data.semester)
      });
      const res = await fetch(apiUrl(api.sections.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create section");
      }
      return api.sections.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sections.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const url = buildUrl(api.sections.update.path, { id });
      const res = await fetch(apiUrl(url), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          departmentId: Number(data.departmentId),
          classroomId: data.classroomId ? Number(data.classroomId) : null,
          year: Number(data.year),
          semester: Number(data.semester)
        }),
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update section");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sections.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const url = buildUrl(api.sections.delete.path, { id });
      const res = await fetch(apiUrl(url), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete section");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.sections.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

// === TIME SLOTS ===
export function useTimeSlots() {
  return useQuery({
    queryKey: [api.timeSlots.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.timeSlots.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return api.timeSlots.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000,
  });
}

export function useCreateTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const validated = api.timeSlots.create.input.parse(data);
      const res = await fetch(apiUrl(api.timeSlots.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create time slot");
      return api.timeSlots.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.timeSlots.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useUpdateTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const url = buildUrl(api.timeSlots.update.path, { id });
      const res = await fetch(apiUrl(url), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update time slot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.timeSlots.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}

export function useDeleteTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const url = buildUrl(api.timeSlots.delete.path, { id });
      const res = await fetch(apiUrl(url), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete time slot");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.timeSlots.list.path] });
      invalidateTimetable(queryClient);
    },
  });
}
