import { getDb } from "../sqlite";
import { defineRepository } from "./helpers";
import { TimetableEntry } from "@/types";

export interface LocalTimetable extends Record<string, unknown> {
  sectionId: number;
  label: string | null;
  source: "cloud" | "offline";
}

export const timetableRepo = defineRepository<LocalTimetable>("timetable", {
  sectionId: "number",
  label: "string",
  source: "string",
});

export const timetableEntryRepo = defineRepository<TimetableEntry & Record<string, unknown>>(
  "timetable_entry",
  {
    sectionId: "number",
    subjectId: "number",
    facultyId: "number",
    classroomId: "number",
    timeSlotId: "number",
  },
);

export function listTimetableEntries(workspaceId: number, sectionId?: number, facultyId?: number) {
  const conditions = [`"workspace_id" = ?`, `"deleted_at" IS NULL`];
  const params: unknown[] = [workspaceId];
  if (sectionId) {
    conditions.push(`"section_id" = ?`);
    params.push(sectionId);
  }
  if (facultyId) {
    conditions.push(`"faculty_id" = ?`);
    params.push(facultyId);
  }
  const rows = getDb().getAllSync(
    `SELECT * FROM "timetable_entry" WHERE ${conditions.join(" AND ")} ORDER BY "id"`,
    params as (string | number | null)[],
  );
  return rows.map((r) => timetableEntryRepo.rowToCamel(r as Record<string, unknown>)) as unknown as TimetableEntry[];
}

/** Replaces all entries for a section (used after a generation sync or offline generation). */
export function replaceEntriesForSection(
  workspaceId: number,
  sectionId: number,
  entries: Array<Omit<TimetableEntry, "id">>,
): number {
  const db = getDb();
  db.execSync("BEGIN TRANSACTION");
  try {
    db.runSync(
      `UPDATE "timetable_entry" SET "deleted_at" = ?, "sync_status" = 'synced' WHERE "workspace_id" = ? AND "section_id" = ?`,
      [new Date().toISOString(), workspaceId, sectionId],
    );
    let count = 0;
    for (const entry of entries) {
      const data: Omit<TimetableEntry, "id"> & Record<string, unknown> = { ...entry, workspaceId };
      const { serverId } = entry as TimetableEntry & { serverId?: number };
      if (serverId) {
        timetableEntryRepo.upsertByServerId(serverId, data);
      } else {
        timetableEntryRepo.insertDirty(data, workspaceId);
      }
      count++;
    }
    db.execSync("COMMIT");
    return count;
  } catch (err) {
    db.execSync("ROLLBACK");
    throw err;
  }
}
