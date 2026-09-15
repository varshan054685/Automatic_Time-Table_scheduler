/** ISO-8601 UTC timestamp helpers (values are stored as ISO strings in SQLite). */

export function nowIso(): string {
  return new Date().toISOString();
}

export function fromIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "8 minutes ago" / "yesterday" / "12 Aug, 8:30 AM" style relative time. */
export function formatRelativeTime(iso: string | null | undefined): string {
  const date = fromIso(iso);
  if (!date) return "never";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;

  return formatDateTime(iso);
}

/** "12 Aug, 8:30 AM" */
export function formatDateTime(iso: string | null | undefined): string {
  const date = fromIso(iso);
  if (!date) return "—";
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${day} ${month}, ${hour12}:${minutes} ${ampm}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
