import { app, BrowserWindow, shell, Menu } from "electron";
import path from "path";
import fs from "fs";
import { initDatabase, closeDatabase } from "./services/database";
import { registerAllIpc, activateIpc, handleRestore } from "./ipc/register";
import { log, logError } from "./services/logger";
import { getAppPaths } from "./services/paths";
import { stopSolver } from "./services/scheduler";
import { initUpdater, disposeUpdater } from "./services/updater";

let mainWindow: BrowserWindow | null = null;
let smokesDone = false;

// Windows AppUserModelID for notifications and taskbar branding
if (process.platform === "win32") {
  app.setAppUserModelId("com.timetablescheduler.app");
}
app.setName("Automatic Timetable Scheduler");

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Route logs into userData/logs even before window creation.
process.on("uncaughtException", (err) => logError("Uncaught exception", err, "main"));
process.on("unhandledRejection", (reason) => logError("Unhandled rejection", reason, "main"));


function getAppIcon(): string | undefined {
  const isWin = process.platform === "win32";
  const candidates = [
    // Resources directory (packaged / runtime)
    path.join(process.resourcesPath || "", isWin ? "icon.ico" : "icon.png"),
    path.join(process.resourcesPath || "", "icon.png"),
    // Development / project root paths
    path.join(process.cwd(), "resources", isWin ? "icon.ico" : "icon.png"),
    path.join(process.cwd(), "resources", "icon.png"),
    path.join(process.cwd(), "build", isWin ? "icon.ico" : "icon.png"),
    path.join(process.cwd(), "build", "icon.png"),
    path.join(__dirname, "..", "..", "resources", isWin ? "icon.ico" : "icon.png"),
    path.join(__dirname, "..", "..", "resources", "icon.png"),
    path.join(__dirname, "..", "..", "build", isWin ? "icon.ico" : "icon.png"),
    path.join(__dirname, "..", "..", "build", "icon.png"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function createWindow(): void {
  const isDev = !app.isPackaged;
  const appIcon = getAppIcon();

  // Hide default menu bar for a clean native look
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    title: "Automatic Timetable Scheduler",
    ...(appIcon ? { icon: appIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,   // spec §22
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logError("Renderer failed to load", new Error(`${errorDescription} (${errorCode}) at ${validatedURL}`), "main");
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logError("Renderer process gone", new Error(`${details.reason} (exitCode=${details.exitCode})`), "main");
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (appIcon && mainWindow && process.platform === "win32") {
      mainWindow.setIcon(appIcon);
    }
  });

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
  // Keep CI runs hermetic: never write into the developer's real userData.
  const { overrideAppPathsForTests } = await import("./services/paths");
  const smokeRoot = path.join(process.cwd(), ".smoke-user-data");
  const paths = overrideAppPathsForTests(smokeRoot);
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

  // ── Scheduler end-to-end: local Python + OR-Tools, no network ──────────
  const {
    startGeneration, getJob, acceptStaged, getConflicts, audit, stopSolver,
  } = await import("./services/scheduler");
  const { DAY_NAMES } = await import("./services/days");

  const periodDefs = [
    { label: "P1", start: "09:00", end: "09:50" },
    { label: "P2", start: "09:50", end: "10:40" },
    { label: "P3", start: "10:40", end: "11:30" },
    { label: "P4", start: "11:30", end: "12:20" },
  ];
  for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
    periodDefs.forEach((p, i) => {
      insertRow("time_slots", {
        institutionId: inst.id,
        dayOfWeek: dayIdx,
        startTime: p.start,
        endTime: p.end,
        label: p.label,
        type: "teaching",
        sortOrder: i + 1,
      });
    });
  }

  const section = insertRow("sections", {
    institutionId: inst.id,
    departmentId: dept.id,
    name: "A",
    year: 1,
    semester: 1,
    strength: 60,
  });
  insertRow("subjects", {
    institutionId: inst.id, code: "CS101", name: "Mathematics", type: "lecture",
    weeklyHours: 4, departmentId: dept.id, facultyId: teacher.id, sectionId: section.id,
  });
  insertRow("subjects", {
    institutionId: inst.id, code: "CS102", name: "Physics", type: "lecture",
    weeklyHours: 3, departmentId: dept.id, facultyId: teacher.id, sectionId: section.id,
  });

  const sectionB = insertRow("sections", {
    institutionId: inst.id,
    departmentId: dept.id,
    name: "B",
    year: 1,
    semester: 1,
    strength: 60,
  });
  insertRow("subjects", {
    institutionId: inst.id, code: "CS103", name: "Chemistry", type: "lecture",
    weeklyHours: 4, departmentId: dept.id, facultyId: teacher.id, sectionId: sectionB.id,
  });

  const preflight = audit({ institutionId: inst.id as number });
  if (!preflight.ok) throw new Error(`audit reported blocking issues: ${JSON.stringify(preflight.issues)}`);
  log(`SMOKE OK audit ok (${preflight.teachingSlots} teaching slots, ${DAY_NAMES.length} day names)`, "main");

  const { jobId } = await startGeneration({ allSections: true, institutionId: inst.id as number });
  const deadline = Date.now() + 120_000;
  let job: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    job = getJob(jobId);
    if (!["queued", "running"].includes(String(job.status))) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (job.status !== "completed") {
    throw new Error(`generation job ${jobId} did not complete: ${JSON.stringify(job.diagnostics)}`);
  }

  const accepted = acceptStaged(jobId, "smoke");
  if (accepted.entries <= 0) throw new Error("no timetable entries were promoted");
  const conflicts = getConflicts(inst.id as number);
  if (conflicts.length > 0) throw new Error(`conflicts detected: ${JSON.stringify(conflicts)}`);
  log(`SMOKE OK generation job=${jobId} version=${accepted.versionId} entries=${accepted.entries} conflicts=0`, "main");

  stopSolver();
  log(`SMOKE OK userData=${paths.root}`, "main");
  console.log("SMOKE_OK");
  app.exit(0);
}

app.whenReady().then(async () => {
  const isDev = !app.isPackaged;
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

    initUpdater();

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
  disposeUpdater();
  stopSolver();
  if (!smokesDone) closeDatabase();
});
