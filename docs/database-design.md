# SQLite Database Design

> Phase 2 deliverable. Replaces PostgreSQL/Drizzle with an embedded, file-based store.

## 1. Engine & location

- **Engine**: `better-sqlite3` (already a project dependency; native module rebuilt against Electron ABI). Synchronous, single-connection, perfect for Electron main process. WAL mode for safe concurrent reads.
- **Location**: `path.join(app.getPath("userData"), "database", "timetable.db")` — never inside the install directory.
- **Pragmas on open**: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`.
- **User-data layout**:

```text
<userData>/
├── database/
│   ├── timetable.db
│   ├── timetable.db-wal / -shm
│   └── schema_version.json (mirrors pragma user_version for diagnostics)
├── backups/    backup-YYYY-MM-DD-HH-mm-ss.db
├── exports/    *.xlsx, *.pdf
├── imports/    staged .xlsx files
├── reports/
└── logs/       main.log, scheduler.log, updater.log
```

## 2. Schema (v1)

```sql
-- Migration bookkeeping
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL
);

-- Institution (replaces "workspace"; multiple allowed)
CREATE TABLE institutions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'college' CHECK (type IN ('school','college')),
  address TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE academic_years (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "2026-27"
  start_date TEXT, end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  UNIQUE (institution_id, name)
);

-- Organizational unit. College: "Computer Science". School: may hold class-levels.
CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT NOT NULL,
  UNIQUE (institution_id, code)
);

-- Program / grade level (College: "B.Tech CSE"; School: "Grade 10")
CREATE TABLE classes (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  level TEXT                               -- year number / grade label
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "A"
  strength INTEGER,                        -- student count → room capacity check
  default_classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL
);

CREATE TABLE subjects (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lecture' CHECK (type IN ('lecture','lab')),
  default_weekly_hours INTEGER NOT NULL DEFAULT 1,
  UNIQUE (institution_id, code)
);

-- Which subject is taught to which section, by whom, how much.
-- Replaces subjects.sectionId/facultyId single-pointers (enables shared subjects).
CREATE TABLE subject_assignments (
  id INTEGER PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  weekly_hours INTEGER,
  max_per_day INTEGER,
  requires_room_type TEXT,
  UNIQUE (subject_id, section_id)
);

CREATE TABLE teachers (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT NOT NULL,
  email TEXT, phone TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  max_periods_day INTEGER, max_periods_week INTEGER,
  UNIQUE (institution_id, code)
);

-- Availability grid: teacher unavailable slots are pruned from the solver.
CREATE TABLE teacher_availability (
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  available INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (teacher_id, time_slot_id)
);

CREATE TABLE classrooms (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL, name TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'lecture' CHECK (type IN ('lecture','lab','special')),
  building TEXT,
  UNIQUE (institution_id, room_number)
);

CREATE TABLE time_slots (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Monday
  start_time TEXT NOT NULL, end_time TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'teaching' CHECK (type IN ('teaching','break','lunch')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (institution_id, day_of_week, start_time, label)
);

-- Timetable versions: generated snapshots; promote/replace is version-aware.
CREATE TABLE timetable_versions (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  label TEXT, source TEXT,                 -- 'generation' | 'manual' | 'import'
  generation_job_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE timetable_entries (
  id INTEGER PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES timetable_versions(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE RESTRICT,
  time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE
);

CREATE TABLE generation_jobs (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','partial','failed','cancelled')),
  total_sections INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER NOT NULL DEFAULT 0,
  failed_sections INTEGER NOT NULL DEFAULT 0,
  solver_statuses_json TEXT,               -- {sectionId: OPTIMAL|FEASIBLE|...}
  diagnostics_json TEXT,                   -- explainable failure report
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE generation_job_sections (
  job_id INTEGER NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  solver_status TEXT, message TEXT,
  entries_count INTEGER DEFAULT 0, duration_ms INTEGER,
  PRIMARY KEY (job_id, section_id)
);

-- Staging results written by the scheduler before user accepts (safety workflow)
CREATE TABLE generation_results_staging (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL, teacher_id INTEGER,
  classroom_id INTEGER NOT NULL, time_slot_id INTEGER NOT NULL
);

CREATE TABLE import_batches (               -- Excel import preview/audit trail
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,                -- teachers|subjects|classrooms|sections|timeslots
  file_name TEXT NOT NULL, total_rows INTEGER, valid_rows INTEGER,
  report_json TEXT NOT NULL,                -- row-level errors/warnings
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

**Indexes**: FK columns (`section_id`, `teacher_id`, `classroom_id`, `time_slot_id`, `version_id`, `institution_id`) and `time_slots(institution_id, day_of_week)`; clash-detection queries are all covered.

## 3. Removed SaaS tables
`users`, `otp_verifications`, `workspaces` (+ referral codes), `workspace_members`, `change_requests`, and all sync columns (`clientId`, `version`, `deletedAt`) — the desktop app is the single source of truth. `workspaces.academicYear` becomes the `academic_years` entity (years are now first-class, multiple per institution).

## 4. Migration system (mandatory, per spec §4)

- Runner in the main process: `migrations/` folder ships numbered SQL/TS migrations (`0001_initial.sql`, …) with checksums.
- On startup: `PRAGMA user_version` → apply all migrations `> current` inside one transaction each → set `user_version` → record in `schema_migrations`.
- **Before the first migration of a run**: automatic backup (see update-system.md). If a migration throws: restore from that backup, surface a clear error dialog, app continues read-only-safe with the old schema. Never wipe the DB.
- Fresh installs: apply all migrations to an empty file.
- Tests: fresh-create, upgrade v1→v2 fixture DB, corrupt-file handling, backup-restore round-trip.

## 5. Legacy data path
No PostgreSQL→SQLite conversion ships (the original copy of the project remains untouched as reference). Users of the old web app migrate via **Excel export → desktop import** (templates match the existing `excel/*.xlsx` column conventions).
