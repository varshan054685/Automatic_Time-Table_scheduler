/** Day index ↔ name mapping. DB stores day_of_week 0-6 (Monday=0). */
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayNameToIndex(name: string): number {
  const idx = DAY_NAMES.indexOf(name);
  if (idx < 0) throw new Error(`Unknown day: ${name}`);
  return idx;
}

export function dayIndexToName(index: number): string {
  return DAY_NAMES[index] ?? String(index);
}
