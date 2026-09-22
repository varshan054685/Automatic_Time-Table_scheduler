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
    integrity: () => invoke("api:database:integrity"),
  },
  institutions: {
    // Single-user desktop app: `current` resolves (creating on first run) the
    // one local institution and its active academic year.
    current: () => invoke("api:institutions:current"),
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
  },
  timetable: {
    entries: (filters?: { versionId?: number; sectionId?: number; teacherId?: number; classroomId?: number }) =>
      invoke("api:timetable:entries", filters),
    versions: (institutionId?: number) => invoke("api:timetable:versions", institutionId),
    conflicts: (institutionId?: number) => invoke("api:timetable:conflicts", institutionId),
    activateVersion: (versionId: number) => invoke("api:timetable:activateVersion", versionId),
    deleteVersion: (versionId: number) => invoke("api:timetable:deleteVersion", versionId),
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
  scheduler: {
    /** Ensure the local Python solver is up (spawns it on first use). */
    ready: () => invoke("api:scheduler:ready"),
    /** Start a generation job; resolves immediately with { jobId }. */
    generate: (opts?: { allSections?: boolean; sectionIds?: number[]; institutionId?: number; timeLimitSeconds?: number }) =>
      invoke("api:scheduler:generate", opts),
    cancel: (jobId: number) => invoke("api:scheduler:cancel", jobId),
    job: (jobId: number) => invoke("api:scheduler:job", jobId),
    history: (institutionId?: number) => invoke("api:scheduler:history", institutionId),
    /** Rows written to staging by a finished job (preview before accepting). */
    staged: (jobId: number) => invoke("api:scheduler:staged", jobId),
    /** User-approved promote of staged results → new active timetable version. */
    accept: (jobId: number, label?: string) => invoke("api:scheduler:accept", { jobId, label }),
    discard: (jobId: number) => invoke("api:scheduler:discard", jobId),
    /** Pre-flight feasibility audit (no solving) for actionable diagnostics. */
    audit: (opts?: { institutionId?: number; sectionIds?: number[] }) => invoke("api:scheduler:audit", opts),
    /** Progress push events — returns an unsubscribe function. */
    onProgress: (cb: (progress: Record<string, unknown>) => void) => {
      const listener = (_e: unknown, payload: Record<string, unknown>) => cb(payload);
      ipcRenderer.on("scheduler:progress", listener);
      return () => ipcRenderer.removeListener("scheduler:progress", listener);
    },
  },
  excel: {
    /** Pick a workbook, validate it and get a row-level report (writes nothing). */
    preview: (kind: string, institutionId?: number) =>
      invoke("api:excel:preview", { kind, institutionId }),
    /** Apply the valid rows of a previewed batch (user-approved). */
    commit: (batchId: number) => invoke("api:excel:commit", { batchId }),
    /** Save a blank import template to a chosen path. */
    template: (kind: string) => invoke("api:excel:template", { kind }),
    /** Export data rows directly to an Excel file (opens save dialog at previous location). */
    exportData: (kind: string, data: Record<string, unknown>[], defaultFileName?: string) =>
      invoke("api:excel:exportData", { kind, data, defaultFileName }),
    /** Recent import batches (audit trail). */
    batches: () => invoke("api:excel:batches"),
  },
  pdf: {
    /**
     * Export a report to PDF via the system save dialog. `kind` is one of
     * timetable | teacherWorkload | roomUtilization | analytics.
     */
    exportReport: (kind: string, opts?: { sectionId?: number; departmentId?: number; institutionId?: number }) =>
      invoke("api:pdf:export", { kind, ...(opts ?? {}) }),
  },
  updater: {
    status: () => invoke("api:updater:status"),
    check: () => invoke("api:updater:check"),
    download: () => invoke("api:updater:download"),
    install: () => invoke("api:updater:install"),
    setAutoOption: (key: "autoCheck" | "autoDownload", value: boolean) =>
      invoke("api:updater:setAutoOption", { key, value }),
    onEvent: (cb: (status: Record<string, unknown>) => void) => {
      const listener = (_e: unknown, payload: Record<string, unknown>) => cb(payload);
      ipcRenderer.on("updater:event", listener);
      return () => ipcRenderer.removeListener("updater:event", listener);
    },
  },
};

// Type-only declaration merged by the renderer via global.d.ts
contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
