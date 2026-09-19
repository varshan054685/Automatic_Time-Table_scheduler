/**
 * Unit tests for the PDF report templates.
 *
 * Pure string builders, so this runs anywhere:  npm run test:templates
 */
import {
  dayIndex,
  escapeHtml,
  periodSortKey,
  renderAnalyticsHtml,
  renderRoomUtilizationHtml,
  renderTeacherWorkloadHtml,
  renderTimetableHtml,
} from "../electron/services/pdf-templates";

let passed = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail = ""): void {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
}

function contains(label: string, haystack: string, needle: string): void {
  ok(label, haystack.includes(needle), `missing ${JSON.stringify(needle)}`);
}

function excludes(label: string, haystack: string, needle: string): void {
  ok(label, !haystack.includes(needle), `unexpectedly contains ${JSON.stringify(needle)}`);
}

// ── escapeHtml ──────────────────────────────────────────────────────────────
ok("escapes <", escapeHtml("<script>") === "&lt;script&gt;", escapeHtml("<script>"));
ok("escapes &", escapeHtml("a & b") === "a &amp; b");
ok("escapes quotes", escapeHtml('say "hi"') === "say &quot;hi&quot;");
ok("escapes single quote", escapeHtml("it's") === "it&#39;s");
ok("null becomes empty", escapeHtml(null) === "");
ok("number survives", escapeHtml(42) === "42");

// ── periodSortKey / dayIndex ────────────────────────────────────────────────
ok("time-based key", periodSortKey("P1", "09:00") === "0-09:00");
ok("label fallback", periodSortKey("P2") === "1-0002");
ok(
  "P2 sorts before P10",
  periodSortKey("P2").localeCompare(periodSortKey("P10")) < 0,
  `${periodSortKey("P2")} vs ${periodSortKey("P10")}`
);
ok("monday is 0", dayIndex("Monday") === 0);
ok("sunday is 6", dayIndex("Sunday") === 6);
ok("unknown day sorts last", dayIndex("Funday") === 99);

// ── timetable report ────────────────────────────────────────────────────────
const timetableHtml = renderTimetableHtml({
  institutionName: "ABC College",
  academicYear: "2026-27",
  generatedAt: "2026-09-17 10:00",
  sections: [
    {
      sectionName: "A",
      departmentName: "Computer Science",
      entries: [
        { day: "Tuesday", period: "P2", startTime: "10:00", subject: "Physics", subjectCode: "PH1", teacher: "Ada", room: "R102" },
        { day: "Monday", period: "P1", startTime: "09:00", subject: "Maths", subjectCode: "MA1", teacher: "Ada", room: "R101" },
      ],
    },
  ],
});

contains("timetable: title", timetableHtml, "Timetable Report");
contains("timetable: institution", timetableHtml, "ABC College");
contains("timetable: academic year", timetableHtml, "2026-27");
contains("timetable: section heading", timetableHtml, "A — Computer Science");
contains("timetable: subject cell", timetableHtml, "Maths");
contains("timetable: subject code", timetableHtml, "MA1 ·");
contains("timetable: teacher", timetableHtml, "Ada");
contains("timetable: room", timetableHtml, "Room R101");
ok(
  "timetable: Monday column before Tuesday",
  timetableHtml.indexOf("<th>Monday</th>") < timetableHtml.indexOf("<th>Tuesday</th>")
);
ok(
  "timetable: P1 row before P2 row",
  timetableHtml.indexOf(">P1<") < timetableHtml.indexOf(">P2<"),
  "period rows should follow the time grid order"
);
excludes("timetable: no script tags", timetableHtml, "<script");

const emptyTimetable = renderTimetableHtml({
  institutionName: "ABC College",
  generatedAt: "now",
  sections: [],
});
contains("empty timetable: explains state", emptyTimetable, "No active timetable version exists yet");

// ── XSS safety ──────────────────────────────────────────────────────────────
const hostile = renderTimetableHtml({
  institutionName: '</h1><img src=x onerror="alert(1)">',
  generatedAt: "now",
  sections: [
    {
      sectionName: "<b>A</b>",
      entries: [
        { day: "Monday", period: "P1", subject: "<script>alert(1)</script>", teacher: "a & b", room: "< Room >" },
      ],
    },
  ],
});
excludes("xss: no raw img tag", hostile, "<img");
excludes("xss: no raw script tag", hostile, "<script>");
contains("xss: escaped script", hostile, "&lt;script&gt;");
contains("xss: escaped ampersand", hostile, "a &amp; b");
contains("xss: escaped angle brackets", hostile, "&lt; Room &gt;");

// ── teacher workload ────────────────────────────────────────────────────────
const workload = renderTeacherWorkloadHtml({
  institutionName: "ABC College",
  generatedAt: "now",
  rows: [
    { name: "Ada", code: "F001", department: "CSE", periods: 22, maxPerWeek: 20, maxPerDay: 5, activeDays: 5 },
    { name: "Grace", code: "F002", department: "CSE", periods: 12, maxPerWeek: 20, maxPerDay: 5, activeDays: 4 },
  ],
});
contains("workload: title", workload, "Teacher Workload");
contains("workload: teacher name", workload, "Grace");
ok("workload: flags overload", workload.includes("badge bad\">22"), "22 periods over a 20 limit should be flagged");
ok("workload: does not flag within limit", workload.includes("badge ok\">12"), "12 within a 20 limit should be ok");
contains("workload: totals periods", workload, ">34<");
contains("workload: avg", workload, "17.0");

const emptyWorkload = renderTeacherWorkloadHtml({ institutionName: "X", generatedAt: "now", rows: [] });
contains("empty workload: message", emptyWorkload, "No teaching load recorded");

// ── room utilization ────────────────────────────────────────────────────────
const rooms = renderRoomUtilizationHtml({
  institutionName: "ABC College",
  generatedAt: "now",
  rows: [
    { roomNumber: "R101", type: "lecture", capacity: 60, building: "Main", usedPeriods: 18, availablePeriods: 2 },
    { roomNumber: "R102", type: "lab", capacity: 30, building: null, usedPeriods: 0, availablePeriods: 20 },
  ],
});
contains("rooms: title", rooms, "Room Utilization");
contains("rooms: room number", rooms, "R101");
ok("rooms: 90% high load", rooms.includes(">90%<"), "18/20 should render as 90%");
ok("rooms: 0% low load", rooms.includes(">0%<"), "0/20 should render as 0%");
ok("rooms: high load flagged", rooms.includes("badge bad\">90%"));
contains("rooms: capacity", rooms, ">60<");

const emptyRooms = renderRoomUtilizationHtml({ institutionName: "X", generatedAt: "now", rows: [] });
contains("empty rooms: message", emptyRooms, "No classrooms defined");

// ── analytics ───────────────────────────────────────────────────────────────
const analytics = renderAnalyticsHtml({
  institutionName: "ABC College",
  academicYear: "2026-27",
  generatedAt: "now",
  totals: { sections: 4, subjects: 9, teachers: 7, classrooms: 5, periods: 96 },
  byDay: [
    { day: "Monday", periods: 20 },
    { day: "Tuesday", periods: 19 },
  ],
  sectionLoads: [
    { sectionName: "A", periods: 24 },
    { sectionName: "B", periods: 22 },
  ],
  conflicts: [],
});
contains("analytics: title", analytics, "Schedule Analytics");
contains("analytics: periods total", analytics, ">96<");
contains("analytics: clean message", analytics, "No teacher, room or section double-booking");
contains("analytics: day row", analytics, "Monday");
contains("analytics: section row", analytics, ">B<");

const withConflicts = renderAnalyticsHtml({
  institutionName: "ABC College",
  generatedAt: "now",
  totals: { sections: 1, subjects: 1, teachers: 1, classrooms: 1, periods: 2 },
  byDay: [{ day: "Monday", periods: 2 }],
  sectionLoads: [{ sectionName: "A", periods: 2 }],
  conflicts: [{ type: "teacher", label: "Ada", day: "Monday", period: "P1", entries: 2 }],
});
contains("analytics: conflict listed", withConflicts, "Ada");
contains("analytics: conflict count", withConflicts, 'class="value conflict">1<');
excludes("analytics: conflict removes clean message", withConflicts, "No teacher, room or section double-booking");

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("✅ pdf-templates: all assertions passed");
