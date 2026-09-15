/**
 * Centralized application paths. All user data lives under Electron's
 * userData directory — never inside the installation directory.
 *
 * Layout (see docs/database-design.md):
 *   <userData>/
 *     ├── database/timetable.db (+ -wal/-shm)
 *     ├── backups/  exports/  imports/  reports/  logs/
 */
import { app } from "electron";
import path from "path";
import fs from "fs";

/** In tests (plain Node, no Electron), allow running without the app module. */
function userDataRoot(): string {
  try {
    return app.getPath("userData");
  } catch {
    return path.join(process.cwd(), ".smoke-user-data");
  }
}

export interface AppPaths {
  root: string;
  databaseDir: string;
  dbFile: string;
  backupsDir: string;
  exportsDir: string;
  importsDir: string;
  reportsDir: string;
  logsDir: string;
}

let cached: AppPaths | null = null;

/** Ensure all directories exist. Idempotent; safe to call on every boot. */
export function getAppPaths(): AppPaths {
  if (cached) return cached;

  const root = userDataRoot();
  const databaseDir = path.join(root, "database");
  const backupsDir = path.join(root, "backups");
  const exportsDir = path.join(root, "exports");
  const importsDir = path.join(root, "imports");
  const reportsDir = path.join(root, "reports");
  const logsDir = path.join(root, "logs");

  for (const dir of [root, databaseDir, backupsDir, exportsDir, importsDir, reportsDir, logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  cached = {
    root,
    databaseDir,
    dbFile: path.join(databaseDir, "timetable.db"),
    backupsDir,
    exportsDir,
    importsDir,
    reportsDir,
    logsDir,
  };
  return cached;
}

/** Test hook: allow redirecting all paths (used by smoke tests). */
export function overrideAppPathsForTests(rootDir: string): AppPaths {
  cached = {
    root: rootDir,
    databaseDir: path.join(rootDir, "database"),
    dbFile: path.join(rootDir, "database", "timetable.db"),
    backupsDir: path.join(rootDir, "backups"),
    exportsDir: path.join(rootDir, "exports"),
    importsDir: path.join(rootDir, "imports"),
    reportsDir: path.join(rootDir, "reports"),
    logsDir: path.join(rootDir, "logs"),
  };
  for (const dir of [cached.root, cached.databaseDir, cached.backupsDir, cached.exportsDir, cached.importsDir, cached.reportsDir, cached.logsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return cached;
}
