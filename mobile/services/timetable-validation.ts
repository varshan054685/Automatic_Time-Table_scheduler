/**
 * Offline timetable validation (Phase B).
 *
 * Runs entirely on local SQLite data. Detects the same core constraints the
 * server's OR-Tools solver enforces:
 *   - a faculty member assigned to two classes at once
 *   - a classroom assigned to two classes at once
 *   - a section assigned to two classes at once
 *   - entries referencing deleted/missing master data
 *   - invalid time-slot references
 *
 * Used by the Timetable screen for inline conflict indicators and by the
 * Generate screen before/after local generation. The cloud OR-Tools solver
 * remains the authoritative optimizer — this is validation only.
 */
import { getDb } from "@/database/sqlite";
import { listTimetableEntries } from "@/database/repositories/timetable";
import { TimetableEntry } from "@/types";

export type ConflictKind =
  | "faculty_double_booking"
  | "classroom_double_booking"
  | "section_double_booking"
  | "missing_faculty"
  | "missing_classroom"
  | "missing_subject"
  | "missing_time_slot";

export interface TimetableConflict {
  kind: ConflictKind;
  /** Human-readable description for the UI. */
  message: string;
  entryIds: number[];
  /** Time-slot label for display. */
  slotLabel: string;
  dayOfWeek?: string;
}

export interface TimetableHealth {
  totalEntries: number;
  conflicts: TimetableConflict[];
  healthy: boolean;
}

function slotKey(entry: Pick<TimetableEntry, "timeSlotId">): string {
  return String(entry.timeSlotId);
}

/**
 * Validate all timetable entries in a workspace (optionally for one section).
 * Pure local check — no network involved.
 */
export function validateTimetable(
  workspaceId: number,
  opts?: { sectionId?: number },
): TimetableHealth {
  const entries = listTimetableEntries(workspaceId, opts?.sectionId);
  const conflicts: TimetableConflict[] = [];

  // ── 1. Double bookings per faculty / classroom / section ──
  const byFaculty = new Map<string, TimetableEntry[]>();
  const byClassroom = new Map<string, TimetableEntry[]>();
  const bySection = new Map<string, TimetableEntry[]>();

  for (const e of entries) {
    const kf = `${e.facultyId}:${slotKey(e)}`;
    byFaculty.set(kf, [...(byFaculty.get(kf) ?? []), e]);
    const kc = `${e.classroomId}:${slotKey(e)}`;
    byClassroom.set(kc, [...(byClassroom.get(kc) ?? []), e]);
    const ks = `${e.sectionId}:${slotKey(e)}`;
    bySection.set(ks, [...(bySection.get(ks) ?? []), e]);
  }

  for (const group of byFaculty.values()) {
    const first = group[0];
    if (group.length > 1 && first) {
      conflicts.push({
        kind: "faculty_double_booking",
        message: `Faculty member is booked ${group.length} times in the same period.`,
        entryIds: group.map((g) => Number(g.id)),
        slotLabel: slotLabelOf(first),
      });
    }
  }
  for (const group of byClassroom.values()) {
    const first = group[0];
    if (group.length > 1 && first) {
      conflicts.push({
        kind: "classroom_double_booking",
        message: `Classroom is booked ${group.length} times in the same period.`,
        entryIds: group.map((g) => Number(g.id)),
        slotLabel: slotLabelOf(first),
      });
    }
  }
  for (const group of bySection.values()) {
    const first = group[0];
    if (group.length > 1 && first) {
      conflicts.push({
        kind: "section_double_booking",
        message: `Section has ${group.length} classes in the same period.`,
        entryIds: group.map((g) => Number(g.id)),
        slotLabel: slotLabelOf(first),
      });
    }
  }

  // ── 2. Referential integrity (missing master data) ──
  const validFaculty = new Set(facultyIds(workspaceId));
  const validClassrooms = new Set(classroomIds(workspaceId));
  const validSubjects = new Set(subjectIds(workspaceId));
  const validSlots = new Set(timeSlotIds(workspaceId));

  for (const e of entries) {
    if (!validFaculty.has(Number(e.facultyId))) {
      conflicts.push({
        kind: "missing_faculty",
        message: "Entry references a faculty member that no longer exists.",
        entryIds: [Number(e.id)],
        slotLabel: slotLabelOf(e),
      });
    }
    if (!validClassrooms.has(Number(e.classroomId))) {
      conflicts.push({
        kind: "missing_classroom",
        message: "Entry references a classroom that no longer exists.",
        entryIds: [Number(e.id)],
        slotLabel: slotLabelOf(e),
      });
    }
    if (!validSubjects.has(Number(e.subjectId))) {
      conflicts.push({
        kind: "missing_subject",
        message: "Entry references a subject that no longer exists.",
        entryIds: [Number(e.id)],
        slotLabel: slotLabelOf(e),
      });
    }
    if (!validSlots.has(Number(e.timeSlotId))) {
      conflicts.push({
        kind: "missing_time_slot",
        message: "Entry references a time slot that no longer exists.",
        entryIds: [Number(e.id)],
        slotLabel: "—",
      });
    }
  }

  return {
    totalEntries: entries.length,
    conflicts,
    healthy: conflicts.length === 0,
  };
}

function slotLabelOf(entry: TimetableEntry): string {
  // Entries reference SERVER time-slot ids; local rows carry server_id.
  const row = getDb().getFirstSync<{ label: string; day_of_week: string }>(
    `SELECT "label", "day_of_week" FROM "time_slot" WHERE "server_id" = ?`,
    [entry.timeSlotId],
  );
  return row ? `${row.day_of_week} · ${row.label}` : `Period ${entry.timeSlotId}`;
}

function facultyIds(workspaceId: number): number[] {
  const rows = getDb().getAllSync(
    `SELECT "server_id" FROM "faculty" WHERE "workspace_id" = ? AND "deleted_at" IS NULL`,
    [workspaceId],
  );
  return rows.map((r) => Number((r as { server_id: number }).server_id));
}

function classroomIds(workspaceId: number): number[] {
  const rows = getDb().getAllSync(
    `SELECT "server_id" FROM "classroom" WHERE "workspace_id" = ? AND "deleted_at" IS NULL`,
    [workspaceId],
  );
  return rows.map((r) => Number((r as { server_id: number }).server_id));
}

function subjectIds(workspaceId: number): number[] {
  const rows = getDb().getAllSync(
    `SELECT "server_id" FROM "subject" WHERE "workspace_id" = ? AND "deleted_at" IS NULL`,
    [workspaceId],
  );
  return rows.map((r) => Number((r as { server_id: number }).server_id));
}

function timeSlotIds(workspaceId: number): number[] {
  const rows = getDb().getAllSync(
    `SELECT "server_id" FROM "time_slot" WHERE "workspace_id" = ? AND "deleted_at" IS NULL`,
    [workspaceId],
  );
  return rows.map((r) => Number((r as { server_id: number }).server_id));
}
