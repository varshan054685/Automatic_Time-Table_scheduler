/**
 * PDF report templates — pure string builders.
 *
 * Kept free of Electron/database imports so they can be unit-tested with plain
 * Node (`npm run test:templates`). The generated documents are fully
 * self-contained: inline CSS, no remote fonts or images, so printing never
 * touches the network.
 */

export type ReportKind = "timetable" | "teacherWorkload" | "roomUtilization" | "analytics";

export interface PdfTimetableEntry {
  day: string;
  period: string;
  startTime?: string | null;
  subject: string;
  subjectCode?: string | null;
  teacher?: string | null;
  room?: string | null;
}

export interface PdfTimetableSection {
  sectionName: string;
  departmentName?: string | null;
  entries: PdfTimetableEntry[];
}

export interface PdfTimetableData {
  institutionName: string;
  academicYear?: string | null;
  generatedAt: string;
  sections: PdfTimetableSection[];
}

export interface PdfWorkloadRow {
  name: string;
  code?: string | null;
  department?: string | null;
  periods: number;
  maxPerWeek?: number | null;
  maxPerDay?: number | null;
  activeDays: number;
}

export interface PdfWorkloadData {
  institutionName: string;
  generatedAt: string;
  rows: PdfWorkloadRow[];
}

export interface PdfRoomRow {
  roomNumber: string;
  type?: string | null;
  capacity?: number | null;
  building?: string | null;
  usedPeriods: number;
  availablePeriods: number;
}

export interface PdfRoomData {
  institutionName: string;
  generatedAt: string;
  rows: PdfRoomRow[];
}

export interface PdfAnalyticsData {
  institutionName: string;
  academicYear?: string | null;
  generatedAt: string;
  totals: { sections: number; subjects: number; teachers: number; classrooms: number; periods: number };
  byDay: Array<{ day: string; periods: number }>;
  sectionLoads: Array<{ sectionName: string; periods: number }>;
  conflicts: Array<{ type: string; label: string; day: string; period: string; entries: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Escape untrusted academic data before embedding it in HTML. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "9:00" / "09:00" / "P1" → sortable key (time first, then label number). */
export function periodSortKey(label: string, startTime?: string | null): string {
  if (startTime && /^\d{2}:\d{2}$/.test(startTime)) return `0-${startTime}`;
  const match = /(\d+)/.exec(label ?? "");
  const n = match ? Number(match[1]) : 999;
  return `1-${String(n).padStart(4, "0")}`;
}

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayIndex(day: string): number {
  const idx = DAY_ORDER.indexOf(day);
  return idx < 0 ? 99 : idx;
}

const STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: "Segoe UI", system-ui, -apple-system, "Noto Sans", Ubuntu, sans-serif;
    color: #0f172a; font-size: 10.5px; line-height: 1.35;
  }
  header.doc { border-bottom: 2px solid #0f9f87; padding-bottom: 8px; margin-bottom: 14px; }
  header.doc h1 { margin: 0; font-size: 17px; letter-spacing: -0.2px; }
  header.doc .meta { margin: 3px 0 0; color: #64748b; font-size: 9.5px; }
  h2.section-title {
    font-size: 12px; margin: 16px 0 6px; padding: 5px 8px;
    background: #f1f5f9; border-left: 3px solid #0f9f87; border-radius: 3px;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #e2e8f0; padding: 4px 5px; vertical-align: top; text-align: left; }
  th { background: #f8fafc; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
  td.period { background: #f8fafc; font-weight: 700; white-space: nowrap; width: 84px; }
  td .subject { font-weight: 700; }
  td .sub { color: #64748b; font-size: 9px; display: block; }
  tr { break-inside: avoid; }
  .cell { min-height: 26px; }
  .empty { color: #cbd5e1; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 8px; font-size: 8.5px; font-weight: 700; }
  .ok { background: #ecfdf5; color: #047857; }
  .warn { background: #fffbeb; color: #b45309; }
  .bad { background: #fef2f2; color: #b91c1c; }
  .kpi-row { display: flex; gap: 8px; margin-bottom: 10px; }
  .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
  .kpi .label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
  .kpi .value { font-size: 17px; font-weight: 800; margin-top: 2px; }
  .muted { color: #64748b; }
  .bar { background: #e2e8f0; border-radius: 999px; height: 6px; overflow: hidden; }
  .bar > span { display: block; height: 100%; background: #0f9f87; }
  footer.doc { margin-top: 14px; padding-top: 6px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 8.5px; }
  .conflict { color: #b91c1c; }
`;

/** Shared document shell. `landscape` is informational (page size comes from printToPDF). */
export function pageShell(title: string, subtitle: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<header class="doc">
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(subtitle)}</p>
</header>
${bodyHtml}
<footer class="doc">Generated locally by Automatic Timetable Scheduler — no data left this computer.</footer>
</body>
</html>`;
}

function cellText(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.trim() === "" ? '<span class="empty">—</span>' : escapeHtml(s);
}

// ─── Timetable report ───────────────────────────────────────────────────────

/** Weekly grid per section: rows = periods, columns = days. */
export function renderTimetableHtml(data: PdfTimetableData): string {
  const subtitle =
    `${data.institutionName}` +
    (data.academicYear ? ` · Academic year ${data.academicYear}` : "") +
    ` · ${data.sections.length} section(s) · generated ${data.generatedAt}`;

  const body =
    data.sections.length === 0
      ? `<h2 class="section-title">No timetable</h2><p class="muted">No active timetable version exists yet. Generate and apply a timetable first.</p>`
      : data.sections.map((section) => renderSectionBlock(section)).join("\n");

  return pageShell("Timetable Report", subtitle, body);
}

function renderSectionBlock(section: PdfTimetableSection): string {
  const days = [...new Set(section.entries.map((e) => e.day))]
    .filter((d) => d)
    .sort((a, b) => dayIndex(a) - dayIndex(b));

  // Ordered period rows (time when known, otherwise the label's number).
  const periodMap = new Map<string, { label: string; startTime?: string | null }>();
  for (const entry of section.entries) {
    if (!entry.period) continue;
    const existing = periodMap.get(entry.period);
    if (!existing || (!existing.startTime && entry.startTime)) {
      periodMap.set(entry.period, { label: entry.period, startTime: entry.startTime });
    }
  }
  const periods = [...periodMap.values()].sort((a, b) =>
    periodSortKey(a.label, a.startTime).localeCompare(periodSortKey(b.label, b.startTime))
  );

  const byCell = new Map<string, PdfTimetableEntry>();
  for (const entry of section.entries) byCell.set(`${entry.period}|${entry.day}`, entry);

  const head =
    `<tr><th>Period</th>${days.map((d) => `<th>${escapeHtml(d)}</th>`).join("")}</tr>`;

  const rows = periods
    .map((p) => {
      const cells = days
        .map((day) => {
          const entry = byCell.get(`${p.label}|${day}`);
          if (!entry) return `<td class="cell"><span class="empty">—</span></td>`;
          const teacher = entry.teacher ? `<span class="sub">${escapeHtml(entry.teacher)}</span>` : "";
          const room = entry.room ? `<span class="sub">Room ${escapeHtml(entry.room)}</span>` : "";
          const code = entry.subjectCode ? `${escapeHtml(entry.subjectCode)} · ` : "";
          return `<td class="cell"><span class="subject">${code}${escapeHtml(entry.subject)}</span>${teacher}${room}</td>`;
        })
        .join("");
      return `<tr><td class="period">${escapeHtml(p.label)}</td>${cells}</tr>`;
    })
    .join("");

  const heading = section.departmentName
    ? `${section.sectionName} — ${section.departmentName}`
    : section.sectionName;

  return `<h2 class="section-title">${escapeHtml(heading)}</h2>
<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

// ─── Teacher workload ───────────────────────────────────────────────────────

export function renderTeacherWorkloadHtml(data: PdfWorkloadData): string {
  const subtitle = `${data.institutionName} · ${data.rows.length} teacher(s) · generated ${data.generatedAt}`;

  if (data.rows.length === 0) {
    return pageShell("Teacher Workload", subtitle, `<p class="muted">No teaching load recorded.</p>`);
  }

  const totalPeriods = data.rows.reduce((sum, r) => sum + r.periods, 0);
  const overloaded = data.rows.filter((r) => r.maxPerWeek && r.periods > r.maxPerWeek).length;

  const body = `
<div class="kpi-row">
  <div class="kpi"><div class="label">Teachers</div><div class="value">${data.rows.length}</div></div>
  <div class="kpi"><div class="label">Periods assigned</div><div class="value">${totalPeriods}</div></div>
  <div class="kpi"><div class="label">Avg / teacher</div><div class="value">${(totalPeriods / data.rows.length).toFixed(1)}</div></div>
  <div class="kpi"><div class="label">Over weekly limit</div><div class="value">${overloaded}</div></div>
</div>
<table>
  <thead><tr><th>Teacher</th><th>Code</th><th>Department</th><th>Periods</th><th>Weekly limit</th><th>Daily limit</th><th>Active days</th></tr></thead>
  <tbody>
    ${data.rows
      .map((row) => {
        const over = row.maxPerWeek ? row.periods > row.maxPerWeek : false;
        const loadClass = over ? "bad" : "ok";
        return `<tr>
        <td>${cellText(row.name)}</td>
        <td>${cellText(row.code)}</td>
        <td>${cellText(row.department)}</td>
        <td><span class="badge ${loadClass}">${row.periods}</span></td>
        <td>${row.maxPerWeek ?? "—"}</td>
        <td>${row.maxPerDay ?? "—"}</td>
        <td>${row.activeDays}</td>
      </tr>`;
      })
      .join("")}
  </tbody>
</table>`;

  return pageShell("Teacher Workload", subtitle, body);
}

// ─── Room utilization ───────────────────────────────────────────────────────

export function renderRoomUtilizationHtml(data: PdfRoomData): string {
  const subtitle = `${data.institutionName} · ${data.rows.length} room(s) · generated ${data.generatedAt}`;

  if (data.rows.length === 0) {
    return pageShell("Room Utilization", subtitle, `<p class="muted">No classrooms defined.</p>`);
  }

  const body = `
<table>
  <thead><tr><th>Room</th><th>Type</th><th>Building</th><th>Capacity</th><th>Used periods</th><th>Available</th><th>Utilization</th></tr></thead>
  <tbody>
    ${data.rows
      .map((row) => {
        const total = row.usedPeriods + row.availablePeriods;
        const pct = total > 0 ? Math.round((row.usedPeriods / total) * 100) : 0;
        const cls = pct >= 85 ? "bad" : pct >= 60 ? "warn" : "ok";
        return `<tr>
        <td>${cellText(row.roomNumber)}</td>
        <td>${cellText(row.type)}</td>
        <td>${cellText(row.building)}</td>
        <td>${row.capacity ?? "—"}</td>
        <td>${row.usedPeriods}</td>
        <td>${row.availablePeriods}</td>
        <td>
          <span class="badge ${cls}">${pct}%</span>
          <div class="bar" style="margin-top:3px"><span style="width:${pct}%"></span></div>
        </td>
      </tr>`;
      })
      .join("")}
  </tbody>
</table>`;

  return pageShell("Room Utilization", subtitle, body);
}

// ─── Schedule analytics ─────────────────────────────────────────────────────

export function renderAnalyticsHtml(data: PdfAnalyticsData): string {
  const subtitle =
    `${data.institutionName}` +
    (data.academicYear ? ` · Academic year ${data.academicYear}` : "") +
    ` · generated ${data.generatedAt}`;

  const maxDay = Math.max(1, ...data.byDay.map((d) => d.periods));
  const maxSection = Math.max(1, ...data.sectionLoads.map((s) => s.periods));

  const body = `
<div class="kpi-row">
  <div class="kpi"><div class="label">Sections</div><div class="value">${data.totals.sections}</div></div>
  <div class="kpi"><div class="label">Subjects</div><div class="value">${data.totals.subjects}</div></div>
  <div class="kpi"><div class="label">Teachers</div><div class="value">${data.totals.teachers}</div></div>
  <div class="kpi"><div class="label">Classrooms</div><div class="value">${data.totals.classrooms}</div></div>
  <div class="kpi"><div class="label">Scheduled periods</div><div class="value">${data.totals.periods}</div></div>
  <div class="kpi"><div class="label">Conflicts</div><div class="value ${data.conflicts.length > 0 ? "conflict" : ""}">${data.conflicts.length}</div></div>
</div>

<h2 class="section-title">Periods per day</h2>
<table>
  <thead><tr><th>Day</th><th>Periods</th><th>Distribution</th></tr></thead>
  <tbody>
    ${data.byDay
      .map(
        (d) => `<tr><td>${escapeHtml(d.day)}</td><td>${d.periods}</td>
        <td><div class="bar"><span style="width:${Math.round((d.periods / maxDay) * 100)}%"></span></div></td></tr>`
      )
      .join("")}
  </tbody>
</table>

<h2 class="section-title">Section load</h2>
<table>
  <thead><tr><th>Section</th><th>Periods</th><th>Relative</th></tr></thead>
  <tbody>
    ${data.sectionLoads
      .map(
        (s) => `<tr><td>${escapeHtml(s.sectionName)}</td><td>${s.periods}</td>
        <td><div class="bar"><span style="width:${Math.round((s.periods / maxSection) * 100)}%"></span></div></td></tr>`
      )
      .join("")}
  </tbody>
</table>

<h2 class="section-title">Conflicts</h2>
${
  data.conflicts.length === 0
    ? `<p class="muted">No teacher, room or section double-booking was detected in the active timetable.</p>`
    : `<table>
  <thead><tr><th>Type</th><th>Name</th><th>Day</th><th>Period</th><th>Entries</th></tr></thead>
  <tbody>
    ${data.conflicts
      .map(
        (c) => `<tr class="conflict"><td>${escapeHtml(c.type)}</td><td>${escapeHtml(c.label)}</td>
        <td>${escapeHtml(c.day)}</td><td>${escapeHtml(c.period)}</td><td>${c.entries}</td></tr>`
      )
      .join("")}
  </tbody>
</table>`
}`;

  return pageShell("Schedule Analytics", subtitle, body);
}
