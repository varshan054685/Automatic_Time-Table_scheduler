/**
 * UpdateService — GitHub-Releases auto-update, fully isolated from the timetable
 * engine (spec §14–17).
 *
 * Contract:
 * - The renderer only ever sees `status() / check() / download() / install()`.
 * - `autoUpdater.autoDownload` and `autoInstallOnAppQuit` are forced off: an
 *   update is downloaded only when asked and installed only when the user
 *   confirms (spec §14 — never restart silently).
 * - `quitAndInstall()` is never called directly: every install goes through the
 *   pre-install safety gate in `evaluateInstallGate` — flush → backup → verify →
 *   re-validate — and is refused if anything is uncertain (spec §15).
 * - Update failures never touch the database or the scheduler, and an offline
 *   check is reported quietly (spec §17).
 *
 * `electron-updater` is imported lazily so a development run (where it is not
 * needed) cannot fail to boot because of it.
 */
import fs from "fs";
import path from "path";
import { app, BrowserWindow } from "electron";
import { createBackup, verifyBackupFile } from "./backup";
import { flushDatabase, getDb, getSchemaVersion } from "./database";
import { getSetting, setSetting } from "./settings";
import { runningGenerationJob } from "./scheduler";
import { log, logError } from "./logger";
import {
  CHECK_INTERVAL_MS,
  INITIAL_CHECK_DELAY_MS,
  classifyCheckError,
  deriveCapabilities,
  evaluateFeed,
  evaluateInstallGate,
  normalizeReleaseNotes,
  parseFeedYaml,
  shouldAutoCheck,
  summarizeProgress,
  type FeedConfig,
  type FeedDecision,
  type InstallGateInput,
  type UpdateProgress,
  type UpdateState,
  type UpdateStatus,
} from "./updater-policies";

export type { UpdateState, UpdateStatus, UpdateProgress } from "./updater-policies";

type Updater = import("electron-updater").AppUpdater;

/** IPC event channel the renderer subscribes to. */
export const UPDATER_EVENT_CHANNEL = "updater:event";

// ─── State ──────────────────────────────────────────────────────────────────

let status: UpdateStatus = {
  state: "idle",
  currentVersion: "0.0.0",
  latestVersion: null,
  releaseName: null,
  releaseDate: null,
  releaseNotes: null,
  progress: null,
  message: null,
  code: null,
  silent: false,
  updateSupported: false,
  unsupportedReason: null,
  canCheck: false,
  canDownload: false,
  canInstall: false,
  preInstallBackup: null,
  autoCheck: true,
  autoDownload: false,
};

let feed: FeedConfig | null = null;
let feedDecision: FeedDecision = { supported: false, reason: null, label: null };
let feedResolved = false;

let updater: Updater | null = null;
let updaterUnavailable: string | null = null;

let checking = false;
let downloading = false;
let lastCheckAt: number | null = null;
let lastCheckWasAuto = false;
let initialTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function boolSetting(key: string, fallback: boolean): boolean {
  try {
    const value = getSetting(key, fallback);
    return typeof value === "boolean" ? value : fallback;
  } catch {
    return fallback;
  }
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(UPDATER_EVENT_CHANNEL, status);
  }
}

/** Merge a partial update, recompute the permitted actions and notify the UI. */
function patch(partial: Partial<UpdateStatus>): void {
  status = { ...status, ...partial };
  status = { ...status, ...deriveCapabilities(status.state) };
  broadcast();
}

function safeRunningJob(): { running: boolean; jobId: number | null } {
  try {
    return runningGenerationJob();
  } catch {
    // No database yet / closed: treat as nothing running.
    return { running: false, jobId: null };
  }
}

function safeSchemaVersion(): number | null {
  try {
    return getSchemaVersion(getDb());
  } catch {
    return null;
  }
}

/** Read electron-builder's generated feed config once, then cache the decision. */
function resolveFeed(): void {
  if (feedResolved) return;
  feedResolved = true;

  const packaged = app.isPackaged;
  if (packaged) {
    try {
      const file = path.join(process.resourcesPath ?? "", "app-update.yml");
      feed = parseFeedYaml(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
    } catch (err) {
      logError("Could not read app-update.yml", err, "updater");
      feed = null;
    }
  }

  feedDecision = evaluateFeed(feed, { packaged });
  status = { ...status, currentVersion: app.getVersion() };

  if (feedDecision.supported) {
    patch({ updateSupported: true, unsupportedReason: null, state: status.state === "unsupported" ? "idle" : status.state });
    log(`Updater enabled (feed: ${feedDecision.label})`, "updater");
  } else {
    patch({ updateSupported: false, unsupportedReason: feedDecision.reason, state: "unsupported" });
    log(`Updater unavailable: ${feedDecision.reason}`, "updater");
  }
}

function refuseInstall(decision: { code: string; message: string }, backupPath: string | null = null): {
  ok: boolean;
  code: string;
  message: string;
  status: UpdateStatus;
} {
  patch({
    state: "postponed",
    code: decision.code,
    message: decision.message,
    progress: null,
    silent: false,
    preInstallBackup: backupPath ?? status.preInstallBackup,
  });
  log(`Update postponed (${decision.code}): ${decision.message}`, "updater");
  return { ok: false, code: decision.code, message: decision.message, status };
}

/** Attach listeners that keep `status` in sync with the real updater. */
function wireEvents(au: Updater): void {
  au.on("checking-for-update", () =>
    patch({ state: "checking", message: null, code: null, silent: false })
  );

  au.on("update-available", (info) =>
    patch({
      state: "available",
      latestVersion: info.version,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      progress: null,
      message: null,
      code: null,
      silent: false,
    })
  );

  au.on("update-not-available", () =>
    patch({
      state: "up-to-date",
      latestVersion: app.getVersion(),
      progress: null,
      message: null,
      code: null,
      silent: false,
    })
  );

  // Listener parameter types are inferred from the updater's own event map.
  au.on("download-progress", (p) =>
    patch({ state: "downloading", progress: summarizeProgress(p) })
  );

  au.on("update-downloaded", (event) =>
    patch({
      state: "downloaded",
      latestVersion: event.version,
      releaseName: event.releaseName ?? status.releaseName,
      progress: { percent: 100, transferred: 0, total: 0, bytesPerSecond: 0 },
      message: "Update downloaded — restart to install it.",
      code: null,
      silent: false,
    })
  );

  // electron-updater reports failures here (including offline checks).
  au.on("error", (err) => {
    const failure = classifyCheckError(err, { auto: lastCheckWasAuto });
    logError(`Updater error (${failure.code})`, err, "updater");
    patch({
      state: "error",
      code: failure.code,
      message: failure.message,
      silent: failure.silent,
      progress: null,
    });
  });
}

async function loadUpdater(): Promise<Updater | null> {
  if (updater) return updater;
  if (updaterUnavailable) return null;
  if (!feedDecision.supported) return null;

  try {
    const mod = await import("electron-updater");
    const au = mod.autoUpdater;

    // Never download or install without an explicit user action (spec §14).
    au.autoDownload = false;
    au.autoInstallOnAppQuit = false;
    au.allowPrerelease = false;
    au.allowDowngrade = false;
    au.logger = {
      info: (...args: unknown[]) => log(`[updater] ${args.map(String).join(" ")}`, "updater"),
      warn: (...args: unknown[]) => log(`[updater] ${args.map(String).join(" ")}`, "updater"),
      error: (...args: unknown[]) => log(`[updater] ${args.map(String).join(" ")}`, "updater"),
      debug: () => undefined,
    };

    wireEvents(au);
    updater = au;
    return au;
  } catch (err) {
    updaterUnavailable = err instanceof Error ? err.message : String(err);
    logError("Could not load electron-updater", err, "updater");
    patch({
      state: "unsupported",
      updateSupported: false,
      unsupportedReason: `The updater component could not be loaded: ${updaterUnavailable}`,
    });
    return null;
  }
}

// ─── Public API (mirrors the IPC surface) ───────────────────────────────────

export function getStatus(): UpdateStatus {
  resolveFeed();
  return { ...status };
}

/** Check for updates. `auto` marks timer-driven checks (they fail quietly). */
export async function checkForUpdates(opts: { auto?: boolean } = {}): Promise<UpdateStatus> {
  resolveFeed();
  const auto = opts.auto === true;
  lastCheckWasAuto = auto;

  if (!feedDecision.supported) return getStatus();
  if (checking || downloading) return getStatus();

  const au = await loadUpdater();
  if (!au) return getStatus();

  checking = true;
  patch({ state: "checking", message: null, code: null, silent: false });

  try {
    await au.checkForUpdates();
    lastCheckAt = Date.now();
    // The listeners above normally decide the outcome; this is the fallback for
    // a provider that resolves without emitting anything.
    if (status.state === "checking") {
      patch({ state: "up-to-date", latestVersion: app.getVersion() });
    }
    if (auto && status.state === "available" && boolSetting("updates.autoDownload", false)) {
      log("Automatic download enabled — fetching the update", "updater");
      await downloadUpdate();
    }
  } catch (err) {
    const failure = classifyCheckError(err, { auto });
    logError(`Update check failed (${failure.code})`, err, "updater");
    patch({
      state: "error",
      code: failure.code,
      message: failure.message,
      silent: failure.silent,
      progress: null,
    });
  } finally {
    checking = false;
  }

  return getStatus();
}

/** Download a detected update. Requires state `available`. */
export async function downloadUpdate(): Promise<UpdateStatus> {
  resolveFeed();
  if (downloading) return getStatus();
  if (status.state !== "available") {
    log(`Download requested in state "${status.state}" — ignored`, "updater");
    return getStatus();
  }

  const au = await loadUpdater();
  if (!au) return getStatus();

  downloading = true;
  patch({
    state: "downloading",
    progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 },
    message: null,
    code: null,
    silent: false,
  });

  try {
    await au.downloadUpdate();
  } catch (err) {
    const failure = classifyCheckError(err, { auto: false });
    logError(`Update download failed (${failure.code})`, err, "updater");
    patch({
      state: "error",
      code: failure.code,
      message: failure.message,
      silent: false,
      progress: null,
    });
  } finally {
    downloading = false;
  }

  return getStatus();
}

export interface InstallResult {
  ok: boolean;
  code: string;
  message: string;
  status: UpdateStatus;
}

/**
 * Pre-install safety gate + install (spec §15).
 *
 * Sequence:
 *   1. validate the cheap preconditions — refuse without touching the database;
 *   2. flush pending writes (WAL checkpoint);
 *   3. create AND verify a `pre-update` backup;
 *   4. re-run the full gate (a generation may have started during the backup);
 *   5. only then quitAndInstall().
 *
 * Any failure leaves the application running normally.
 */
export async function installUpdate(): Promise<InstallResult> {
  resolveFeed();

  const base = (backup: InstallGateInput["backup"]): InstallGateInput => ({
    feed: feedDecision,
    state: status.state,
    runningJob: safeRunningJob(),
    backup,
    schemaVersion: safeSchemaVersion(),
  });

  // 1. Preconditions. `BACKUP_MISSING` is the expected answer here — it means
  // "nothing else blocks you; take the backup next".
  const pre = evaluateInstallGate(base({ attempted: false, ok: false }));
  if (pre.code !== "BACKUP_MISSING") return refuseInstall(pre);

  const au = await loadUpdater();
  if (!au) {
    return refuseInstall({
      code: "UNSUPPORTED",
      message: `Update postponed — ${feedDecision.reason ?? "the updater is unavailable in this build."}`,
    });
  }

  // 2/3. Flush, then back up and verify.
  flushDatabase();

  let backup: InstallGateInput["backup"] = { attempted: true, ok: false, path: null, reason: null };
  try {
    const info = await createBackup("pre-update");
    const verified = verifyBackupFile(info.filePath);
    backup = {
      attempted: true,
      ok: verified.ok,
      path: info.filePath,
      reason: verified.reason ?? null,
    };
    log(
      `Pre-update backup written: ${info.filePath} (${info.sizeBytes} bytes, verified=${verified.ok})`,
      "updater"
    );
  } catch (err) {
    backup = {
      attempted: true,
      ok: false,
      path: null,
      reason: err instanceof Error ? err.message : String(err),
    };
    logError("Pre-update backup failed — the update will NOT be installed", err, "updater");
  }

  // 4. Full gate on the verified backup.
  const final = evaluateInstallGate(base(backup));
  if (!final.ok) return refuseInstall(final, backup.path ?? null);

  // 5. All clear.
  patch({
    state: "installing",
    preInstallBackup: backup.path ?? null,
    code: "OK",
    message: final.message,
    silent: false,
  });
  log(`Pre-install gate passed — restarting to install the update`, "updater");

  // Let the renderer paint the "installing" state before the app is replaced.
  setTimeout(() => {
    try {
      au.quitAndInstall(false, true);
    } catch (err) {
      logError("quitAndInstall failed", err, "updater");
      patch({
        state: "error",
        code: "INSTALL_FAILED",
        message: "The update could not be installed. Your data is safe; please try again.",
        silent: false,
      });
    }
  }, 400);

  return { ok: true, code: final.code, message: final.message, status: getStatus() };
}

/** Persist and apply an update preference (`updates.autoCheck` / `autoDownload`). */
export function setAutoOption(key: "autoCheck" | "autoDownload", value: boolean): UpdateStatus {
  const settingKey = key === "autoCheck" ? "updates.autoCheck" : "updates.autoDownload";
  setSetting(settingKey, value);
  log(`Update preference ${settingKey} = ${value}`, "updater");
  patch(key === "autoCheck" ? { autoCheck: value } : { autoDownload: value });

  // Switching auto-check on should not wait up to 6 hours for the first result.
  if (key === "autoCheck" && value && feedDecision.supported) {
    void checkForUpdates({ auto: true });
  }
  return getStatus();
}

async function tick(): Promise<void> {
  const enabled = boolSetting("updates.autoCheck", true);
  const due = shouldAutoCheck({
    enabled,
    supported: feedDecision.supported,
    state: status.state,
    now: Date.now(),
    lastCheckAt,
  });
  if (!due) return;
  await checkForUpdates({ auto: true });
}

/** Schedule the delayed startup check and the periodic checks (spec §14). */
export function initUpdater(): void {
  resolveFeed();
  patch({
    currentVersion: app.getVersion(),
    autoCheck: boolSetting("updates.autoCheck", true),
    autoDownload: boolSetting("updates.autoDownload", false),
  });

  if (!feedDecision.supported) return;

  initialTimer = setTimeout(() => void tick(), INITIAL_CHECK_DELAY_MS);
  intervalTimer = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  // Timers must never hold the process open.
  initialTimer.unref?.();
  intervalTimer.unref?.();
  log(
    `Update checks scheduled (first in ${INITIAL_CHECK_DELAY_MS / 1000}s, then every ${CHECK_INTERVAL_MS / 3_600_000}h)`,
    "updater"
  );
}

/** Stop the timers on shutdown; never installs anything. */
export function disposeUpdater(): void {
  if (initialTimer) clearTimeout(initialTimer);
  if (intervalTimer) clearInterval(intervalTimer);
  initialTimer = null;
  intervalTimer = null;
}
