import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInstitutionId } from "@/lib/desktop-api";

/**
 * Master-data hooks — same names/signatures as the legacy REST versions, but
 * backed by Electron IPC. The backend returns legacy-compatible shapes, so
 * consuming pages are unchanged. The 5s refetch polling of the web version
 * is removed (IPC queries are local and stay fresh via invalidation).
 */

// Local-user contract: workspace == institution
const qk = {
  departments: ["departments"],
  classrooms: ["classrooms"],
  faculty: ["faculty"],
  sections: ["sections"],
  subjects: ["subjects"],
  timeSlots: ["time-slots"],
  timetable: ["timetable"],
};

// === DEPARTMENTS ===
export function useDepartments() {
  return useQuery({
    queryKey: qk.departments,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.departments.list(institutionId);
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const institutionId = await getInstitutionId();
      return window.api.departments.create({ ...data, institutionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => window.api.departments.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => window.api.departments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

// === CLASSROOMS ===
export function useClassrooms() {
  return useQuery({
    queryKey: qk.classrooms,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.classrooms.list(institutionId);
    },
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const institutionId = await getInstitutionId();
      return window.api.classrooms.create({
        ...data,
        capacity: Number(data.capacity ?? 0),
        institutionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.classrooms });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useUpdateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) =>
      window.api.classrooms.update(id, { ...data, capacity: Number(data.capacity ?? 0) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.classrooms });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useDeleteClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => window.api.classrooms.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.classrooms });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

// === FACULTY (teachers) ===
export function useFaculty() {
  return useQuery({
    queryKey: qk.faculty,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.teachers.list(institutionId);
    },
  });
}

export function useCreateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const institutionId = await getInstitutionId();
      return window.api.teachers.create({ ...data, institutionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.faculty });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useUpdateFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => window.api.teachers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.faculty });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => window.api.teachers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.faculty });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

// === SECTIONS ===
export function useSections() {
  return useQuery({
    queryKey: qk.sections,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.sections.list(institutionId);
    },
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const institutionId = await getInstitutionId();
      return window.api.sections.create({
        ...data,
        year: data.year != null ? Number(data.year) : null,
        semester: data.semester != null ? Number(data.semester) : null,
        institutionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sections });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) =>
      window.api.sections.update(id, {
        ...data,
        year: data.year != null ? Number(data.year) : null,
        semester: data.semester != null ? Number(data.semester) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sections });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => window.api.sections.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.sections });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

// === SUBJECTS ===
export function useSubjects() {
  return useQuery({
    queryKey: qk.subjects,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.subjects.list(institutionId);
    },
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const institutionId = await getInstitutionId();
      return window.api.subjects.create({
        ...data,
        weeklyHours: Number(data.weeklyHours ?? 1),
        facultyId: data.facultyId ? Number(data.facultyId) : null,
        sectionId: data.sectionId ? Number(data.sectionId) : null,
        institutionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.subjects });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) =>
      window.api.subjects.update(id, {
        ...data,
        weeklyHours: Number(data.weeklyHours ?? 1),
        facultyId: data.facultyId ? Number(data.facultyId) : null,
        sectionId: data.sectionId ? Number(data.sectionId) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.subjects });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => window.api.subjects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.subjects });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

// === TIME SLOTS ===
export function useTimeSlots() {
  return useQuery({
    queryKey: qk.timeSlots,
    queryFn: async () => {
      const institutionId = await getInstitutionId();
      return window.api.timeSlots.list(institutionId);
    },
  });
}

export function useCreateTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const institutionId = await getInstitutionId();
      return window.api.timeSlots.create({ ...data, sortOrder: Number(data.sortOrder ?? 0), institutionId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeSlots });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useUpdateTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) =>
      window.api.timeSlots.update(id, { ...data, sortOrder: Number(data.sortOrder ?? 0) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeSlots });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}

export function useDeleteTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => window.api.timeSlots.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.timeSlots });
      queryClient.invalidateQueries({ queryKey: qk.timetable });
    },
  });
}
