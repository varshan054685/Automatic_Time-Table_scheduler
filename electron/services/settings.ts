import { getDb } from "./database";
import { app } from "electron";
import fs from "fs";
import path from "path";

export const DEFAULT_SETTINGS = {
  "app.institutionName": "",
  "updates.autoCheck": true,
  "updates.autoDownload": false,
  "scheduler.timeLimitSeconds": 20,
  "scheduler.maxWorkers": 8,
  "backup.maxKept": 20,
  "general.workingDays": "Monday,Tuesday,Wednesday,Thursday,Friday",
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS | (string & {});

export function getSetting<T = string>(key: SettingKey, fallback?: T): T | string {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return (fallback ?? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] ?? "") as T | string;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return row.value as unknown as T | string;
  }
}

export function setSetting(key: SettingKey, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, JSON.stringify(value));
}

export function getAllSettings(): Record<string, unknown> {
  const rows = getDb().prepare("SELECT key, value FROM app_settings").all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

/**
 * Returns the directory used previously for file dialogs (persisted in SQLite).
 * Falls back to OS standard folders (Documents / Desktop / Downloads / cwd).
 */
export function getLastUsedDirectory(category: "import" | "export" | "general" = "general"): string {
  const saved = (getSetting<string>(`last_dir_${category}`) as string) || (getSetting<string>("last_dir_general") as string);
  if (saved && typeof saved === "string" && fs.existsSync(saved)) {
    return saved;
  }
  try {
    const docs = app.getPath("documents");
    if (fs.existsSync(docs)) return docs;
    const desktop = app.getPath("desktop");
    if (fs.existsSync(desktop)) return desktop;
    const downloads = app.getPath("downloads");
    if (fs.existsSync(downloads)) return downloads;
  } catch {
    // fallback if app module is unavailable
  }
  return process.cwd();
}

/**
 * Persists the chosen directory so future file pickers open in the same location.
 */
export function setLastUsedDirectory(category: "import" | "export" | "general", fileOrDirPath: string): void {
  try {
    if (!fileOrDirPath) return;
    const dir = fs.existsSync(fileOrDirPath) && fs.statSync(fileOrDirPath).isDirectory()
      ? fileOrDirPath
      : path.dirname(fileOrDirPath);
    if (fs.existsSync(dir)) {
      setSetting(`last_dir_${category}`, dir);
      setSetting("last_dir_general", dir);
    }
  } catch {
    // ignore
  }
}
