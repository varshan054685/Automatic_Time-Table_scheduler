/**
 * Electron main process. Owns the database, all services and the IPC surface.
 * The renderer is fully sandboxed and only sees window.api (see preload.ts).
 */
import { app, BrowserWindow, shell } from "electron";
import path from "path";
import { initDatabase, closeDatabase } from "./services/database";
import { registerAllIpc, activateIpc, handleRestore } from "./ipc/register";
import { log, logError } from "./services/logger";
import { getAppPaths } from "./services/paths";
import { overrideAppPathsForTests } from "./services/paths";

let mainWindow: BrowserWindow | null = null;
let smokesDone = false;

const isDev = !app.isPackaged;

// Route logs into userData/logs even before window creation.
process.on("uncaughtException", (err) => logError("Uncaught exception", err, "main"));
process.on("unhandledRejection", (reason) => logError("Unhandled rejection", reason, "main"));

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f8fafc",
    title: "Automatic Timetable Scheduler",
    icon: path.join(process.env.VITE_DEV_SERVER_URL ? "" : process.resourcesPath || "", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,   // spec §22
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Open external links in the system browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "public", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** Headless boot path used by `electron . --smoke` (CI verification). */
async function runSmokeTest(): Promise<void> {
  smokesDone = true;
  const paths = getAppPaths();
  const init = await initDatabase();
  log(`SMOKE OK database initialized v${init.versionAfter} (${init.applied} migrations)`, "main");

  // Exercise the service layer end-to-end.
  const { list, insertRow, createInstitutionWithYear, getDashboardStats, getTimetableEntries } =
    await import("./services/crud");
  const { createBackup, listBackups, verifyBackupFile } = await import("./services/backup");
  const { setSetting, getSetting, getAllSettings } = await import("./services/settings");

  const inst = createInstitutionWithYear({ name: "Smoke Test College", type: "college" });
  if (!inst.id) throw new Error("institution insert failed");
  const years = list("academic_years", "institution_id = ?", [inst.id]);
  if (years.length !== 1) throw new Error(`expected 1 active year, got ${years.length}`);

  const dept = insertRow("departments", { institution_id: inst.id, name: "CS", code: "CSE" });
  const room = insertRow("classrooms", { institution_id: inst.id, room_number: "R101", capacity: 60, type: "lecture" });
  const teacher = insertRow("teachers", { institution_id: inst.id, name: "Ada Lovelace", code: "F001", department_id: dept.id });
  const stats = getDashboardStats(inst.id as number);
  if (stats.teachers !== 1 || stats.classrooms !== 1) throw new Error("dashboard stats wrong");

  const entries = getTimetableEntries({}); // empty join query must not throw
  if (!Array.isArray(entries)) throw new Error("timetable entries query failed");

  setSetting("smoke.test", { worked: true });
  if ((getSetting("smoke.test") as { worked: boolean }).worked !== true) throw new Error("settings roundtrip failed");

  const backup = await createBackup("smoke");
  const v = verifyBackupFile(backup.filePath);
  if (!v.ok) throw new Error(`backup verify failed: ${v.reason}`);
  if (listBackups().length < 1) throw new Error("backup not listed");

  log(`SMOKE OK teacher=${teacher.id} room=${room.id} stats=${JSON.stringify(stats)} backup=${backup.id}`, "main");
  log(`SMOKE OK userData=${paths.root}`, "main");
  console.log("SMOKE_OK");
  app.exit(0);
}

app.whenReady().then(async () => {
  const smoke = process.argv.includes("--smoke");
  try {
    if (smoke) {
      await runSmokeTest();
      return;
    }

    log(`Starting Automatic Timetable Scheduler v${app.getVersion()} (dev=${isDev})`, "main");
    registerAllIpc();
    // Restore needs the DB connection closed during the swap; route it through main.
    // (backup:restore handler delegates to handleRestore below.)
    const { ipcMain } = await import("electron");
    ipcMain.removeHandler("api:backup:restore");
    ipcMain.handle("api:backup:restore", async (_e, args: { id: string }) => handleRestore(args));
    await initDatabase();
    activateIpc();
    log("IPC activated", "main");

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    logError("Fatal startup error", err, "main");
    const message = err instanceof Error ? err.message : String(err);
    if (smoke) {
      // Never block CI with a modal — print and exit non-zero.
      console.error("SMOKE_FAIL:", message);
      app.exit(1);
      return;
    }
    const { dialog } = await import("electron");
    dialog.showErrorBox(
      "Automatic Timetable Scheduler could not start",
      message
    );
    app.exit(1);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (!smokesDone) closeDatabase();
});
