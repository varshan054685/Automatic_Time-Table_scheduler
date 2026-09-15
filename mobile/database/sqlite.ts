import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "./migrations";

export const DATABASE_NAME = "timetable-mobile.db";

let dbInstance: SQLiteDatabase | null = null;

/**
 * Opens the local SQLite database (lazily) and applies pending migrations.
 * The database is the app's primary data source — screens read from here,
 * the (future) sync engine writes here.
 */
export function getDb(): SQLiteDatabase {
  if (!dbInstance) {
    const db = openDatabaseSync(DATABASE_NAME);
    runMigrations({
      exec: (sql) => db.execSync(sql),
      getVersion: () => {
        const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
        return row?.user_version ?? 0;
      },
      setVersion: (version) => db.execSync(`PRAGMA user_version = ${version}`),
    });
    dbInstance = db;
  }
  return dbInstance;
}

export function resetDbForTests(): void {
  dbInstance = null;
}
