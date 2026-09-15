-- ============================================================================
-- Migration 0001: initial schema for the offline desktop application.
-- Replaces the PostgreSQL SaaS schema (users/workspaces/OTP/sync) with a
-- local academic model. See docs/database-design.md.
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  checksum TEXT NOT NULL
);

-- ─── Institution & academic structure ──────────────────────────────────────

CREATE TABLE institutions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'college' CHECK (type IN ('school','college')),
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE academic_years (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  UNIQUE (institution_id, name)
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  UNIQUE (institution_id, code)
);

-- Program / grade level (College: "B.Tech CSE"; School: "Grade 10")
CREATE TABLE classes (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  level TEXT
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year INTEGER,
  semester INTEGER,
  strength INTEGER,
  default_classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL
);

-- ─── People & rooms ────────────────────────────────────────────────────────

CREATE TABLE teachers (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  max_periods_day INTEGER,
  max_periods_week INTEGER,
  availability TEXT, -- JSON array of slot labels (legacy UI shape; scheduler uses grid)
  UNIQUE (institution_id, code)
);

CREATE TABLE classrooms (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  name TEXT,
  capacity INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'lecture' CHECK (type IN ('lecture','lab','special')),
  building TEXT,
  UNIQUE (institution_id, room_number)
);

-- ─── Time grid ─────────────────────────────────────────────────────────────

CREATE TABLE time_slots (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'teaching' CHECK (type IN ('teaching','break','lunch')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (institution_id, day_of_week, start_time, label)
);

-- ─── Curriculum ────────────────────────────────────────────────────────────

CREATE TABLE subjects (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lecture' CHECK (type IN ('lecture','lab')),
  weekly_hours INTEGER NOT NULL DEFAULT 1,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  faculty_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  UNIQUE (institution_id, code)
);

-- Availability grid: unavailable (teacher, slot) pairs are pruned by the solver.
-- (subject_assignments moves to a future v2 migration when shared subjects ship.)
CREATE TABLE teacher_availability (
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  available INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (teacher_id, time_slot_id)
);

-- ─── Timetables (versioned for history & restore) ──────────────────────────

CREATE TABLE timetable_versions (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  label TEXT,
  source TEXT,                                -- 'generation' | 'manual' | 'import'
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

-- ─── Generation jobs ───────────────────────────────────────────────────────

CREATE TABLE generation_jobs (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','partial','failed','cancelled')),
  total_sections INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER NOT NULL DEFAULT 0,
  failed_sections INTEGER NOT NULL DEFAULT 0,
  solver_statuses_json TEXT,
  diagnostics_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE generation_job_sections (
  job_id INTEGER NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  solver_status TEXT,                          -- OPTIMAL|FEASIBLE|INFEASIBLE|TIMEOUT|ERROR
  message TEXT,
  entries_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  PRIMARY KEY (job_id, section_id)
);

-- Staging results written by the scheduler before the user accepts them.
CREATE TABLE generation_results_staging (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  section_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  teacher_id INTEGER,
  classroom_id INTEGER NOT NULL,
  time_slot_id INTEGER NOT NULL
);

-- ─── Excel import audit trail ──────────────────────────────────────────────

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_rows INTEGER,
  valid_rows INTEGER,
  report_json TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Application settings ──────────────────────────────────────────────────

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX idx_academic_years_institution ON academic_years(institution_id);
CREATE INDEX idx_departments_institution ON departments(institution_id);
CREATE INDEX idx_classes_institution ON classes(institution_id);
CREATE INDEX idx_classes_department ON classes(department_id);
CREATE INDEX idx_sections_institution ON sections(institution_id);
CREATE INDEX idx_sections_department ON sections(department_id);
CREATE INDEX idx_sections_class ON sections(class_id);
CREATE INDEX idx_sections_classroom ON sections(default_classroom_id);
CREATE INDEX idx_teachers_institution ON teachers(institution_id);
CREATE INDEX idx_teachers_department ON teachers(department_id);
CREATE INDEX idx_classrooms_institution ON classrooms(institution_id);
CREATE INDEX idx_time_slots_institution_day ON time_slots(institution_id, day_of_week, sort_order);
CREATE INDEX idx_subjects_institution ON subjects(institution_id);
CREATE INDEX idx_subjects_department ON subjects(department_id);
CREATE INDEX idx_subjects_section ON subjects(section_id);
CREATE INDEX idx_subjects_faculty ON subjects(faculty_id);
CREATE INDEX idx_teacher_availability_slot ON teacher_availability(time_slot_id);
CREATE INDEX idx_timetable_versions_institution ON timetable_versions(institution_id);
CREATE INDEX idx_timetable_versions_active ON timetable_versions(institution_id, is_active);
CREATE INDEX idx_timetable_entries_version ON timetable_entries(version_id);
CREATE INDEX idx_timetable_entries_section ON timetable_entries(section_id);
CREATE INDEX idx_timetable_entries_teacher ON timetable_entries(teacher_id);
CREATE INDEX idx_timetable_entries_classroom ON timetable_entries(classroom_id);
CREATE INDEX idx_timetable_entries_slot ON timetable_entries(time_slot_id);
CREATE INDEX idx_generation_jobs_institution ON generation_jobs(institution_id);
CREATE INDEX idx_generation_results_staging_job ON generation_results_staging(job_id);
