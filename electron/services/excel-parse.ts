/**
 * Pure spreadsheet cell parsing for the Excel import pipeline.
 *
 * Deliberately free of Electron/better-sqlite3 imports so it can be unit-tested
 * with plain Node (`npm run test:parse`) instead of only inside the packaged
 * app. Everything here is a pure function of its input.
 */
import { DAY_NAMES } from "./days";

/** Column-header comparison: ignore case, spaces and punctuation. */
export function normKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Entity-name comparison: also strips honorifics ("Dr. A. Rao" ≈ "A Rao"). */
export function normName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^(dr|mr|ms|mrs|prof|shri|smt)\.?\s*/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Read a cell by any of the given header aliases (fuzzy, order-sensitive). */
export function cell(row: Record<string, unknown>, ...aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const wanted = normKey(alias);
    const found = keys.find((k) => normKey(k) === wanted);
    if (found !== undefined) {
      const value = row[found];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
  }
  return null;
}

export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export function integer(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  // No digits at all means "missing", not zero — otherwise a stray text value
  // in a numeric column would silently become 0 (e.g. capacity or hours).
  if (!/[0-9]/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/** Accepts "09:00", "9:00", "9.00", "0900", "9:00 AM" and Excel fractions. */
export function clockTime(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;

  if (typeof value === "number") {
    // Excel stores times as a fraction of a day.
    if (value >= 0 && value < 1) {
      const minutes = Math.round(value * 24 * 60) % (24 * 60);
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    return null;
  }

  let s = String(value).trim().toLowerCase();
  const isPm = /p\.?m\.?$/.test(s);
  const isAm = /a\.?m\.?$/.test(s);
  s = s.replace(/[ap]\.?m\.?$/, "").replace(/[\s.]/g, "").replace(/\./g, "");

  let hours: number;
  let minutes = 0;
  if (s.includes(":")) {
    const [h, m] = s.split(":");
    hours = Number(h);
    minutes = Number(m ?? 0);
  } else if (s.length === 4) {
    hours = Number(s.slice(0, 2));
    minutes = Number(s.slice(2));
  } else if (s.length === 3) {
    // "9.00" / "900" → 09:00
    hours = Number(s.slice(0, 1));
    minutes = Number(s.slice(1));
  } else {
    hours = Number(s);
  }
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Day names (Monday/Mon) or 0-6 with Monday = 0 (same convention as the DB). */
export function parseDay(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (Number.isFinite(n) && String(value).trim().length <= 2) {
    const idx = Math.round(n);
    return idx >= 0 && idx <= 6 ? idx : null;
  }
  const s = normKey(String(value));
  const exact = DAY_NAMES.findIndex((d) => normKey(d) === s);
  if (exact >= 0) return exact;
  const short = DAY_NAMES.findIndex((d) => normKey(d).startsWith(s) && s.length >= 3);
  return short >= 0 ? short : null;
}
