/**
 * IPC registration. Every channel is narrow, named `api:<domain>:<action>`,
 * and validates its arguments with zod before touching services (spec §1/§22).
 * Handlers return `{ ok: true, data }` or `{ ok: false, error }` — never raw throws.
 *
 * Output shapes follow the legacy UI contract (camelCase rows, day names in
 * time_slots, nested timetable entries) so the existing React pages keep
 * working unchanged.
 */
import { ipcMain, shell, app } from "electron";
import { z } from "zod";
import path from "path";
import { getAppPaths } from "../services/paths";
import { getDb, getSchemaVersion } from "../services/database";
import {
  list, insertRow, updateRow, deleteRow,
  getOrCreateDefaultInstitution, createInstitutionWithYear, activateAcademicYear, getActiveYear,
  getTeacherAvailability, setTeacherAvailability,
  getTimetableEntries, getDashboardStats,
} from "../services/crud";
import {
  createBackup, listBackups, deleteBackup, verifyBackupFile,
} from "../services/backup";
import { getSetting, setSetting, getAllSettings } from "../services/settings";
import { log, logError } from "../services/logger";
import { dayNameToIndex } from "../services/days";
import * as S from "./schemas";

type Handler = (args: unknown) => Promise<unknown> | unknown;

const handlers = new Map<string, { schema: z.ZodTypeAny | null; fn: Handler }>();

function register(channel: string, schema: z.ZodTypeAny | null, fn: Handler): void {
  handlers.set(channel, { schema, fn });
}

export function registerAllIpc(): void {
  // ─── system ────────────────────────────────────────────────────────────
  register("api:system:version", null, () => ({
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    schemaVersion: getSchemaVersion(getDb()),
    paths: getAppPaths(),
  }));

  register("api:system:quit", null, () => {
    app.quit();
    return { ok: true };
  });

  register("api:system:openPath", z.enum(["backups", "exports", "imports", "reports", "logs", "database"]), (kind) => {
    const paths = getAppPaths();
    const dirMap: Record<string, string> = {
      backups: paths.backupsDir,
      exports: paths.exportsDir,
      imports: paths.importsDir,
      reports: paths.reportsDir,
      logs: paths.logsDir,
      database: paths.databaseDir,
    };
    const dir = dirMap[kind as string];
    if (!dir) throw new Error(`Unknown path kind: ${String(kind)}`);
    return shell.openPath(dir);
  });

  // ─── local user + institution (legacy workspace-compatible contract) ───
  register("api:user:current", null, () => {
    const inst = getOrCreateDefaultInstitution();
    const year = getActiveYear(inst.id as number);
    const displayName = (getSetting("profile.name", "") as string) || "Local User";
    return {
      id: 1,
      name: displayName,
      email: null,
      workspace: {
        id: inst.id,
        workspaceName: inst.name,
        role: "owner",
        academicYear: year?.name ?? null,
        institutionType: inst.type,
      },
    };
  });

  register("api:institutions:current", null, () => {
    const inst = getOrCreateDefaultInstitution();
    const year = getActiveYear(inst.id as number);
    return { ...inst, academicYear: year?.name ?? null, activeYearId: year?.id ?? null };
  });
  register("api:institutions:update", z.object({ id: S.idSchema, data: S.institutionUpdate }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> };
    return updateRow("institutions", id, data);
  });

  register("api:academicYears:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("academic_years", "institution_id = ?", [institutionId]) : list("academic_years"));
  register("api:academicYears:create", S.academicYearInput, (a) => {
    const { institutionId, ...rest } = a as { institutionId: number } & Record<string, unknown>;
    return insertRow("academic_years", { institutionId, ...rest });
  });
  register("api:academicYears:activate", z.object({ institutionId: S.idSchema, yearId: S.idSchema }), (a) => {
    const { institutionId, yearId } = a as { institutionId: number; yearId: number };
    activateAcademicYear(institutionId, yearId);
    return { ok: true };
  });
  register("api:academicYears:delete", S.idSchema, (id) => deleteRow("academic_years", id as number));

  // ─── master data ───────────────────────────────────────────────────────
  register("api:departments:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("departments", "institution_id = ?", [institutionId]) : list("departments"));
  register("api:departments:create", S.departmentInput, (a) => {
    const { institutionId, ...rest } = a as { institutionId: number } & Record<string, unknown>;
    return insertRow("departments", { institutionId, ...rest });
  });
  register("api:departments:update", z.object({ id: S.idSchema, data: S.departmentInput.partial() }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> };
    return updateRow("departments", id, data);
  });
  register("api:departments:delete", S.idSchema, (id) => deleteRow("departments", id as number));

  register("api:sections:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("sections", "institution_id = ?", [institutionId]) : list("sections"));
  register("api:sections:create", S.sectionInput, (a) => {
    const d = a as {
      institutionId: number; departmentId: number; classId?: number | null;
      name: string; year?: number | null; semester?: number | null;
      strength?: number | null; defaultClassroomId?: number | null;
    };
    return insertRow("sections", {
      institutionId: d.institutionId,
      departmentId: d.departmentId,
      classId: d.classId ?? null,
      name: d.name,
      year: d.year ?? null,
      semester: d.semester ?? null,
      strength: d.strength ?? null,
      defaultClassroomId: d.defaultClassroomId ?? null,
    });
  });
  register("api:sections:update", z.object({ id: S.idSchema, data: S.sectionInput.partial() }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> };
    return updateRow("sections", id, data);
  });
  register("api:sections:delete", S.idSchema, (id) => deleteRow("sections", id as number));

  register("api:teachers:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("teachers", "institution_id = ?", [institutionId]) : list("teachers"));
  register("api:teachers:create", S.teacherInput, (a) => {
    const { institutionId, ...rest } = a as { institutionId: number } & Record<string, unknown>;
    return insertRow("teachers", { institutionId, ...rest });
  });
  register("api:teachers:update", z.object({ id: S.idSchema, data: S.teacherInput.partial() }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> };
    return updateRow("teachers", id, data);
  });
  register("api:teachers:delete", S.idSchema, (id) => deleteRow("teachers", id as number));
  register("api:teachers:getAvailability", S.idSchema, (teacherId) => getTeacherAvailability(teacherId as number));
  register("api:teachers:setAvailability", S.availabilityInput, (a) => {
    const { teacherId, slotIds, available } = a as { teacherId: number; slotIds: number[]; available: boolean };
    setTeacherAvailability(teacherId, slotIds, available);
    return { ok: true };
  });

  register("api:classrooms:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("classrooms", "institution_id = ?", [institutionId]) : list("classrooms"));
  register("api:classrooms:create", S.classroomInput, (a) => {
    const { institutionId, ...rest } = a as { institutionId: number } & Record<string, unknown>;
    return insertRow("classrooms", { institutionId, ...rest });
  });
  register("api:classrooms:update", z.object({ id: S.idSchema, data: S.classroomInput.partial() }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> };
    return updateRow("classrooms", id, data);
  });
  register("api:classrooms:delete", S.idSchema, (id) => deleteRow("classrooms", id as number));

  register("api:timeSlots:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("time_slots", "institution_id = ?", [institutionId]) : list("time_slots"));
  register("api:timeSlots:create", S.timeSlotInput, (a) => {
    const d = a as { institutionId: number; dayOfWeek: string | number; startTime: string; endTime: string; label: string; type: string; sortOrder: number };
    const dayIndex = typeof d.dayOfWeek === "number" ? d.dayOfWeek : dayNameToIndex(d.dayOfWeek);
    return insertRow("time_slots", {
      institutionId: d.institutionId,
      dayOfWeek: dayIndex,
      startTime: d.startTime,
      endTime: d.endTime,
      label: d.label,
      type: d.type,
      sortOrder: d.sortOrder,
    });
  });
  register("api:timeSlots:update", z.object({ id: S.idSchema, data: S.timeSlotInput.partial() }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> & { dayOfWeek?: string | number } };
    const mapped = { ...data };
    if (typeof mapped.dayOfWeek === "string") {
      mapped.dayOfWeek = dayNameToIndex(mapped.dayOfWeek);
    }
    return updateRow("time_slots", id, mapped);
  });
  register("api:timeSlots:delete", S.idSchema, (id) => deleteRow("time_slots", id as number));

  register("api:subjects:list", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("subjects", "institution_id = ?", [institutionId]) : list("subjects"));
  register("api:subjects:create", S.subjectInput, (a) => insertRow("subjects", a as Record<string, unknown>));
  register("api:subjects:update", z.object({ id: S.idSchema, data: S.subjectInput.partial() }), (a) => {
    const { id, data } = a as { id: number; data: Record<string, unknown> };
    return updateRow("subjects", id, data);
  });
  register("api:subjects:delete", S.idSchema, (id) => deleteRow("subjects", id as number));

  // ─── timetable & dashboard ─────────────────────────────────────────────
  register(
    "api:timetable:entries",
    S.timetableFilters.partial().extend({ institutionId: S.optionalIdSchema }),
    (a) => getTimetableEntries((a ?? {}) as never)
  );
  register("api:timetable:versions", S.optionalIdSchema, (institutionId) =>
    institutionId ? list("timetable_versions", "institution_id = ?", [institutionId]) : list("timetable_versions"));
  register("api:dashboard:stats", S.idSchema, (institutionId) => getDashboardStats(institutionId as number));

  // ─── backups ───────────────────────────────────────────────────────────
  // NOTE: api:backup:restore is re-registered in main.ts (handleRestore) because
  // the DB connection must be closed around the file swap.
  register("api:backup:list", null, () => listBackups());
  register("api:backup:create", z.string().max(50).optional(), (label) => createBackup(label as string | undefined));
  register("api:backup:restore", S.backupRestoreInput, () => {
    throw new Error("handled by main"); // replaced in main.ts via handleRestore
  });
  register("api:backup:delete", S.backupRestoreInput, (a) => {
    deleteBackup((a as { id: string }).id);
    return { ok: true };
  });
  register("api:backup:verify", S.backupRestoreInput, (a) => {
    const filePath = path.join(getAppPaths().backupsDir, path.basename((a as { id: string }).id));
    return verifyBackupFile(filePath);
  });

  // ─── settings ──────────────────────────────────────────────────────────
  register("api:settings:all", null, () => getAllSettings());
  register("api:settings:get", z.string().min(1).max(100), (key) => getSetting(key as string));
  register("api:settings:set", S.settingsInput, (a) => {
    const { key, value } = a as { key: string; value: unknown };
    setSetting(key, value);
    return { ok: true };
  });

  // ─── data management (danger zone) ─────────────────────────────────────
  register("api:data:resetAll", null, () => {
    const db = getDb();
    const wipe = db.transaction(() => {
      // Order matters with foreign keys ON. app_settings is intentionally kept
      // (it holds only local prefs like profile name).
      for (const table of [
        "generation_results_staging",
        "generation_job_sections",
        "generation_jobs",
        "timetable_entries",
        "timetable_versions",
        "teacher_availability",
        "subjects",
        "sections",
        "classes",
        "teachers",
        "classrooms",
        "time_slots",
        "departments",
        "academic_years",
        "institutions",
        "import_batches",
      ]) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
    });
    wipe();
    log("All academic data reset (danger zone)", "db");
    return { ok: true };
  });

  // Keep log for diagnostics
  log(`IPC registered: ${handlers.size} channels`, "ipc");
}

/**
 * Wrap a restore: the DB connection must be closed before the file swap.
 * Called from main.ts, which re-initializes the DB afterwards.
 */
export async function handleRestore(args: { id: string }): Promise<unknown> {
  const { closeDatabase, initDatabase } = await import("../services/database");
  const { restoreBackup } = await import("../services/backup");
  closeDatabase();
  try {
    return await restoreBackup(args.id);
  } finally {
    await initDatabase();
  }
}

/** Activate all registered handlers with a uniform validated wrapper. */
export function activateIpc(): void {
  for (const [channel, { schema, fn }] of handlers) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (_event, args: unknown) => {
      try {
        if (schema) {
          const parsed = schema.safeParse(args);
          if (!parsed.success) {
            logError(`IPC ${channel}: invalid args`, parsed.error.message, "ipc");
            return { ok: false, error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
          }
        }
        const data = await fn(args);
        return { ok: true, data };
      } catch (err) {
        logError(`IPC ${channel} failed`, err, "ipc");
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    });
  }
}
