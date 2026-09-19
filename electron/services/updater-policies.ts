/**
 * Auto-update policies — pure decision logic for the update system (spec §14–17).
 *
 * Deliberately free of `electron` / `electron-updater` imports so that every rule
 * governing updates can be unit-tested with plain Node (`npm run test:updater`).
 * The stateful `UpdateService` in `updater.ts` only gathers inputs and applies
 * the decisions made here.
 *
 * Nothing in this file touches the network.
 */

/** Delayed first check after startup — never blocks window paint (spec §14). */
export const INITIAL_CHECK_DELAY_MS = 15_000;
/** Periodic re-check interval. */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * States exposed to the renderer (spec §14). `unsupported` and `postponed` are
 * additions the spec implies but does not name: a development build cannot
 * self-update, and a refused install must not look like a generic error.
 */
export type UpdateState =
  | "unsupported"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "postponed"
  | "installing"
  | "error";

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  releaseName: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  progress: UpdateProgress | null;
  /** User-facing message for the `error` / `postponed` states. */
  message: string | null;
  /** Machine-readable reason (diagnostics/logs — not shown raw in the UI). */
  code: string | null;
  /** A silent failure is normal (offline auto-check) and must not alarm (spec §17). */
  silent: boolean;
  updateSupported: boolean;
  unsupportedReason: string | null;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
  /** Backup created by the pre-install gate, recorded for the audit trail. */
  preInstallBackup: string | null;
  autoCheck: boolean;
  autoDownload: boolean;
}

/** Which actions the current state permits (drives the Settings buttons). */
export function deriveCapabilities(state: UpdateState): {
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
} {
  const busy = state === "checking" || state === "downloading" || state === "installing";
  return {
    canCheck: state !== "unsupported" && !busy,
    canDownload: state === "available",
    // A postponed install is still a downloaded update: the user must be able to
    // fix the cause and retry without downloading everything again.
    canInstall: state === "downloaded" || state === "postponed",
  };
}

// ─── Update feed configuration ──────────────────────────────────────────────

export interface FeedConfig {
  provider?: string | null;
  owner?: string | null;
  repo?: string | null;
}

export interface FeedDecision {
  supported: boolean;
  reason: string | null;
  /** e.g. "acme/timetable-scheduler", for display. */
  label: string | null;
}

/** True for the electron-builder placeholders this repo ships with. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^replace_with_/i.test(value) || /^<.*>$/.test(value) || value.trim() === "";
}

/**
 * Decide whether this build can update itself at all.
 *
 * An unpackaged (development) run has no `app-update.yml`, and a release built
 * from the checked-in `electron-builder.yml` still carries `REPLACE_WITH_*`
 * placeholders. Both cases must be reported clearly instead of being retried as
 * a 404 against GitHub on every launch.
 */
export function evaluateFeed(
  feed: FeedConfig | null | undefined,
  opts: { packaged: boolean }
): FeedDecision {
  if (!opts.packaged) {
    return {
      supported: false,
      reason:
        "Updates are only available in the installed application — this is a development build.",
      label: null,
    };
  }
  if (!feed) {
    return {
      supported: false,
      reason: "This build has no update feed configured, so it cannot check for updates.",
      label: null,
    };
  }
  if (feed.provider && feed.provider.toLowerCase() !== "github") {
    return {
      supported: false,
      reason: `Only the GitHub Releases provider is supported (found "${feed.provider}").`,
      label: null,
    };
  }
  if (isPlaceholder(feed.owner) || isPlaceholder(feed.repo)) {
    return {
      supported: false,
      reason:
        "The update feed is still a placeholder. Set the real GitHub repository in electron-builder.yml (publish.owner / publish.repo) and rebuild.",
      label: null,
    };
  }
  return { supported: true, reason: null, label: `${feed.owner}/${feed.repo}` };
}

/** Minimal parser for electron-builder's generated `app-update.yml`. */
export function parseFeedYaml(yaml: string | null | undefined): FeedConfig | null {
  if (!yaml) return null;
  const read = (key: string): string | null => {
    const m = new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, "m").exec(yaml);
    if (!m) return null;
    return m[1].replace(/^["']|["']$/g, "").trim();
  };
  const feed: FeedConfig = {
    provider: read("provider"),
    owner: read("owner"),
    repo: read("repo"),
  };
  if (!feed.provider && !feed.owner && !feed.repo) return null;
  return feed;
}

// ─── Pre-install safety gate (spec §15) ─────────────────────────────────────

export const POSTPONE_BACKUP_MESSAGE =
  "Update postponed — we could not safely back up your data. Your application will continue running normally.";

export interface InstallGateInput {
  feed: FeedDecision;
  state: UpdateState;
  /** A generation job still running would be killed by the restart. */
  runningJob: { running: boolean; jobId?: number | null };
  backup: {
    attempted: boolean;
    ok: boolean;
    path?: string | null;
    reason?: string | null;
  };
  schemaVersion: number | null;
}

export interface InstallGateDecision {
  ok: boolean;
  code: string;
  message: string;
}

/**
 * Decide whether it is safe to call `quitAndInstall()`.
 *
 * Cheap preconditions are evaluated before the backup step so a backup is only
 * ever written when the install could actually proceed: there is no point
 * copying the database and then refusing the update.
 */
export function evaluateInstallGate(input: InstallGateInput): InstallGateDecision {
  if (!input.feed.supported) {
    return {
      ok: false,
      code: "UNSUPPORTED",
      message: `Update postponed — ${input.feed.reason ?? "this build cannot update itself."}`,
    };
  }

  if (input.state !== "downloaded") {
    return {
      ok: false,
      code: "NOT_READY",
      message: "No downloaded update is ready to install yet.",
    };
  }

  if (input.runningJob.running) {
    const job = input.runningJob.jobId ? ` (job ${input.runningJob.jobId})` : "";
    return {
      ok: false,
      code: "GENERATION_RUNNING",
      message: `Update postponed — a timetable generation is still running${job}. Finish or cancel it, then install the update.`,
    };
  }

  if (input.schemaVersion === null || !Number.isFinite(input.schemaVersion)) {
    return {
      ok: false,
      code: "SCHEMA_UNKNOWN",
      message:
        "Update postponed — the database schema version could not be verified, so a safe upgrade cannot be guaranteed.",
    };
  }

  // Evaluated last: `attempted: false` is the caller's signal to take the
  // pre-install backup now, and a refusal here is what keeps data safe.
  if (!input.backup.attempted) {
    return { ok: false, code: "BACKUP_MISSING", message: POSTPONE_BACKUP_MESSAGE };
  }
  if (!input.backup.ok || !input.backup.path) {
    return {
      ok: false,
      code: "BACKUP_FAILED",
      message: input.backup.reason
        ? `${POSTPONE_BACKUP_MESSAGE} (${input.backup.reason})`
        : POSTPONE_BACKUP_MESSAGE,
    };
  }

  return {
    ok: true,
    code: "OK",
    message: "Your data is backed up and the update is ready to install.",
  };
}

// ─── Check failures (spec §17) ──────────────────────────────────────────────

export interface CheckFailure {
  code: "OFFLINE" | "NO_RELEASES" | "CHECK_FAILED";
  message: string;
  /** Automatic checks that fail must be invisible; manual ones are explained. */
  silent: boolean;
}

const OFFLINE_PATTERNS =
  /(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|ERR_CONNECTION|getaddrinfo|socket hang up|network is unreachable|net::ERR)/i;

const NO_RELEASE_PATTERNS =
  /(404|Cannot find (channel|latest)|app-update\.yml|no published (release|version)|latest\.yml)/i;

/** Turn any updater/network error into a calm, honest status update. */
export function classifyCheckError(err: unknown, opts: { auto: boolean }): CheckFailure {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown update error");

  if (OFFLINE_PATTERNS.test(raw)) {
    return {
      code: "OFFLINE",
      message: "No internet connection — update checks are unavailable. Everything else works offline.",
      silent: opts.auto,
    };
  }
  if (NO_RELEASE_PATTERNS.test(raw)) {
    return {
      code: "NO_RELEASES",
      message:
        "No published release was found for this app, so there is nothing to update to yet.",
      silent: opts.auto,
    };
  }
  return {
    code: "CHECK_FAILED",
    message: `Update check failed: ${raw}`,
    silent: opts.auto,
  };
}

// ─── Presentation helpers ───────────────────────────────────────────────────

/** Normalise electron-updater's ProgressInfo into clamped, display-safe values. */
export function summarizeProgress(p: {
  percent?: number | null;
  transferred?: number | null;
  total?: number | null;
  bytesPerSecond?: number | null;
}): UpdateProgress {
  const num = (v: number | null | undefined): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;

  const total = num(p.total);
  const transferred = num(p.transferred);

  // Prefer the reported percentage, but derive it when the host omits it.
  let percent = typeof p.percent === "number" && Number.isFinite(p.percent) ? p.percent : 0;
  if (!percent && total > 0) percent = (transferred / total) * 100;

  return {
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    transferred,
    total,
    bytesPerSecond: num(p.bytesPerSecond),
  };
}

const UNITS = ["B", "KB", "MB", "GB"];

/** Byte count for the UI; `—` when the value is missing or nonsense. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

/**
 * Release notes arrive as a string or as `[{ version, note }]` per release.
 * Flattened to plain text with a hard character cap (this is rendered, not executed).
 */
export function normalizeReleaseNotes(notes: unknown, maxChars = 1500): string | null {
  if (!notes) return null;

  let text: string;
  if (typeof notes === "string") {
    text = notes;
  } else if (Array.isArray(notes)) {
    text = notes
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const e = entry as { version?: unknown; note?: unknown };
          const note = typeof e.note === "string" ? e.note : "";
          return e.version ? `v${String(e.version)}\n${note}` : note;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  } else {
    return null;
  }

  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!clean) return null;
  return clean.length > maxChars ? `${clean.slice(0, maxChars).trimEnd()}…` : clean;
}

/** Whether the periodic timer should fire a check right now. */
export function shouldAutoCheck(input: {
  enabled: boolean;
  supported: boolean;
  state: UpdateState;
  now: number;
  lastCheckAt: number | null;
  intervalMs?: number;
}): boolean {
  if (!input.enabled || !input.supported) return false;
  // Never interrupt an in-flight operation, and do not re-check while the user
  // still has an update waiting to be installed.
  if (
    input.state === "checking" ||
    input.state === "downloading" ||
    input.state === "downloaded" ||
    input.state === "installing"
  ) {
    return false;
  }
  if (input.lastCheckAt === null) return true;
  const interval = input.intervalMs ?? CHECK_INTERVAL_MS;
  return input.now - input.lastCheckAt >= interval;
}

/** Version label for the "current → latest" header. */
export function versionSummary(status: Pick<UpdateStatus, "currentVersion" | "latestVersion">): string {
  return status.latestVersion
    ? `${status.currentVersion} → ${status.latestVersion}`
    : status.currentVersion;
}
