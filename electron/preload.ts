/**
 * Preload — the ONLY bridge between the sandboxed renderer and the main
 * process. Exposes narrow, promise-based namespaces; no Node/Electron APIs
 * leak into the renderer (spec §1/§22).
 */
import { contextBridge, ipcRenderer } from "electron";

/** Invoke a validated channel and unwrap the {ok, data|error} envelope. */
async function invoke<T = unknown>(channel: string, args?: unknown): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, args)) as
    | { ok: true; data: T }
    | { ok: false; error: string };
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

const api = {
  system: {
    version: () => invoke("api:system:version"),
    openPath: (kind: "backups" | "exports" | "imports" | "reports" | "logs" | "database") =>
      invoke("api:system:openPath", kind),
    quit: () => invoke("api:system:quit"),
  },
  database: {
    status: () => invoke("api:database:status"),
  },
  institutions: {
    list: () => invoke("api:institutions:list"),
    create: (data: unknown) => invoke("api:institutions:create", data),
    update: (id: number, data: unknown) => invoke("api:institutions:update", { id, data }),
    delete: (id: number) => invoke("api:institutions:delete", id),
  },
  academicYears: {
    list: (institutionId?: number) => invoke("api:academicYears:list", institutionId),
    create: (data: unknown) => invoke("api:academicYears:create", data),
    activate: (institutionId: number, yearId: number) =>
      invoke("api:academicYears:activate", { institutionId, yearId }),
    delete: (id: number) => invoke("api:academicYears:delete", id),
  },
  departments: {
    list: (institutionId?: number) => invoke("api:departments:list", institutionId),
    create: (data: unknown) => invoke("api:departments:create", data),
    update: (id: number, data: unknown) => invoke("api:departments:update", { id, data }),
    delete: (id: number) => invoke("api:departments:delete", id),
  },
  classes: {
    list: (institutionId?: number) => invoke("api:classes:list", institutionId),
    create: (data: unknown) => invoke("api:classes:create", data),
    update: (id: number, data: unknown) => invoke("api:classes:update", { id, data }),
    delete: (id: number) => invoke("api:classes:delete", id),
  },
  sections: {
    list: (institutionId?: number) => invoke("api:sections:list", institutionId),
    create: (data: unknown) => invoke("api:sections:create", data),
    update: (id: number, data: unknown) => invoke("api:sections:update", { id, data }),
    delete: (id: number) => invoke("api:sections:delete", id),
  },
  teachers: {
    list: (institutionId?: number) => invoke("api:teachers:list", institutionId),
    create: (data: unknown) => invoke("api:teachers:create", data),
    update: (id: number, data: unknown) => invoke("api:teachers:update", { id, data }),
    delete: (id: number) => invoke("api:teachers:delete", id),
    getAvailability: (teacherId: number) => invoke("api:teachers:getAvailability", teacherId),
    setAvailability: (teacherId: number, slotIds: number[], available: boolean) =>
      invoke("api:teachers:setAvailability", { teacherId, slotIds, available }),
  },
  classrooms: {
    list: (institutionId?: number) => invoke("api:classrooms:list", institutionId),
    create: (data: unknown) => invoke("api:classrooms:create", data),
    update: (id: number, data: unknown) => invoke("api:classrooms:update", { id, data }),
    delete: (id: number) => invoke("api:classrooms:delete", id),
  },
  timeSlots: {
    list: (institutionId?: number) => invoke("api:timeSlots:list", institutionId),
    create: (data: unknown) => invoke("api:timeSlots:create", data),
    update: (id: number, data: unknown) => invoke("api:timeSlots:update", { id, data }),
    delete: (id: number) => invoke("api:timeSlots:delete", id),
  },
  subjects: {
    list: (institutionId?: number) => invoke("api:subjects:list", institutionId),
    create: (data: unknown) => invoke("api:subjects:create", data),
    update: (id: number, data: unknown) => invoke("api:subjects:update", { id, data }),
    delete: (id: number) => invoke("api:subjects:delete", id),
    assignments: {
      list: (filter?: { sectionId?: number; subjectId?: number }) =>
        invoke("api:subjectAssignments:list", filter),
      create: (data: unknown) => invoke("api:subjectAssignments:create", data),
      update: (id: number, data: unknown) => invoke("api:subjectAssignments:update", { id, data }),
      delete: (id: number) => invoke("api:subjectAssignments:delete", id),
    },
  },
  timetable: {
    entries: (filters?: { versionId?: number; sectionId?: number; teacherId?: number; classroomId?: number }) =>
      invoke("api:timetable:entries", filters),
    versions: (institutionId?: number) => invoke("api:timetable:versions", institutionId),
  },
  dashboard: {
    stats: (institutionId: number) => invoke("api:dashboard:stats", institutionId),
  },
  backup: {
    list: () => invoke("api:backup:list"),
    create: (label?: string) => invoke("api:backup:create", label),
    restore: (id: string) => invoke("api:backup:restore", { id }),
    delete: (id: string) => invoke("api:backup:delete", { id }),
    verify: (id: string) => invoke("api:backup:verify", { id }),
  },
  settings: {
    all: () => invoke("api:settings:all"),
    get: (key: string) => invoke("api:settings:get", key),
    set: (key: string, value: unknown) => invoke("api:settings:set", { key, value }),
  },
  data: {
    resetAll: () => invoke("api:data:resetAll"),
  },
  // scheduler / excel / pdf / updater are added in their respective phases
};

// Type-only declaration merged by the renderer via global.d.ts
contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
