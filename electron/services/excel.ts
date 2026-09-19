/**
 * ExcelService — offline spreadsheet import/export for master data.
 *
 * Import is a two-step, review-then-commit pipeline (spec §12):
 *   preview()  parse + validate → row-level report (nothing is written to the
 *              academic tables) + an `import_batches` audit row holding the
 *              normalized rows
 *   commit()   user-approved write of only the valid rows, inside one
 *              transaction, creating or updating by natural key
 *
 * Files are read with SheetJS in the MAIN process — the sandboxed renderer
 * never touches the filesystem, and file pickers go through Electron's dialog.
 */
import fs from "fs";
import path from "path";
import { BrowserWindow, dialog } from "electron";
import * as XLSX from "xlsx";
import { getDb, inTransaction } from "./database";
import { getAppPaths } from "./paths";
import { getLastUsedDirectory, setLastUsedDirectory } from "./settings";
import { log, logError } from "./logger";
import { DAY_NAMES } from "./days";
import { cell, clockTime, integer, normName, parseDay, text } from "./excel-parse";

export type ImportKind = "departments" | "classrooms" | "faculty" | "subjects" | "sections" | "timeslots";

export const IMPORT_KINDS: ImportKind[] = [
  "departments",
  "classrooms",
  "faculty",
  "subjects",
  "sections",
  "timeslots",
];

export interface RowIssue {
  row: number;
  field?: string;
  severity: "error" | "warning";
  message: string;
}

export interface ImportReport {
  batchId: number;
  kind: ImportKind;
  fileName: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  preview: Record<string, unknown>[];
  applied: boolean;
}

type Row = Record<string, unknown>;
type RawRow = Record<string, unknown>;

// ─── Kind definitions ───────────────────────────────────────────────────────

interface KindDefinition {
  table: string;
  label: string;
  template: string;
  /** Lookup helpers used for human-friendly foreign keys. */
  resolve?: (row: RawRow) => { value: Record<string, unknown> | null; issues: RowIssue[] };
  /** Normalize one spreadsheet row into DB column values. */
  normalize: (row: RawRow) => { values: Record<string, unknown> | null; issues: RowIssue[] };
  /** Natural key used to decide insert vs update. */
  keyColumns: string[];
}

function missing(issues: RowIssue[], field: string, message: string): void {
  issues.push({ row: 0, field, severity: "error", message });
}

function warn(issues: RowIssue[], field: string, message: string): void {
  issues.push({ row: 0, field, severity: "warning", message });
}

function findDepartment(value: unknown, issues: RowIssue[]): number | null {
  const all = getDb().prepare("SELECT id, name, code FROM departments").all() as Row[];
  const wanted = normName(value);
  if (wanted) {
    const hit = all.find((d) => normName(d.code) === wanted || normName(d.name) === wanted);
    if (hit) return Number(hit.id);
    const loose = all.find(
      (d) => normName(d.name).startsWith(wanted) || wanted.startsWith(normName(d.name))
    );
    if (loose) return Number(loose.id);
    missing(issues, "department", `No department matches "${String(value)}". Create it first or fix the spelling.`);
    return null;
  }
  // No department given: acceptable only when there is exactly one to default to.
  if (all.length === 1) return Number(all[0].id);
  missing(
    issues,
    "department",
    all.length === 0
      ? "No departments exist yet — import departments first."
      : "A department is required. Add the Department column to the file."
  );
  return null;
}

function findTeacher(value: unknown, issues: RowIssue[]): number | null {
  const wanted = normName(value);
  if (!wanted) return null;
  const all = getDb().prepare("SELECT id, name, code FROM teachers").all() as Row[];
  const hit = all.find((t) => normName(t.code) === wanted || normName(t.name) === wanted);
  if (hit) return Number(hit.id);
  const loose = all.find(
    (t) => normName(t.name).startsWith(wanted) || wanted.startsWith(normName(t.name))
  );
  if (loose) return Number(loose.id);
  missing(
    issues,
    "faculty",
    `No faculty member matches "${String(value)}". Import faculty first or leave the column blank.`
  );
  return null;
}

function findSection(value: unknown, issues: RowIssue[]): number | null {
  const wanted = normName(value);
  if (!wanted) return null;
  const all = getDb().prepare("SELECT id, name FROM sections").all() as Row[];
  const hit = all.find((s) => normName(s.name) === wanted);
  if (hit) return Number(hit.id);
  missing(
    issues,
    "section",
    `No section matches "${String(value)}". Create it first or leave the column blank.`
  );
  return null;
}

const DEPARTMENTS: KindDefinition = {
  table: "departments",
  label: "Departments",
  template: "departments_template.xlsx",
  keyColumns: ["code"],
  normalize: (row) => {
    const issues: RowIssue[] = [];
    const name = text(cell(row, "Department Name", "Name", "Department"));
    const code = text(cell(row, "Department Code", "Code", "Short Code"));
    if (!name) missing(issues, "name", "Department name is required.");
    if (!code) missing(issues, "code", "Department code is required.");
    if (issues.length > 0) return { values: null, issues };
    return { values: { name, code }, issues };
  },
};

const CLASSROOMS: KindDefinition = {
  table: "classrooms",
  label: "Classrooms",
  template: "classrooms_template.xlsx",
  keyColumns: ["room_number"],
  normalize: (row) => {
    const issues: RowIssue[] = [];
    const roomNumber = text(cell(row, "Room Number", "Room No", "Room", "Number"));
    if (!roomNumber) missing(issues, "roomNumber", "Room number is required.");

    const capacity = integer(cell(row, "Capacity", "Seats", "Strength")) ?? 0;
    if (capacity < 0) missing(issues, "capacity", "Capacity cannot be negative.");

    const typeRaw = text(cell(row, "Room Type", "Type", "Kind")) ?? "lecture";
    const type = typeRaw.toLowerCase();
    if (!["lecture", "lab", "special"].includes(type)) {
      missing(issues, "type", `Room type "${typeRaw}" is not valid (lecture, lab or special).`);
    }

    if (issues.length > 0) return { values: null, issues };
    return {
      values: {
        room_number: roomNumber,
        name: text(cell(row, "Room Name", "Name", "Description")),
        capacity,
        type,
        building: text(cell(row, "Building", "Block", "Floor")),
      },
      issues,
    };
  },
};

const FACULTY: KindDefinition = {
  table: "teachers",
  label: "Faculty",
  template: "faculty_template.xlsx",
  keyColumns: ["code"],
  resolve: (row) => {
    const issues: RowIssue[] = [];
    const deptRaw = cell(row, "Department", "Dept", "Branch");
    const departmentId = deptRaw ? findDepartment(deptRaw, issues) : null;
    return { value: { department_id: departmentId }, issues };
  },
  normalize: (row) => {
    const issues: RowIssue[] = [];
    const name = text(cell(row, "Faculty Name", "Name", "Full Name", "Teacher Name"));
    const code = text(cell(row, "Faculty Code", "Code", "Staff Code", "Employee Code"));
    if (!name) missing(issues, "name", "Faculty name is required.");
    if (!code) missing(issues, "code", "Faculty code is required (used to match on re-import).");

    const emailRaw = text(cell(row, "Email", "Email Address", "Mail"));
    const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;
    if (emailRaw && !email) warn(issues, "email", `"${emailRaw}" is not a valid email — left blank.`);

    const maxDay = integer(cell(row, "Max Periods Day", "Max Per Day", "Daily Limit"));
    const maxWeek = integer(cell(row, "Max Periods Week", "Max Per Week", "Weekly Limit"));

    if (issues.some((i) => i.severity === "error")) return { values: null, issues };
    return {
      values: {
        name,
        code,
        email,
        phone: text(cell(row, "Phone", "Phone Number", "Mobile", "Contact")),
        max_periods_day: maxDay,
        max_periods_week: maxWeek,
      },
      issues,
    };
  },
};

const SUBJECTS: KindDefinition = {
  table: "subjects",
  label: "Subjects",
  template: "subjects_template.xlsx",
  keyColumns: ["code"],
  resolve: (row) => {
    const issues: RowIssue[] = [];
    const departmentId = findDepartment(cell(row, "Department", "Dept", "Major", "Branch"), issues);
    const facultyRaw = cell(row, "Default Faculty", "Faculty", "Teacher", "Staff", "Faculty Name");
    const facultyId = facultyRaw ? findTeacher(facultyRaw, issues) : null;
    const sectionRaw = cell(row, "Target Section", "Section", "Class", "Cohort");
    const sectionId = sectionRaw ? findSection(sectionRaw, issues) : null;
    return { value: { department_id: departmentId, faculty_id: facultyId, section_id: sectionId }, issues };
  },
  normalize: (row) => {
    const issues: RowIssue[] = [];
    const name = text(cell(row, "Subject Name", "Name", "Subject", "Title"));
    const codeRaw = text(cell(row, "Subject Code", "Code", "ID", "Ref"));
    const code = codeRaw ? codeRaw.replace(/\s+/g, "") : null;
    if (!name) missing(issues, "name", "Subject name is required.");
    if (!code) missing(issues, "code", "Subject code is required (used to match on re-import).");

    const hours = integer(cell(row, "Weekly Hours", "Hours", "Weekly", "Lec Hours")) ?? 1;
    if (hours < 1 || hours > 40) {
      missing(issues, "weeklyHours", `Weekly hours (${hours}) must be between 1 and 40.`);
    }

    const typeRaw = text(cell(row, "Subject Type", "Type", "Mode")) ?? "lecture";
    const type = typeRaw.toLowerCase() === "lab" ? "lab" : "lecture";

    if (issues.length > 0) return { values: null, issues };
    return { values: { name, code, weekly_hours: hours, type }, issues };
  },
};

const SECTIONS: KindDefinition = {
  table: "sections",
  label: "Sections",
  template: "sections_template.xlsx",
  keyColumns: ["name", "department_id"],
  resolve: (row) => {
    const issues: RowIssue[] = [];
    const departmentId = findDepartment(cell(row, "Department", "Dept", "Branch"), issues);
    return { value: { department_id: departmentId }, issues };
  },
  normalize: (row) => {
    const issues: RowIssue[] = [];
    const name = text(cell(row, "Section Name", "Name", "Section", "Class"));
    if (!name) missing(issues, "name", "Section name is required.");

    const year = integer(cell(row, "Year", "Study Year", "Level"));
    const semester = integer(cell(row, "Semester", "Sem", "Term"));
    const strength = integer(cell(row, "Strength", "Students", "Count", "Intake"));
    if (year !== null && (year < 1 || year > 10)) missing(issues, "year", "Year must be between 1 and 10.");
    if (semester !== null && (semester < 1 || semester > 20)) missing(issues, "semester", "Semester must be between 1 and 20.");

    if (issues.length > 0) return { values: null, issues };
    return { values: { name, year, semester, strength }, issues };
  },
};

const TIMESLOTS: KindDefinition = {
  table: "time_slots",
  label: "Time Slots",
  template: "timeslots.xlsx",
  keyColumns: ["day_of_week", "start_time", "label"],
  normalize: (row) => {
    const issues: RowIssue[] = [];
    const day = parseDay(cell(row, "Day", "Day of Week", "Weekday"));
    if (day === null) missing(issues, "dayOfWeek", "Day is required (Monday…Sunday).");

    const label = text(cell(row, "Period", "Label", "Slot", "Period Label"));
    if (!label) missing(issues, "label", "Period label is required (e.g. P1).");

    const startTime = clockTime(cell(row, "Start Time", "Start", "From"));
    const endTime = clockTime(cell(row, "End Time", "End", "To"));
    if (!startTime) missing(issues, "startTime", "Start time is required (HH:MM).");
    if (!endTime) missing(issues, "endTime", "End time is required (HH:MM).");
    if (startTime && endTime && endTime <= startTime) {
      missing(issues, "endTime", "End time must be after the start time.");
    }

    const typeRaw = (text(cell(row, "Slot Type", "Type", "Kind")) ?? "teaching").toLowerCase();
    const type = ["teaching", "break", "lunch"].includes(typeRaw) ? typeRaw : "teaching";
    const sortOrder = integer(cell(row, "Sort Order", "Order", "Sequence")) ?? 0;

    if (issues.length > 0) return { values: null, issues };
    return {
      values: { day_of_week: day, label, start_time: startTime, end_time: endTime, type, sort_order: sortOrder },
      issues,
    };
  },
};

const KINDS: Record<ImportKind, KindDefinition> = {
  departments: DEPARTMENTS,
  classrooms: CLASSROOMS,
  faculty: FACULTY,
  subjects: SUBJECTS,
  sections: SECTIONS,
  timeslots: TIMESLOTS,
};

// ─── Preview ────────────────────────────────────────────────────────────────

export interface PreviewResult extends ImportReport {
  cancelled?: boolean;
}

/** Pick a file, validate it and return a reviewable report (nothing committed). */
export async function previewImport(input: {
  kind: ImportKind;
  institutionId?: number;
}): Promise<PreviewResult> {
  const kind = input.kind;
  const definition = KINDS[kind];
  if (!definition) throw new Error(`Unsupported import type: ${String(kind)}`);

  const institutionId = input.institutionId ?? currentInstitutionId();
  const defaultDir = getLastUsedDirectory("import");

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    title: `Import ${definition.label}`,
    defaultPath: defaultDir,
    filters: [{ name: "Excel workbook", extensions: ["xlsx", "xls", "csv"] }],
    properties: ["openFile" as const],
  };
  const picked = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (picked.canceled || picked.filePaths.length === 0) {
    return cancelledReport(kind);
  }

  const filePath = picked.filePaths[0];
  setLastUsedDirectory("import", filePath);
  const fileName = path.basename(filePath);

  let rawRows: RawRow[];
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The workbook has no sheets.");
    rawRows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], { defval: null });
  } catch (err) {
    logError(`Import preview failed to read ${fileName}`, err, "ipc");
    throw new Error(`Could not read "${fileName}": ${err instanceof Error ? err.message : String(err)}`);
  }

  if (rawRows.length === 0) {
    throw new Error(`"${fileName}" contains no data rows on its first sheet.`);
  }

  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const valid: Row[] = [];
  const seenKeys = new Set<string>();
  let duplicateRows = 0;
  let failedRows = 0;

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for the header, +1 for 1-based rows
    const issues: RowIssue[] = [];

    const resolved = definition.resolve ? definition.resolve(raw) : { value: {}, issues: [] as RowIssue[] };
    issues.push(...resolved.issues);

    const normalized = definition.normalize(raw);
    issues.push(...normalized.issues);

    const hardErrors = issues.filter((i) => i.severity === "error");
    if (!normalized.values || hardErrors.length > 0) {
      failedRows += 1;
      for (const issue of issues) errors.push({ ...issue, row: rowNumber });
      return;
    }

    // Soft warnings (e.g. an ignored invalid email) still proceed.
    for (const issue of issues) warnings.push({ ...issue, row: rowNumber });

    const values: Row = { ...resolved.value, ...normalized.values, institution_id: institutionId };

    // Duplicate rows inside the same file: keep the first, report the rest.
    const key = definition.keyColumns.map((c) => String(values[c] ?? "")).join("|");
    if (seenKeys.has(key)) {
      duplicateRows += 1;
      warnings.push({
        row: rowNumber,
        severity: "warning",
        message: `Duplicate row for ${definition.keyColumns.join(" + ")} — the earlier row is kept.`,
      });
      return;
    }
    seenKeys.add(key);

    if (alreadyExists(definition, values)) {
      duplicateRows += 1;
      warnings.push({
        row: rowNumber,
        severity: "warning",
        message: "Existing record with the same key — it will be updated.",
      });
    }

    valid.push(values);
  });

  const report: ImportReport = {
    batchId: 0,
    kind,
    fileName,
    totalRows: rawRows.length,
    validRows: valid.length,
    duplicateRows,
    errorRows: failedRows,
    errors: errors.slice(0, 200),
    warnings: warnings.slice(0, 200),
    preview: valid.slice(0, 20).map((v) => toPreview(kind, v)),
    applied: false,
  };

  const info = getDb()
    .prepare(
      `INSERT INTO import_batches (entity_type, file_name, total_rows, valid_rows, report_json, applied)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
    .run(
      kind,
      fileName,
      report.totalRows,
      report.validRows,
      JSON.stringify({ ...report, batchId: undefined, rows: valid })
    );
  report.batchId = Number(info.lastInsertRowid);

  log(
    `Import preview ${kind}: ${report.validRows} valid, ${report.errorRows} errors, ${duplicateRows} duplicates (batch ${report.batchId})`,
    "ipc"
  );
  return report;
}


function cancelledReport(kind: ImportKind): PreviewResult {
  return {
    cancelled: true,
    batchId: 0,
    kind,
    fileName: "",
    totalRows: 0,
    validRows: 0,
    duplicateRows: 0,
    errorRows: 0,
    errors: [],
    warnings: [],
    preview: [],
    applied: false,
  };
}

function toPreview(kind: ImportKind, values: Row): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...values };
  delete copy.institution_id;
  if (kind === "timeslots") {
    copy.day = DAY_NAMES[Number(values.day_of_week)] ?? values.day_of_week;
  }
  return copy;
}

/** Natural key = institution + the kind's key columns (all target tables are institution-scoped). */
function existingWhere(definition: KindDefinition): string {
  return ["institution_id", ...definition.keyColumns].map((c) => `${c} = ?`).join(" AND ");
}

function keyParams(definition: KindDefinition, values: Row): unknown[] {
  return [values.institution_id ?? null, ...definition.keyColumns.map((c) => values[c] ?? null)];
}

function alreadyExists(definition: KindDefinition, values: Row): boolean {
  const row = getDb()
    .prepare(`SELECT id FROM ${definition.table} WHERE ${existingWhere(definition)} LIMIT 1`)
    .get(...keyParams(definition, values));
  return Boolean(row);
}

function currentInstitutionId(): number {
  const row = getDb().prepare("SELECT id FROM institutions ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (!row) throw new Error("No institution exists yet.");
  return row.id;
}

// ─── Commit ─────────────────────────────────────────────────────────────────

export interface CommitResult {
  kind: ImportKind;
  created: number;
  updated: number;
  batchId: number;
}

/** Write the valid rows of a previewed batch (user-approved). */
export function commitImport(input: { batchId: number }): CommitResult {
  const db = getDb();
  const batch = db.prepare("SELECT * FROM import_batches WHERE id = ?").get(input.batchId) as
    | Row
    | undefined;
  if (!batch) throw new Error("Import batch not found — run the preview again.");
  if (Number(batch.applied) === 1) throw new Error("This import was already applied.");

  const kind = String(batch.entity_type) as ImportKind;
  const definition = KINDS[kind];
  if (!definition) throw new Error(`Unsupported import type: ${kind}`);

  const stored = JSON.parse(String(batch.report_json) || "{}") as { rows?: Row[] };
  const rows = stored.rows ?? [];
  if (rows.length === 0) throw new Error("This import has no valid rows to apply.");

  let created = 0;
  let updated = 0;

  inTransaction((d) => {
    for (const values of rows) {
      const existing = d
        .prepare(`SELECT id FROM ${definition.table} WHERE ${existingWhere(definition)} LIMIT 1`)
        .get(...keyParams(definition, values)) as { id: number } | undefined;

      if (existing) {
        const columns = Object.keys(values).filter((c) => values[c] !== undefined);
        d.prepare(
          `UPDATE ${definition.table} SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`
        ).run(...columns.map((c) => values[c] as never), existing.id);
        updated += 1;
      } else {
        const columns = Object.keys(values);
        d.prepare(
          `INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
        ).run(...columns.map((c) => values[c] as never));
        created += 1;
      }
    }

    d.prepare("UPDATE import_batches SET applied = 1 WHERE id = ?").run(input.batchId);
  });

  log(`Import committed ${kind}: ${created} created, ${updated} updated (batch ${input.batchId})`, "ipc");
  return { kind, created, updated, batchId: input.batchId };
}

/** Save a blank template workbook to a user-chosen location (offline). */
export async function saveTemplate(input: { kind: ImportKind }): Promise<{ path?: string; cancelled?: boolean }> {
  const definition = KINDS[input.kind];
  if (!definition) throw new Error(`Unsupported import type: ${String(input.kind)}`);

  // Templates ship as extraResources in packaged builds, in the repo otherwise.
  const candidates = [
    path.join(process.resourcesPath || "", "excel", definition.template),
    path.join(process.cwd(), "excel", definition.template),
  ];
  const source = candidates.find((p) => p && fs.existsSync(p));
  if (!source) throw new Error(`Template "${definition.template}" was not found in the installation.`);

  const lastDir = getLastUsedDirectory("export");
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    title: `Save ${definition.label} template`,
    defaultPath: path.join(lastDir, definition.template),
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  };
  const picked = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  if (picked.canceled || !picked.filePath) return { cancelled: true };

  setLastUsedDirectory("export", picked.filePath);
  fs.copyFileSync(source, picked.filePath);
  log(`Template saved: ${definition.template}`, "ipc");
  return { path: picked.filePath };
}

/** Recent import batches (audit trail for Settings → Data). */
export function listImportBatches(limit = 25): Record<string, unknown>[] {
  const rows = getDb()
    .prepare(
      "SELECT id, entity_type, file_name, total_rows, valid_rows, applied, created_at FROM import_batches ORDER BY id DESC LIMIT ?"
    )
    .all(limit) as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    entityType: String(r.entity_type),
    fileName: String(r.file_name),
    totalRows: Number(r.total_rows ?? 0),
    validRows: Number(r.valid_rows ?? 0),
    applied: Number(r.applied) === 1,
    createdAt: r.created_at,
  }));
}

/** Export arbitrary JSON data to an Excel workbook at a user-selected path (remembers location). */
export async function exportDataToExcel(input: {
  kind: string;
  data: Record<string, unknown>[];
  defaultFileName?: string;
}): Promise<{ path?: string; cancelled?: boolean; count?: number }> {
  if (!input.data || input.data.length === 0) {
    throw new Error("No data to export.");
  }
  const lastDir = getLastUsedDirectory("export");
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultName = input.defaultFileName || `${input.kind.toLowerCase()}_export_${dateStr}.xlsx`;

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const options = {
    title: `Export ${input.kind}`,
    defaultPath: path.join(lastDir, defaultName),
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  };
  const picked = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options);
  if (picked.canceled || !picked.filePath) return { cancelled: true };

  setLastUsedDirectory("export", picked.filePath);

  const ws = XLSX.utils.json_to_sheet(input.data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, input.kind.slice(0, 31));
  XLSX.writeFile(wb, picked.filePath);

  log(`Exported ${input.data.length} rows to ${picked.filePath}`, "ipc");
  return { path: picked.filePath, count: input.data.length };
}

