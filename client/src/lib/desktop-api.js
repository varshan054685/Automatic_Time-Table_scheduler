/**
 * Desktop API client shim. The Electron preload exposes window.api with
 * legacy-compatible shapes (camelCase rows, day names, nested timetable
 * entries), so the existing React pages keep working with IPC underneath.
 */
let institutionIdCache = null;

/** Resolve (and memoize) the local institution id for the current session. */
export async function getInstitutionId() {
  if (institutionIdCache != null) return institutionIdCache;
  assertDesktop();
  const inst = await window.api.institutions.current();
  institutionIdCache = inst.id;
  return inst.id;
}

export function clearInstitutionIdCache() {
  institutionIdCache = null;
}

/** Throw a helpful error if the preload bridge is missing. */
export function assertDesktop() {
  if (typeof window === "undefined" || !window.api) {
    throw new Error(
      "Desktop API unavailable. Run the app through Electron (npm run desktop:dev), not a plain browser."
    );
  }
}

/**
 * Single-user desktop app: there is exactly one local institution. Exposed so
 * setup flows can rename it (same visual dialog as the old workspace setup).
 */
export async function ensureInstitution() {
  assertDesktop();
  const inst = await window.api.institutions.current();
  institutionIdCache = inst.id;
  return inst;
}

/**
 * Updater client with graceful fallbacks for browser/dev testing.
 */
export const updaterApi = {
  async status() {
    if (typeof window !== "undefined" && window.api?.updater) {
      return await window.api.updater.status();
    }
    return {
      state: "unsupported",
      currentVersion: "1.0.0-dev",
      latestVersion: null,
      releaseName: null,
      releaseDate: null,
      releaseNotes: null,
      progress: null,
      message: null,
      code: null,
      silent: true,
      updateSupported: false,
      unsupportedReason: "Running in browser / dev mode without Electron updater bridge.",
      canCheck: false,
      canDownload: false,
      canInstall: false,
      preInstallBackup: null,
      autoCheck: true,
      autoDownload: false,
    };
  },

  async check() {
    if (typeof window !== "undefined" && window.api?.updater) {
      return await window.api.updater.check();
    }
    return this.status();
  },

  async download() {
    if (typeof window !== "undefined" && window.api?.updater) {
      return await window.api.updater.download();
    }
    return this.status();
  },

  async install() {
    if (typeof window !== "undefined" && window.api?.updater) {
      return await window.api.updater.install();
    }
    return { ok: false, code: "UNSUPPORTED", message: "Desktop environment required.", status: await this.status() };
  },

  async setAutoOption(key, value) {
    if (typeof window !== "undefined" && window.api?.updater) {
      return await window.api.updater.setAutoOption(key, value);
    }
    return this.status();
  },

  onEvent(cb) {
    if (typeof window !== "undefined" && window.api?.updater?.onEvent) {
      return window.api.updater.onEvent(cb);
    }
    return () => {};
  },
};

