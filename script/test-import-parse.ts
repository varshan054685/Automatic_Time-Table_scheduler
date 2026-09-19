/**
 * Unit tests for the Excel import parsing helpers.
 *
 * These are pure functions with no Electron/native dependencies, so this runs
 * anywhere:  npm run test:parse
 */
import { cell, clockTime, integer, normName, parseDay, text } from "../electron/services/excel-parse";

let passed = 0;
const failures: string[] = [];

function is(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
  } else {
    failures.push(`${label}: expected ${e}, got ${a}`);
  }
}

// ── clockTime ───────────────────────────────────────────────────────────────
is("HH:MM", clockTime("09:00"), "09:00");
is("single-digit hour", clockTime("9:00"), "09:00");
is("dotted", clockTime("9.00"), "09:00");
is("dotted pm", clockTime("10.30"), "10:30");
is("compact", clockTime("0900"), "09:00");
is("am suffix", clockTime("9:00 AM"), "09:00");
is("pm suffix", clockTime("2:30 PM"), "14:30");
is("noon", clockTime("12:00 PM"), "12:00");
is("midnight", clockTime("12:00 AM"), "00:00");
is("compact pm", clockTime("0230 PM"), "14:30");
is("excel fraction 9am", clockTime(0.375), "09:00");
is("excel fraction noon", clockTime(0.5), "12:00");
is("date-like number rejected", clockTime(45123), null);
is("garbage rejected", clockTime("abc"), null);
is("out of range rejected", clockTime("25:00"), null);
is("empty rejected", clockTime(""), null);
is("null rejected", clockTime(null), null);

// ── parseDay ────────────────────────────────────────────────────────────────
is("full day name", parseDay("Monday"), 0);
is("short day name", parseDay("mon"), 0);
is("case insensitive", parseDay("WEDNESDAY"), 2);
is("sunday", parseDay("Sunday"), 6);
is("short thu", parseDay("Thu"), 3);
is("numeric 0", parseDay(0), 0);
is("numeric 5", parseDay(5), 5);
is("numeric 6", parseDay(6), 6);
is("out of range", parseDay(7), null);
is("garbage", parseDay("notaday"), null);
is("empty", parseDay(""), null);
is("null", parseDay(null), null);

// ── cell (header aliasing) ──────────────────────────────────────────────────
const row = { "Subject Code": "CS101", subject_name: "Maths", WEEKLY_HOURS: 4, Empty: "   " };
is("exact header", cell(row, "Subject Code"), "CS101");
is("underscore header", cell(row, "Subject Name"), "Maths");
is("case/space-insensitive", cell(row, "Weekly Hours"), 4);
is("alias order", cell(row, "Code", "Subject Code"), "CS101");
is("blank treated as missing", cell(row, "Empty"), null);
is("missing key", cell(row, "Nope"), null);

// ── text / integer ──────────────────────────────────────────────────────────
is("text trims", text("  Hall A  "), "Hall A");
is("text empty is null", text("   "), null);
is("text null", text(null), null);
is("integer plain", integer("12"), 12);
is("integer with unit", integer("60 seats"), 60);
is("integer non-numeric", integer("abc"), null);
is("integer empty", integer(""), null);
is("integer null", integer(null), null);

// ── normName (honorific-insensitive matching) ───────────────────────────────
is("strips title", normName("Dr. A. Rao"), "arao");
is("plain name", normName("A Rao"), "arao");
is("prof title", normName("Prof. Ambika N"), "ambikan");
is("null safe", normName(null), "");

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("✅ excel-parse: all assertions passed");
