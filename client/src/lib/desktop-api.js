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
