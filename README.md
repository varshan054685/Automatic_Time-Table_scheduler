# Automatic Timetable Scheduler

A **fully offline desktop application** (Windows + Linux) that generates
conflict-free timetables for schools and colleges using constraint programming
(Google OR-Tools CP-SAT).

There is no server, no cloud account and no internet requirement. All academic
data lives in a local SQLite database in the OS user-data directory, and the
solver runs as a local process on `127.0.0.1`.

## What it does

- Create an institution (school or college) with academic years
- Manage departments/classes, sections, subjects, teachers, classrooms/labs and time slots
- Define teacher availability and workload limits
- Generate timetables with a CP-SAT solver (progress, cancellation, partial results)
- Review the generated timetable **before** it replaces the current one; every accepted
  result is kept as a restorable version
- Detect conflicts (teacher, room and section double-booking)
- Import master data from Excel with a **row-level validation preview**
- Back up and restore the database; migrations upgrade existing data safely
- Optional application updates from GitHub Releases (the only feature that uses the network)

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (context isolation, no node integration in the renderer) |
| UI | React 18, Vite, TailwindCSS, Framer Motion, TanStack Query, wouter |
| Local data | SQLite via `better-sqlite3` + a versioned migration runner |
| Solver | Python 3, FastAPI, Google OR-Tools CP-SAT (spawned by the main process) |
| Spreadsheets | SheetJS (`xlsx`) parsed in the main process |

## Architecture

```text
React renderer (sandboxed)
   │  window.api.*  (narrow, zod-validated IPC; push events for progress)
Electron main process
   ├── DatabaseService   SQLite + migrations + backups
   ├── SchedulerService  generation jobs, staging, diagnostics, conflicts
   ├── ExcelService      import preview / commit, templates
   ├── SettingsService   app settings
   └── Logger            rotating logs in userData/logs
   │  spawn (127.0.0.1, random port, health-checked)
Python solver service (FastAPI + OR-Tools CP-SAT)
```

## Requirements

Running a **packaged build** requires nothing — no Node.js, no Python, no database.

For development you need:

- Node.js 20+
- Python 3.11+ **only** if you want to work on the solver
  (`python-service/venv` with `pip install -r python-service/requirements.txt`)

## Development

```bash
npm install                 # installs deps and rebuilds native modules for Electron

# Terminal 1 — renderer (Vite on http://localhost:5173)
npm run dev:client
# Terminal 2 — Electron shell (builds main/preload, then launches)
npm run dev:electron
# or both at once
npm run dev

# Solver only (used automatically by the app; run standalone when debugging)
npm run dev:python
```

Useful checks:

```bash
npm run check        # TypeScript (strict)
npm run build        # renderer bundle
npm run build:electron
npm run test:parse   # unit tests for the Excel parsing helpers
npm run desktop:smoke  # headless end-to-end: migrate → generate → accept → conflicts
```

## Packaging

```bash
npm run build:solver   # PyInstaller bundle of the Python solver (needs pyinstaller in the venv)
npm run desktop:build  # Windows NSIS + Linux AppImage/deb into release/
```

`electron-builder.yml` ships the migrations, the Excel templates and the solver
bundle as `extraResources`. A `beforePack` guard refuses to package if the solver
bundle is missing, so a release can never ship without its scheduler.

## Where your data lives

```text
<OS user-data>/Automatic Timetable Scheduler/
├── database/timetable.db     (+ -wal / -shm)
├── backups/                  automatic + manual snapshots
├── exports/  imports/  reports/
└── logs/                     main.log, db.log, scheduler.log, updater.log
```

The installation directory only holds the application itself; uninstalling never
deletes your data.

## Documentation

- [`docs/implementation-status.md`](docs/implementation-status.md) — what is built, what is verified, what remains
- [`docs/offline-architecture.md`](docs/offline-architecture.md) — analysis of the original web app and the target design
- [`docs/database-design.md`](docs/database-design.md) — SQLite schema and migration strategy
- [`docs/desktop-architecture.md`](docs/desktop-architecture.md) — process model, IPC surface, solver lifecycle
- [`docs/update-system.md`](docs/update-system.md) — auto-update design and safety gates
- [`docs/migration-plan.md`](docs/migration-plan.md) — phased transformation plan
- [`docs/or-tools-scheduler.md`](docs/or-tools-scheduler.md) — solver constraints and diagnostics
