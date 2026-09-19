/**
 * PdfService — offline PDF report generation.
 *
 * Reports are rendered as self-contained HTML (inline CSS, no remote assets) and
 * printed with Electron's `webContents.printToPDF()` in a hidden, sandboxed
 * window with JavaScript disabled. Nothing is sent anywhere; the PDF is written
 * to a path the user picks.
 */
import fs from "fs";
import path from "path";
import { BrowserWindow, dialog } from "electron";
import { getDb } from "./database";
import { getAppPaths } from "./paths";
import { getLastUsedDirectory, setLastUsedDirectory } from "./settings";
import { getTimetableEntries, getDashboardStats } from "./crud";
import { getConflicts } from "./scheduler";
import { log, logError } from "./logger";
import { DAY_NAMES } from "./days";
import {
  renderAnalyticsHtml,
  renderRoomUtilizationHtml,
  renderTeacherWorkloadHtml,
  renderTimetableHtml,
  type PdfTimetableEntry,
  type PdfTimetableSection,
  type ReportKind,
} from "./pdf-templates";

export type { ReportKind };

export interface PdfExportOptions {
  kind: ReportKind;
  institutionId?: number;
  sectionId?: number;
  departmentId?: number;
}

export interface PdfExportResult {
  path?: string;
  sizeBytes?: number;
  cancelled?: boolean;
}

type Row = Record<string, unknown>;

const REPORT_TITLES: Record<ReportKind, string> = {
  timetable: "Timetable Report",
  teacherWorkload: "Teacher Workload",
  roomUtilization: "Room Utilization",
  analytics: "Schedule Analytics",
};

const LANDSCAPE: Record<ReportKind, boolean> = {
  timetable: true,
  teacherWorkload: false,
  roomUtilization: false,
  analytics: false,
};

function currentInstitutionId(): number {
  const row = getDb().prepare("SELECT id FROM institutions ORDER BY id LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (!row) throw new Error("No institution exists yet.");
  return row.id;
}

function institutionInfo(institutionId: number): { name: string; academicYear: string | null } {
  const db = getDb();
  const institution = db.prepare("SELECT name FROM institutions WHERE id = ?").get(institutionId) as
    | { name: string }
    | undefined;
  const year = db
    .prepare(
      "SELECT name FROM academic_years WHERE institution_id = ? ORDER BY is_active DESC, id DESC LIMIT 1"
    )
    .get(institutionId) as { name: string } | undefined;
  return { name: institution?.name ?? "Institution", academicYear: year?.name ?? null };
}

/** Teaching periods in the time grid — the denominator for utilization. */
function teachingSlotCount(institutionId: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM time_slots WHERE institution_id = ? AND type = 'teaching'")
    .get(institutionId) as { c: number };
  return row.c;
}

// ─── Data assembly ──────────────────────────────────────────────────────────

function buildTimetableHtml(options: PdfExportOptions, institutionId: number): string {
  const { name, academicYear } = institutionInfo(institutionId);
  const db = getDb();

  const sections = (
    options.sectionId
      ? db.prepare("SELECT * FROM sections WHERE id = ?").all(options.sectionId)
      : db
          .prepare("SELECT * FROM sections WHERE institution_id = ? ORDER BY id")
          .all(institutionId)
  ) as Row[];

  const departments = db.prepare("SELECT id, name FROM departments WHERE institution_id = ?").all(institutionId) as Row[];
  const deptName = (id: unknown): string | null =>
    (departments.find((d) => Number(d.id) === Number(id))?.name as string | undefined) ?? null;

  const wanted = options.departmentId
    ? sections.filter((s) => Number(s.department_id) === Number(options.departmentId))
    : sections;

  const entries = getTimetableEntries({ institutionId }) as Row[];

  const pdfSections: PdfTimetableSection[] = wanted.map((section) => {
    const sectionId = Number(section.id);
    const rows = entries.filter((e) => Number(e.sectionId) === sectionId);
    const mapped: PdfTimetableEntry[] = rows.map((e) => {
      const slot = (e.timeSlot ?? null) as Row | null;
      const subject = (e.subject ?? null) as Row | null;
      const teacher = (e.faculty ?? null) as Row | null;
      const room = (e.classroom ?? null) as Row | null;
      return {
        day: String(slot?.dayOfWeek ?? ""),
        period: String(slot?.label ?? ""),
        startTime: (slot?.startTime as string | undefined) ?? null,
        subject: String(subject?.name ?? "—"),
        subjectCode: (subject?.code as string | undefined) ?? null,
        teacher: (teacher?.name as string | undefined) ?? null,
        room: (room?.roomNumber as string | undefined) ?? null,
      };
    });
    return { sectionName: String(section.name), departmentName: deptName(section.department_id), entries: mapped };
  });

  return renderTimetableHtml({
    institutionName: name,
    academicYear,
    generatedAt: new Date().toLocaleString(),
    sections: pdfSections,
  });
}

function buildWorkloadHtml(institutionId: number): string {
  const { name } = institutionInfo(institutionId);
  const db = getDb();
  const teachers = db
    .prepare(
      `SELECT t.id, t.name, t.code, t.max_periods_day, t.max_periods_week, d.name AS dept_name
       FROM teachers t LEFT JOIN departments d ON d.id = t.department_id
       WHERE t.institution_id = ? ORDER BY t.name`
    )
    .all(institutionId) as Row[];
  const entries = getTimetableEntries({ institutionId }) as Row[];

  const rows = teachers.map((teacher) => {
    const mine = entries.filter((e) => Number(e.facultyId) === Number(teacher.id));
    const days = new Set(mine.map((e) => String((e.timeSlot as Row | null)?.dayOfWeek ?? "")));
    return {
      name: String(teacher.name),
      code: (teacher.code as string | undefined) ?? null,
      department: (teacher.dept_name as string | undefined) ?? null,
      periods: mine.length,
      maxPerWeek: teacher.max_periods_week === null ? null : Number(teacher.max_periods_week),
      maxPerDay: teacher.max_periods_day === null ? null : Number(teacher.max_periods_day),
      activeDays: [...days].filter(Boolean).length,
    };
  });

  return renderTeacherWorkloadHtml({ institutionName: name, generatedAt: new Date().toLocaleString(), rows });
}

function buildRoomHtml(institutionId: number): string {
  const { name } = institutionInfo(institutionId);
  const db = getDb();
  const rooms = db
    .prepare("SELECT * FROM classrooms WHERE institution_id = ? ORDER BY room_number")
    .all(institutionId) as Row[];
  const entries = getTimetableEntries({ institutionId }) as Row[];
  const available = teachingSlotCount(institutionId);

  const rows = rooms.map((room) => {
    const used = entries.filter((e) => Number(e.classroomId) === Number(room.id)).length;
    return {
      roomNumber: String(room.room_number),
      type: (room.type as string | undefined) ?? null,
      capacity: room.capacity === null ? null : Number(room.capacity),
      building: (room.building as string | undefined) ?? null,
      usedPeriods: used,
      availablePeriods: Math.max(available - used, 0),
    };
  });

  return renderRoomUtilizationHtml({ institutionName: name, generatedAt: new Date().toLocaleString(), rows });
}

function buildAnalyticsHtml(institutionId: number): string {
  const { name, academicYear } = institutionInfo(institutionId);
  const stats = getDashboardStats(institutionId);
  const entries = getTimetableEntries({ institutionId }) as Row[];
  const db = getDb();
  const sections = db.prepare("SELECT id, name FROM sections WHERE institution_id = ?").all(institutionId) as Row[];

  const dayCounts = new Map<string, number>();
  for (const entry of entries) {
    const day = String((entry.timeSlot as Row | null)?.dayOfWeek ?? "");
    if (!day) continue;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  const sectionCounts = new Map<number, number>();
  for (const entry of entries) {
    const id = Number(entry.sectionId);
    sectionCounts.set(id, (sectionCounts.get(id) ?? 0) + 1);
  }

  const conflicts = getConflicts(institutionId).map((c) => ({
    type: c.type,
    label: c.label,
    day: c.day,
    period: c.period,
    entries: c.entries.length,
  }));

  return renderAnalyticsHtml({
    institutionName: name,
    academicYear,
    generatedAt: new Date().toLocaleString(),
    totals: {
      sections: stats.sections ?? 0,
      subjects: stats.subjects ?? 0,
      teachers: stats.teachers ?? 0,
      classrooms: stats.classrooms ?? 0,
      periods: entries.length,
    },
    byDay: DAY_NAMES.filter((d) => dayCounts.has(d)).map((day) => ({ day, periods: dayCounts.get(day) ?? 0 })),
    sectionLoads: sections
      .map((s) => ({ sectionName: String(s.name), periods: sectionCounts.get(Number(s.id)) ?? 0 }))
      .sort((a, b) => b.periods - a.periods),
    conflicts,
  });
}

// ─── Rendering ──────────────────────────────────────────────────────────────

/** Build the report body for a kind of report. */
export function buildReportHtml(options: PdfExportOptions): string {
  const institutionId = options.institutionId ?? currentInstitutionId();
  switch (options.kind) {
    case "timetable":
      return buildTimetableHtml(options, institutionId);
    case "teacherWorkload":
      return buildWorkloadHtml(institutionId);
    case "roomUtilization":
      return buildRoomHtml(institutionId);
    case "analytics":
      return buildAnalyticsHtml(institutionId);
    default:
      throw new Error(`Unknown report type: ${String(options.kind)}`);
  }
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Print self-contained HTML to a PDF buffer using a hidden window. */
async function printHtmlToPdf(html: string, landscape: boolean): Promise<Buffer> {
  const tempHtml = path.join(getAppPaths().reportsDir, `report-${Date.now()}.html`);
  fs.writeFileSync(tempHtml, html, "utf8");

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      // Static, self-generated document: no scripts, no node, fully sandboxed.
      javascript: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await win.loadFile(tempHtml);
    // No external resources load, so layout only needs a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 60));

    return await win.webContents.printToPDF({
      pageSize: "A4",
      landscape,
      printBackground: true,
      margins: { top: 0.5, bottom: 0.55, left: 0.45, right: 0.45 },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 14px;display:flex;justify-content:space-between;">' +
        "<span>Automatic Timetable Scheduler</span>" +
        '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try {
      fs.rmSync(tempHtml, { force: true });
    } catch {
      /* temp file cleanup is best-effort */
    }
  }
}

/**
 * Export a report to a user-chosen PDF path. Returns `{ cancelled: true }` if
 * the save dialog was dismissed (not an error).
 */
export async function exportReportPdf(options: PdfExportOptions): Promise<PdfExportResult> {
  const title = REPORT_TITLES[options.kind] ?? "Report";
  if (!REPORT_TITLES[options.kind]) throw new Error(`Unknown report type: ${String(options.kind)}`);

  const html = buildReportHtml(options);

  const lastDir = getLastUsedDirectory("export");
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  const defaultName = `${options.kind.replace(/([A-Z])/g, "-$1").toLowerCase()}-${stamp()}.pdf`;
  const dialogOptions = {
    title: `Save ${title}`,
    defaultPath: path.join(lastDir, defaultName),
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  };
  const picked = win
    ? await dialog.showSaveDialog(win, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (picked.canceled || !picked.filePath) return { cancelled: true };

  setLastUsedDirectory("export", picked.filePath);

  try {
    const pdf = await printHtmlToPdf(html, LANDSCAPE[options.kind]);
    if (pdf.length < 1024) throw new Error("The generated PDF is unexpectedly small.");
    fs.writeFileSync(picked.filePath, pdf);
    log(`PDF exported: ${title} → ${picked.filePath} (${pdf.length} bytes)`, "ipc");
    return { path: picked.filePath, sizeBytes: pdf.length };
  } catch (err) {
    logError(`PDF export failed (${title})`, err, "ipc");
    throw err;
  }
}
