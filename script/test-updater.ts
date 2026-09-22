/**
 * Unit tests for the auto-update policy engine and decision rules.
 *
 * These are pure functions with no Electron/native dependencies, so this runs
 * anywhere:  npm run test:updater
 */
import {
  deriveCapabilities,
  isPlaceholder,
  parseFeedYaml,
  evaluateFeed,
  evaluateInstallGate,
  classifyCheckError,
  summarizeProgress,
  formatBytes,
  normalizeReleaseNotes,
  shouldAutoCheck,
  versionSummary,
  POSTPONE_BACKUP_MESSAGE,
} from "../electron/services/updater-policies";

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

// ── deriveCapabilities ───────────────────────────────────────────────────────
is("capabilities: idle", deriveCapabilities("idle"), { canCheck: true, canDownload: false, canInstall: false });
is("capabilities: available", deriveCapabilities("available"), { canCheck: true, canDownload: true, canInstall: false });
is("capabilities: downloaded", deriveCapabilities("downloaded"), { canCheck: true, canDownload: false, canInstall: true });
is("capabilities: postponed", deriveCapabilities("postponed"), { canCheck: true, canDownload: false, canInstall: true });
is("capabilities: checking busy", deriveCapabilities("checking"), { canCheck: false, canDownload: false, canInstall: false });
is("capabilities: downloading busy", deriveCapabilities("downloading"), { canCheck: false, canDownload: false, canInstall: false });
is("capabilities: installing busy", deriveCapabilities("installing"), { canCheck: false, canDownload: false, canInstall: false });
is("capabilities: unsupported", deriveCapabilities("unsupported"), { canCheck: false, canDownload: false, canInstall: false });

// ── isPlaceholder ────────────────────────────────────────────────────────────
is("placeholder: null", isPlaceholder(null), true);
is("placeholder: empty", isPlaceholder(""), true);
is("placeholder: replace_with_", isPlaceholder("replace_with_repo"), true);
is("placeholder: angle brackets", isPlaceholder("<owner>"), true);
is("placeholder: real owner", isPlaceholder("varshan054685"), false);

// ── parseFeedYaml ────────────────────────────────────────────────────────────
const validYaml = `
provider: github
owner: varshan054685
repo: Automatic_Time-Table_scheduler
`;
is("parse feed yaml", parseFeedYaml(validYaml), {
  provider: "github",
  owner: "varshan054685",
  repo: "Automatic_Time-Table_scheduler",
});
is("parse feed yaml empty", parseFeedYaml(null), null);

// ── evaluateFeed ─────────────────────────────────────────────────────────────
is("feed: unpackaged (dev)", evaluateFeed({ provider: "github", owner: "user", repo: "app" }, { packaged: false }).supported, false);
is("feed: missing feed", evaluateFeed(null, { packaged: true }).supported, false);
is("feed: non-github provider", evaluateFeed({ provider: "s3", owner: "user", repo: "app" }, { packaged: true }).supported, false);
is("feed: placeholder owner", evaluateFeed({ provider: "github", owner: "replace_with_owner", repo: "app" }, { packaged: true }).supported, false);
is("feed: valid packaged github", evaluateFeed({ provider: "github", owner: "varshan054685", repo: "Automatic_Time-Table_scheduler" }, { packaged: true }), {
  supported: true,
  reason: null,
  label: "varshan054685/Automatic_Time-Table_scheduler",
});

// ── evaluateInstallGate ──────────────────────────────────────────────────────
const validFeed = { supported: true, reason: null, label: "user/app" };
const unsupportedFeed = { supported: false, reason: "dev build", label: null };

is(
  "install gate: unsupported feed",
  evaluateInstallGate({
    feed: unsupportedFeed,
    state: "downloaded",
    runningJob: { running: false },
    backup: { attempted: false, ok: false },
    schemaVersion: 1,
  }).code,
  "UNSUPPORTED"
);

is(
  "install gate: wrong state (available)",
  evaluateInstallGate({
    feed: validFeed,
    state: "available",
    runningJob: { running: false },
    backup: { attempted: false, ok: false },
    schemaVersion: 1,
  }).code,
  "NOT_READY"
);

is(
  "install gate: generation running",
  evaluateInstallGate({
    feed: validFeed,
    state: "downloaded",
    runningJob: { running: true, jobId: 42 },
    backup: { attempted: false, ok: false },
    schemaVersion: 1,
  }).code,
  "GENERATION_RUNNING"
);

is(
  "install gate: schema unknown",
  evaluateInstallGate({
    feed: validFeed,
    state: "downloaded",
    runningJob: { running: false },
    backup: { attempted: false, ok: false },
    schemaVersion: null,
  }).code,
  "SCHEMA_UNKNOWN"
);

is(
  "install gate: backup not yet attempted (proceed to backup)",
  evaluateInstallGate({
    feed: validFeed,
    state: "downloaded",
    runningJob: { running: false },
    backup: { attempted: false, ok: false },
    schemaVersion: 1,
  }).code,
  "BACKUP_MISSING"
);

is(
  "install gate: backup attempted but failed",
  evaluateInstallGate({
    feed: validFeed,
    state: "downloaded",
    runningJob: { running: false },
    backup: { attempted: true, ok: false, reason: "disk full" },
    schemaVersion: 1,
  }).code,
  "BACKUP_FAILED"
);

is(
  "install gate: backup verified ok (approved to restart)",
  evaluateInstallGate({
    feed: validFeed,
    state: "downloaded",
    runningJob: { running: false },
    backup: { attempted: true, ok: true, path: "userData/backups/pre-update.sqlite" },
    schemaVersion: 1,
  }),
  {
    ok: true,
    code: "OK",
    message: "Your data is backed up and the update is ready to install.",
  }
);

// ── classifyCheckError ───────────────────────────────────────────────────────
is(
  "classify error: network timeout (offline)",
  classifyCheckError(new Error("getaddrinfo ENOTFOUND github.com"), { auto: true }),
  {
    code: "OFFLINE",
    message: "No internet connection — update checks are unavailable. Everything else works offline.",
    silent: true,
  }
);

is(
  "classify error: 404 release",
  classifyCheckError(new Error("HttpError 404: Cannot find latest release"), { auto: false }),
  {
    code: "NO_RELEASES",
    message: "No published release was found for this app, so there is nothing to update to yet.",
    silent: false,
  }
);

// ── summarizeProgress & formatBytes ──────────────────────────────────────────
is(
  "summarize progress",
  summarizeProgress({ percent: 45.2, transferred: 4520000, total: 10000000, bytesPerSecond: 1048576 }),
  { percent: 45, transferred: 4520000, total: 10000000, bytesPerSecond: 1048576 }
);

is("format bytes: zero", formatBytes(0), "—");
is("format bytes: KB", formatBytes(2048), "2.0 KB");
is("format bytes: MB", formatBytes(52428800), "50.0 MB");

// ── normalizeReleaseNotes ────────────────────────────────────────────────────
is("release notes: string", normalizeReleaseNotes("Fixed bug #123"), "Fixed bug #123");
is("release notes: html stripped", normalizeReleaseNotes("<p>Feature <strong>A</strong></p>"), "Feature A");
is("release notes: array", normalizeReleaseNotes([{ version: "1.1.0", note: "Faster solver" }]), "v1.1.0\nFaster solver");

// ── shouldAutoCheck ──────────────────────────────────────────────────────────
is("shouldAutoCheck: disabled", shouldAutoCheck({ enabled: false, supported: true, state: "idle", now: 10000, lastCheckAt: null }), false);
is("shouldAutoCheck: first run", shouldAutoCheck({ enabled: true, supported: true, state: "idle", now: 10000, lastCheckAt: null }), true);
is("shouldAutoCheck: recent check", shouldAutoCheck({ enabled: true, supported: true, state: "idle", now: 10000, lastCheckAt: 9000, intervalMs: 5000 }), false);
is("shouldAutoCheck: elapsed interval", shouldAutoCheck({ enabled: true, supported: true, state: "idle", now: 20000, lastCheckAt: 10000, intervalMs: 5000 }), true);
is("shouldAutoCheck: busy downloading", shouldAutoCheck({ enabled: true, supported: true, state: "downloading", now: 20000, lastCheckAt: null }), false);

// ── versionSummary ───────────────────────────────────────────────────────────
is("version summary: same", versionSummary({ currentVersion: "1.0.0", latestVersion: null }), "1.0.0");
is("version summary: update", versionSummary({ currentVersion: "1.0.0", latestVersion: "1.1.0" }), "1.0.0 → 1.1.0");

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} updater tests failed:`);
  for (const f of failures) console.error("  -", f);
  process.exit(1);
} else {
  console.log(`PASS: all ${passed} updater policy assertions passed.`);
}
