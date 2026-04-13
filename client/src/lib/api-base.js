/**
 * Returns the API base URL from environment variable.
 * In development without VITE_API_URL, falls back to '' (same origin).
 * In production (Vercel), points to the Render backend.
 */
export const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Prepend the API base URL to a relative path.
 * e.g. apiUrl('/api/auth/login') => 'https://automatic-time-table-scheduler.onrender.com/api/auth/login'
 */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
