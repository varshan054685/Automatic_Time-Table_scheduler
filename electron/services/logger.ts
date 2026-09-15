/**
 * Local file logger. Simple, dependency-free, PII-free by design:
 * never log academic records or user content — only operational events.
 * Rotates automatically when a log file exceeds ~5 MB.
 */
import fs from "fs";
import path from "path";
import { getAppPaths } from "./paths";

export type LogSource = "main" | "db" | "scheduler" | "updater" | "ipc";

const MAX_LOG_BYTES = 5 * 1024 * 1024;

function timestamp(): string {
  return new Date().toISOString();
}

export function log(message: string, source: LogSource = "main"): void {
  const line = `${timestamp()} [${source}] ${message}\n`;
  // Console for dev visibility
  // eslint-disable-next-line no-console
  console.log(line.trimEnd());

  try {
    const { logsDir } = getAppPaths();
    const file = path.join(logsDir, `${source}.log`);
    try {
      const stat = fs.statSync(file);
      if (stat.size > MAX_LOG_BYTES) {
        fs.renameSync(file, file.replace(/\.log$/, ".old.log"));
      }
    } catch {
      // file doesn't exist yet — fine
    }
    fs.appendFileSync(file, line, "utf8");
  } catch {
    // Logging must never crash the app (e.g. disk full)
  }
}

export function logError(message: string, err: unknown, source: LogSource = "main"): void {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  log(`${message} :: ${detail}`, source);
}
