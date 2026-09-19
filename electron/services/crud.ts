/**
 * Typed CRUD helpers over the SQLite schema. All functions run through the
 * single main-process DB connection; IPC handlers wrap these with validation.
 *
 * Output shape note: the existing React UI expects the legacy API contract —
 * camelCase rows, day names in time_slots, nested timetable entries. The DB
 * stores day_of_week as 0-6; day-name mapping happens here (UI contract).
 */
import { getDb, inTransaction } from "./database";
import { idSchema } from "../ipc/schemas";
import { mapRow, mapRows } from "./shape";
import { dayIndexToName } from "./days";

export interface Row {
  id: number;
  [key: string]: unknown;
}



function assertId(id: unknown): number {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new Error("Invalid id");
  return parsed.data;
}

const ALLOWED_TABLES = new Set([
  "institutions", "academic_years", "departments", "classes", "sections",
  "teachers", "classrooms", "time_slots", "subjects",
  "teacher_availability", "timetable_versions", "timetable_entries",
  "generation_jobs", "generation_job_sections", "generation_results_staging",
  "import_batches", "app_settings",
]);

function assertTableName(table: string): void {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Unknown table: ${table}`);
}

/** Internal raw list (snake_case rows). */
function rawList(table: string, where = "1=1", params: unknown[] = []): Row[] {
  assertTableName(table);
  const hasOrder = /\bORDER\s+BY\b/i.test(where);
  const sql = hasOrder
    ? `SELECT * FROM ${table} WHERE ${where}`
    : `SELECT * FROM ${table} WHERE ${where} ORDER BY id`;
  return getDb()
    .prepare(sql)
    .all(...params) as Row[];
}

/** Public list — camelCase rows for the renderer. */
export function list(table: string, where = "1=1", params: unknown[] = []): Row[] {
  return mapRows(rawList(table, where, params));
}

export function getOne(table: string, id: number): Row | undefined {
  assertTableName(table);
  const row = mapRow(getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(assertId(id))) as Row | undefined;
  if (row && table === "time_slots" && typeof row.dayOfWeek === "number") {
    row.dayOfWeek = dayIndexToName(row.dayOfWeek);
  }
  return row;
}

export function getTimeSlots(institutionId?: number): Row[] {
  const where = institutionId ? "institution_id = ?" : "1=1";
  const params = institutionId ? [institutionId] : [];
  const rows = rawList("time_slots", `${where} ORDER BY day_of_week, sort_order, start_time`, params);
  return rows.map((r) => {
    const mapped = mapRow(r) as Row;
    if (typeof mapped.dayOfWeek === "number") {
      mapped.dayOfWeek = dayIndexToName(mapped.dayOfWeek);
    }
    return mapped;
  });
}

export function insertRow(table: string, data: Record<string, unknown>): Row {
  assertTableName(table);
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      const col = k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(); // camel→snake
      mapped[col] = Array.isArray(v) || (typeof v === "object" && v !== null) ? JSON.stringify(v) : v;
    }
  }
  const keys = Object.keys(mapped);
  if (keys.length === 0) throw new Error("Nothing to insert");
  const cols = keys.join(", ");
  const marks = keys.map(() => "?").join(", ");
  const values = keys.map((k) => (mapped[k] === undefined ? null : mapped[k]));
  const info = getDb()
    .prepare(`INSERT INTO ${table} (${cols}) VALUES (${marks})`)
    .run(...values);
  return getOne(table, Number(info.lastInsertRowid))!;
}

export function updateRow(table: string, id: number, data: Record<string, unknown>): Row {
  assertTableName(table);
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      const col = k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
      mapped[col] = Array.isArray(v) || (typeof v === "object" && v !== null) ? JSON.stringify(v) : v;
    }
  }
  const keys = Object.keys(mapped);
  if (keys.length === 0) return getOne(table, id)!;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (mapped[k] === undefined ? null : mapped[k]));
  getDb()
    .prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`)
    .run(...values, assertId(id));
  return getOne(table, id)!;
}

export function deleteRow(table: string, id: number): void {
  assertTableName(table);
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(assertId(id));
}

// ─── Domain-specific operations ────────────────────────────────────────────

/**
 * Single-user desktop: there is exactly one institution. Returns it,
 * creating it (with a default academic year) on first call.
 */
export function getOrCreateDefaultInstitution(defaultName = "My Institution"): Row {
  const existing = getDb().prepare("SELECT * FROM institutions ORDER BY id LIMIT 1").get() as Row | undefined;
  if (existing) return mapRow(existing)!;

  return inTransaction((db) => {
    const yearName = `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;
    const info = db
      .prepare("INSERT INTO institutions (name, type) VALUES (?, 'college')")
      .run(defaultName);
    const institutionId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO academic_years (institution_id, name, is_active) VALUES (?, ?, 1)").run(
      institutionId,
      yearName
    );
    return mapRow(db.prepare("SELECT * FROM institutions WHERE id = ?").get(institutionId));
  });
}

export function createInstitutionWithYear(data: { name: string; type: string; address?: string | null; defaultYearName?: string }): Row {
  return inTransaction((db) => {
    const info = db
      .prepare("INSERT INTO institutions (name, type, address) VALUES (?, ?, ?)")
      .run(data.name, data.type, data.address ?? null);
    const institutionId = Number(info.lastInsertRowid);
    const yearName = data.defaultYearName || `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;
    db.prepare("INSERT INTO academic_years (institution_id, name, is_active) VALUES (?, ?, 1)").run(
      institutionId,
      yearName
    );
    return mapRow(db.prepare("SELECT * FROM institutions WHERE id = ?").get(institutionId) as Row);
  });
}

export function activateAcademicYear(institutionId: number, yearId: number): void {
  inTransaction((db) => {
    db.prepare("UPDATE academic_years SET is_active = 0 WHERE institution_id = ?").run(assertId(institutionId));
    db.prepare("UPDATE academic_years SET is_active = 1 WHERE id = ? AND institution_id = ?").run(
      assertId(yearId),
      assertId(institutionId)
    );
  });
}

/** Active academic year for an institution. */
export function getActiveYear(institutionId: number): Row | undefined {
  const row = getDb()
    .prepare(
      "SELECT * FROM academic_years WHERE institution_id = ? ORDER BY is_active DESC, id DESC LIMIT 1"
    )
    .get(assertId(institutionId)) as Row | undefined;
  return mapRow(row);
}

/** Full availability grid for a teacher keyed by slot id. */
export function getTeacherAvailability(teacherId: number): Record<number, number> {
  const rows = getDb()
    .prepare("SELECT time_slot_id, available FROM teacher_availability WHERE teacher_id = ?")
    .all(assertId(teacherId)) as { time_slot_id: number; available: number }[];
  return Object.fromEntries(rows.map((r) => [r.time_slot_id, r.available]));
}

export function setTeacherAvailability(teacherId: number, slotIds: number[], available: boolean): void {
  inTransaction((db) => {
    const stmt = db.prepare(
      `INSERT INTO teacher_availability (teacher_id, time_slot_id, available) VALUES (?, ?, ?)
       ON CONFLICT(teacher_id, time_slot_id) DO UPDATE SET available = excluded.available`
    );
    for (const slotId of slotIds) {
      stmt.run(assertId(teacherId), assertId(slotId), available ? 1 : 0);
    }
  });
}

/**
 * Timetable entries with nested objects, matching the legacy API contract:
 * { subject: {...}, faculty: {...}, classroom: {...}, timeSlot: {...}, section: {...} }
 * Reads from the ACTIVE timetable version.
 */
export function getTimetableEntries(filters: {
  versionId?: number | null;
  sectionId?: number | null;
  teacherId?: number | null;
  classroomId?: number | null;
  institutionId?: number | null;
}): Row[] {
  const db = getDb();

  let versionId = filters.versionId ?? null;
  if (!versionId && filters.institutionId) {
    const active = db
      .prepare(
        "SELECT id FROM timetable_versions WHERE institution_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1"
      )
      .get(assertId(filters.institutionId)) as { id: number } | undefined;
    versionId = active?.id ?? null;
  }
  // No active version → empty timetable, not an error.
  if (!versionId) return [];

  const clauses: string[] = ["e.version_id = ?"];
  const params: unknown[] = [versionId];
  if (filters.sectionId) { clauses.push("e.section_id = ?"); params.push(filters.sectionId); }
  if (filters.teacherId) { clauses.push("e.teacher_id = ?"); params.push(filters.teacherId); }
  if (filters.classroomId) { clauses.push("e.classroom_id = ?"); params.push(filters.classroomId); }

  const rows = db
    .prepare(
      `SELECT e.id, e.version_id, e.section_id, e.subject_id, e.teacher_id, e.classroom_id, e.time_slot_id,
              s.id AS s_id, s.name AS s_name, s.code AS s_code, s.type AS s_type,
              t.id AS f_id, t.name AS f_name, t.code AS f_code,
              c.id AS c_id, c.room_number AS c_room_number, c.type AS c_type,
              ts.id AS ts_id, ts.day_of_week AS ts_day_of_week, ts.start_time AS ts_start_time,
              ts.end_time AS ts_end_time, ts.label AS ts_label, ts.type AS ts_type,
              sec.id AS sec_id, sec.name AS sec_name, sec.year AS sec_year, sec.semester AS sec_semester
       FROM timetable_entries e
       LEFT JOIN subjects s ON s.id = e.subject_id
       LEFT JOIN teachers t ON t.id = e.teacher_id
       LEFT JOIN classrooms c ON c.id = e.classroom_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN time_slots ts ON ts.id = e.time_slot_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY ts.day_of_week, ts.sort_order, sec.id
       LIMIT 20000`
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id as number,
    versionId: r.version_id as number,
    sectionId: r.section_id as number,
    subjectId: r.subject_id as number,
    facultyId: r.teacher_id as number | null,
    classroomId: r.classroom_id as number,
    timeSlotId: r.time_slot_id as number,
    subject: r.s_id != null ? { id: r.s_id, name: r.s_name, code: r.s_code, type: r.s_type } : null,
    faculty: r.f_id != null ? { id: r.f_id, name: r.f_name, code: r.f_code } : null,
    classroom: r.c_id != null ? { id: r.c_id, roomNumber: r.c_room_number, type: r.c_type } : null,
    timeSlot: r.ts_id != null
      ? {
          id: r.ts_id,
          dayOfWeek: dayIndexToName(Number(r.ts_day_of_week)),
          startTime: r.ts_start_time,
          endTime: r.ts_end_time,
          label: r.ts_label,
          type: r.ts_type,
        }
      : null,
    section: r.sec_id != null
      ? { id: r.sec_id, name: r.sec_name, year: r.sec_year, semester: r.sec_semester }
      : null,
  }));
}

/** Dashboard stats for an institution (assignments counted via subjects). */
export function getDashboardStats(institutionId: number): Record<string, number> {
  const db = getDb();
  const count = (table: string): number => {
    assertTableName(table);
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE institution_id = ?`).get(institutionId) as { c: number };
    return row.c;
  };
  const activeVersion = db
    .prepare("SELECT id FROM timetable_versions WHERE institution_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1")
    .get(assertId(institutionId)) as { id: number } | undefined;

  return {
    departments: count("departments"),
    classes: count("classes"),
    sections: count("sections"),
    teachers: count("teachers"),
    subjects: count("subjects"),
    classrooms: count("classrooms"),
    timeSlots: count("time_slots"),
    assignments: (db
      .prepare("SELECT COUNT(*) AS c FROM subjects WHERE institution_id = ? AND section_id IS NOT NULL")
      .get(assertId(institutionId)) as { c: number }).c,
    timetableEntries: activeVersion
      ? (db.prepare("SELECT COUNT(*) AS c FROM timetable_entries WHERE version_id = ?").get(activeVersion.id) as { c: number }).c
      : 0,
  };
}
