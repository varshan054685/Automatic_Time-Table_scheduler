/**
 * Local-data hooks.
 *
 * Reads go straight to SQLite (offline-first). In later phases the sync engine
 * invalidates these query keys after downloads/uploads, keeping them fresh.
 */
import { useQuery } from "@tanstack/react-query";
import {
  departmentRepo,
  classroomRepo,
  facultyRepo,
  sectionRepo,
  subjectRepo,
  timeSlotRepo,
} from "@/database/repositories/master-data";
import { listTimetableEntries } from "@/database/repositories/timetable";
import { listChangeRequests } from "@/database/repositories/change-requests";
import { countPendingOperations } from "@/database/repositories/sync";
import { countConflicts } from "@/sync/conflict-resolution";
import { useSession } from "./use-session";
import { getDb } from "@/database/sqlite";
import { Department, Classroom, Faculty, Section, Subject, TimeSlot } from "@/types";

export const localQueryKeys = {
  departments: ["local", "departments"] as const,
  classrooms: ["local", "classrooms"] as const,
  faculty: ["local", "faculty"] as const,
  sections: ["local", "sections"] as const,
  subjects: ["local", "subjects"] as const,
  timeSlots: ["local", "timeSlots"] as const,
  timetable: ["local", "timetable"] as const,
  changeRequests: ["local", "changeRequests"] as const,
  pendingOps: ["local", "pendingOps"] as const,
  dbStats: ["local", "dbStats"] as const,
};

function useWorkspaceId(): number | null {
  return useSession().session?.workspace?.id ?? null;
}

export function useDepartments() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.departments,
    enabled: workspaceId != null,
    queryFn: () => departmentRepo.listForWorkspace<Department>(workspaceId as number),
  });
}

export function useClassrooms() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.classrooms,
    enabled: workspaceId != null,
    queryFn: () => classroomRepo.listForWorkspace<Classroom>(workspaceId as number),
  });
}

export function useFaculty() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.faculty,
    enabled: workspaceId != null,
    queryFn: () => facultyRepo.listForWorkspace<Faculty>(workspaceId as number),
  });
}

export function useSections() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.sections,
    enabled: workspaceId != null,
    queryFn: () => sectionRepo.listForWorkspace<Section>(workspaceId as number),
  });
}

export function useSubjects() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.subjects,
    enabled: workspaceId != null,
    queryFn: () => subjectRepo.listForWorkspace<Subject>(workspaceId as number),
  });
}

export function useTimeSlots() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.timeSlots,
    enabled: workspaceId != null,
    queryFn: () => timeSlotRepo.listForWorkspace<TimeSlot>(workspaceId as number),
  });
}

export function useTimetableEntries(params?: { sectionId?: number; facultyId?: number }) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...localQueryKeys.timetable, params ?? {}],
    enabled: workspaceId != null,
    queryFn: () =>
      listTimetableEntries(
        workspaceId as number,
        params?.sectionId,
        params?.facultyId,
      ),
  });
}

export function useChangeRequests() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.changeRequests,
    enabled: workspaceId != null,
    queryFn: () => listChangeRequests(workspaceId as number),
  });
}

export function usePendingOpCount() {
  return useQuery({
    queryKey: localQueryKeys.pendingOps,
    queryFn: () => countPendingOperations(),
  });
}

export function useConflictCount() {
  return useQuery({
    queryKey: ["local", "conflicts"] as const,
    queryFn: () => countConflicts(),
  });
}

export interface DbStats {
  workspaceCount: number;
  memberCount: number;
  departmentCount: number;
  classroomCount: number;
  facultyCount: number;
  sectionCount: number;
  subjectCount: number;
  timeSlotCount: number;
  timetableEntryCount: number;
  changeRequestCount: number;
  pendingOpCount: number;
  dbSizeBytes: number;
}

export function useDbStats() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: localQueryKeys.dbStats,
    enabled: workspaceId != null,
    queryFn: (): DbStats => {
      const db = getDb();
      const count = (table: string) => {
        const row = db.getFirstSync<{ n: number }>(
          `SELECT COUNT(*) AS n FROM "${table}" WHERE "deleted_at" IS NULL`,
        );
        return row?.n ?? 0;
      };
      const sizeRow = db.getFirstSync<{ size: number }>(
        "SELECT page_count * page_size AS size FROM pragma_page_count(), pragma_page_size()",
      );
      return {
        workspaceCount: count("workspace"),
        memberCount: count("workspace_member"),
        departmentCount: count("department"),
        classroomCount: count("classroom"),
        facultyCount: count("faculty"),
        sectionCount: count("section"),
        subjectCount: count("subject"),
        timeSlotCount: count("time_slot"),
        timetableEntryCount: count("timetable_entry"),
        changeRequestCount: count("change_request"),
        pendingOpCount: countPendingOperations(),
        dbSizeBytes: sizeRow?.size ?? 0,
      };
    },
  });
}

/** Number of rows in each synced table — used by the Data screen shell. */
export function useMasterDataCounts() {
  const { data: departments } = useDepartments();
  const { data: classrooms } = useClassrooms();
  const { data: faculty } = useFaculty();
  const { data: sections } = useSections();
  const { data: subjects } = useSubjects();
  const { data: timeSlots } = useTimeSlots();
  return {
    departments: departments?.length ?? 0,
    classrooms: classrooms?.length ?? 0,
    faculty: faculty?.length ?? 0,
    sections: sections?.length ?? 0,
    subjects: subjects?.length ?? 0,
    timeSlots: timeSlots?.length ?? 0,
  };
}
