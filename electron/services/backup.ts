/**
 * BackupService — timestamped SQLite backups with integrity verification.
 * Used manually (Settings → Data) and automatically before updates,
 * migrations, restores and destructive operations (spec §13).
 *
 * NOTE: createBackup is async — better-sqlite3's online backup API runs on
 * libuv and MUST be awaited before the source connection closes.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { getAppPaths } from "./paths";
import { log, logError } from "./logger";

export interface BackupInfo {
  id: string;
  filePath: string;
  label: string | null;
  sizeBytes: number;
  createdAt: string; // ISO
}

/** Parse `backup-<label->YYYY-MM-DD-HH-mm-ss>.db` filenames. */
function parseBackupName(fileName: string): BackupInfo | null {
  const m = /^backup-(?:(.+)-)?(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.db$/.exec(fileName);
  if (!m) return null;
  const stat = fs.statSync(path.join(getAppPaths().backupsDir, fileName));
  return {
    id: fileName,
    filePath: path.join(getAppPaths().backupsDir, fileName),
    label: m[1] ?? null,
    sizeBytes: stat.size,
    createdAt: m[2],
  };
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/**
 * Create a verified backup of the live database using the SQLite online
 * backup API (safe while the live DB is open), then integrity-check the copy.
 */
export async function createBackup(label?: string): Promise<BackupInfo> {
  const { backupsDir, dbFile } = getAppPaths();
  const filePath = path.join(backupsDir, `backup-${label ? label + "-" : ""}${stamp()}.db`);

  try {
    fs.rmSync(filePath, { force: true });
    const src = new Database(dbFile, { fileMustExist: true });
    try {
      // Await the online backup — closing early aborts the copy (empty file).
      await src.backup(filePath);
    } finally {
      src.close();
    }
  } catch (err) {
    logError(`Backup creation failed (${filePath})`, err, "db");
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw new Error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const info = verifyBackupFile(filePath);
  if (!info.ok) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw new Error(`Backup verification failed: ${info.reason}`);
  }

  log(`Backup created: ${filePath} (${info.sizeBytes} bytes)`, "db");
  return {
    id: path.basename(filePath),
    filePath,
    label: label ?? null,
    sizeBytes: info.sizeBytes,
    createdAt: new Date().toISOString(),
  };
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  sizeBytes: number;
}

/** Open a backup file and run SQLite integrity_check + table sanity checks. */
export function verifyBackupFile(filePath: string): VerifyResult {
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(filePath).size;
  } catch {
    return { ok: false, reason: "backup file missing", sizeBytes: 0 };
  }
  if (sizeBytes < 4096) return { ok: false, reason: "backup file suspiciously small", sizeBytes };

  let check: Database.Database | null = null;
  try {
    check = new Database(filePath, { readonly: true, fileMustExist: true });
    const integrity = check.pragma("integrity_check", { simple: true }) as string;
    if (!/^ok$/i.test(integrity)) return { ok: false, reason: `integrity_check: ${integrity}`, sizeBytes };
    const hasSchema = check
      .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'")
      .get() as { c: number };
    if (hasSchema.c === 0) return { ok: false, reason: "no tables in backup", sizeBytes };
    return { ok: true, sizeBytes };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), sizeBytes };
  } finally {
    check?.close();
  }
}

export function listBackups(): BackupInfo[] {
  const { backupsDir } = getAppPaths();
  return fs
    .readdirSync(backupsDir)
    .map(parseBackupName)
    .filter((b): b is BackupInfo => b !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteBackup(id: string): void {
  const filePath = path.join(getAppPaths().backupsDir, path.basename(id));
  if (!fs.existsSync(filePath)) throw new Error("Backup not found");
  fs.unlinkSync(filePath);
  log(`Backup deleted: ${id}`, "db");
}

/** Restore with a mandatory safety backup of the current state first (spec §13). */
export async function restoreBackup(id: string): Promise<{ safetyBackup: string }> {
  const { dbFile } = getAppPaths();
  const filePath = path.join(getAppPaths().backupsDir, path.basename(id));
  if (!fs.existsSync(filePath)) throw new Error("Backup not found");

  const verify = verifyBackupFile(filePath);
  if (!verify.ok) throw new Error(`Cannot restore: backup is invalid (${verify.reason})`);

  // Never destroy the user's only copy of current data (spec §13).
  const safety = await createBackup("before-restore");

  // The live connection must be closed by the caller before this swap.
  const { restoreBackupFile } = await import("./migrations");
  restoreBackupFile(filePath, dbFile);

  log(`Database restored from ${id} (safety backup: ${safety.filePath})`, "db");
  return { safetyBackup: safety.filePath };
}
