# Implementation Status — Offline Desktop Transformation

> Living document. Last updated after Phase 4 (scheduler), the data-feature work
> (Excel import, PDF reports) and the Phase 8 legacy removal. It records what is built, what
> was actually executed and verified, and what remains. Wherever something could
> not be executed on the development machine, that is stated explicitly (spec §27).

## 1. Phase status

| # | Phase | State | Notes |
|---|---|---|---|
| 1 | Analyze | ✅ Done | `offline-architecture.md`, `project-knowledge.md` |
| 2 | Design | ✅ Done | `database-design.md`, `desktop-architecture.md`, `migration-plan.md`, `update-system.md` |
| 3 | Foundation (Electron + SQLite + migrations) | ✅ Done | `electron/`, `migrations/sqlite/0001`, `0002` |
| 4 | Scheduler migration | ✅ Done | `electron/services/scheduler.ts`, hardened `python-service/` |
| 5 | UI migration | ✅ Done | All pages use IPC; history/restore and availability UI added |
| 6 | Data features | 🟡 Import + PDF export done | Excel import preview+commit and PDF reports shipped; server-side Excel export still open |
| 7 | Auto-update | ⬜ Not started | `publish` config stub only |
| 8 | Packaging + legacy removal | 🟡 Removal done, artefacts unbuilt | `electron-builder.yml` + solver bundling script; never built |

## 2. Delivered

### 2.1 Scheduler (main process)

`electron/services/scheduler.ts`

- Managed Python solver: loopback free port, `GET /health` readiness polling
  (150 ms → 1 s backoff, 30 s cap), crash restart with exponential backoff
  (3 attempts), terminated on `before-quit`. Dev uses `python-service/venv`
  (override with `PYTHON_BIN`); packaged builds use `<resources>/solver/timetable-solver`.
- Generation jobs: sequential per section, staged rows, push progress over
  `scheduler:progress`, cancellation that aborts the in-flight solve.
- Safe apply (spec §11): `acceptStaged` creates a **new** `timetable_versions`
  row, copies staged rows into `timetable_entries`, deactivates the previous
  version and keeps it for restore. `discardStaged` deletes staging only.
- Conflict detection (teacher/room/section double-booking) over the active version.
- Version management: list / activate / delete (active version protected).
- Pre-flight audit: blocking preconditions fail fast; soft issues become
  diagnostics that name the section and the reason.
- Conflict-avoidance fix: sections being regenerated are excluded from "occupied
  slots", so a full regeneration is no longer constrained by the timetable it
  replaces; sections already solved earlier in the same job are included, and
  staging from abandoned jobs is ignored.

### 2.2 Solver (`python-service/`)

- `status` ∈ `OPTIMAL | FEASIBLE | INFEASIBLE | TIMEOUT | ERROR` plus a
  `diagnostics[]` list, replacing the single "Constraints might be too strict"
  string.
- Teacher availability is now a hard constraint (previously stored but never sent
  to the solver); teacher day/week limits; opt-in room type and capacity checks;
  time limit and worker count from `app_settings`.
- Blocks that cannot be placed anywhere now fail loudly with an explanation
  instead of returning a timetable that silently drops teaching hours.
- `app.py`: structured 200 responses (so failures keep their diagnostics),
  `/version`, and a `__main__` loopback entry point for the bundled binary.
- `requirements.txt` pins the verified set: `ortools==9.15.6755`, `pandas<3`
  (see §3.2).

### 2.3 Excel import (spec §12)

`electron/services/excel.ts` + `electron/services/excel-parse.ts`

- Two-step pipeline: `preview()` parses the workbook in the main process,
  validates every row and returns a row-level report (valid / duplicates /
  rejected with reasons) **without writing academic data**; `commit()` writes
  only the valid rows in one transaction, creating or updating by natural key.
- Every preview is recorded in `import_batches` (audit trail, applied flag), and
  the dialog shows recent imports for that entity.
- File pickers use Electron `dialog`; the sandboxed renderer never touches paths.
- Blank templates can be saved from the dialog (`excel/*.xlsx`, shipped as
  extraResources when packaged).
- `components/ImportDialog.jsx` replaces the six per-page SheetJS importers that
  wrote straight through the mutation hooks. Notably, the old time-slot importer
  **deleted all existing slots before importing**; that behaviour is gone.

### 2.4 PDF reports (spec §12)

`electron/services/pdf.ts` + `electron/services/pdf-templates.ts`

- Four reports: **Timetable**, **Teacher Workload**, **Room Utilization** and
  **Schedule Analytics**, each assembled from the active timetable version.
- Rendered as fully self-contained HTML (inline CSS, system fonts, **no remote
  assets**) and printed with `webContents.printToPDF()` in a hidden window with
  `javascript: false`, `sandbox: true`, `nodeIntegration: false`. Nothing is
  uploaded and the print job never touches the network.
- The save dialog is shown in the main process (`saveDialog`); the PDF is written
  wherever the user chooses, defaulting to the user-data `exports/` folder.
  A dismissed dialog returns `{ cancelled: true }` rather than an error.
- All academic data is HTML-escaped (`escapeHtml`), so a subject or teacher name
  containing markup cannot inject nodes into the printed document.
- Templates are pure string builders with no Electron/DB imports, so they are
  unit-tested directly on any machine (`npm run test:templates`).
- UI: `pages/Reports.jsx` (`/reports` route + sidebar entry) for all four kinds,
  plus an "Export PDF" button on the Timetable page that exports the currently
  selected department/section scope.

### 2.5 History, restore and availability UI

- `pages/History.jsx` (+ `/history` route and sidebar entry): all timetable
  versions with restore/delete, and every generation run with status, per-section
  outcome and the scheduler's diagnostics.
- `components/AvailabilityDialog.jsx` on the Faculty page: per-period availability
  grid writing to `teacher_availability`, which the solver enforces.
- Timetable page: post-generation review step (apply / discard / cancel) with a
  diagnostics panel, and real detected conflicts instead of the client-side
  cell-count proxy.

### 2.6 Legacy removal (Phase 8)

Deleted: `server/`, `shared/`, the PostgreSQL migrations and `meta/`, `data/`,
`vercel.json`, `drizzle.config.ts`, the backend/drizzle scripts, and the dead
cloud UI (chatbot, workspace dialog, login, referrals, change requests) with the
cloud HTTP client (`api-base.js`, `apiRequest`/`getQueryFn`).

- Form validation moved from `@shared/routes` to `client/src/lib/schemas.js`
  (five pages rewired).
- `tsconfig.json` and `vite.config.ts` dropped the removed sources, the `@shared`
  alias and the Replit plugins; the dev server now uses `strictPort: 5173` so it
  cannot silently drift from `ELECTRON_START_URL`.
- `package.json` dependencies pruned (express/passport/pg/drizzle/SendGrid/
  Nodemailer/Gemini/axios/ws…); lockfile regenerated and 197 extraneous packages
  pruned from `node_modules` — after which typecheck, builds and tests still pass,
  which proves nothing still imports them.
- `client/src/index.css` no longer fetches Google Fonts at runtime (an outbound
  request on every launch); a system font stack is used instead.
- `.env.example` now documents that the app needs no configuration at all.

## 3. Verification

### 3.1 Executed ✅

| Check | Command | Result |
|---|---|---|
| Typecheck (strict) | `npm run check` | Clean |
| Renderer bundle | `npm run build` | Clean |
| Electron main + preload bundle | `npm run build:electron` | Clean (`main.cjs`, `preload.cjs`) |
| Excel parsing unit tests | `npm run test:parse` | 47/47 assertions pass |
| PDF template unit tests | `npm run test:templates` | 51/51 assertions pass |
| All unit tests | `npm test` | Both suites pass |
| Solver: feasible case | direct `generate_timetable` | `OPTIMAL`, all requested periods placed |
| Solver: teacher fully unavailable | direct | `INFEASIBLE` + `NO_FEASIBLE_SLOT` |
| Solver: weekly hours > grid capacity | direct | `INFEASIBLE` + `HOURS_SHORTFALL` |
| Dependency prune integrity | `npm prune` then all of the above | Still clean |

The parsing test found a real bug during this pass (`integer("abc")` returned `0`
instead of "missing", which would have turned stray text in a numeric column into
zero capacity/hours); it is fixed and covered by an assertion.

### 3.2 Blocked by the development machine ⚠️

This machine enforces a Windows **Application Control policy that blocks native
binaries**:

| Blocked file | Effect |
|---|---|
| `node_modules/electron/dist/electron.exe` | `desktop:smoke` / `desktop:dev` fail with `spawn UNKNOWN` |
| `node_modules/better-sqlite3/build/Release/better_sqlite3.node` | the database layer cannot load under Electron **or** plain Node |
| `pandas 3.x` `*.pyd` | OR-Tools 9.15 cannot import (its `cp_model` imports pandas) |

Therefore **not verified end-to-end here**: real database migrations on a file,
CRUD/backup/restore round-trips, the generation job pipeline, the import commit,
and the packaged application. The code paths exist and typecheck; per spec §27
they must not be described as tested.

This also means the PDF reports are verified only up to the HTML they generate:
`printToPDF()` itself cannot run here because it needs `electron.exe`. The
report *data assembly* (SQL + mapping) and the *document markup* are covered by
unit tests and typecheck, but no PDF file has been produced on this machine.
Producing one requires the manual sweep in §5, step 1.

Mitigation applied: `python-service/requirements.txt` pins `pandas<3`, with which
the solver imports and solves correctly on this machine.

**To verify on a machine without that policy:**

```bash
npm run check            # typecheck
npm test                 # Excel parsing + PDF template unit tests
npm run build:solver     # PyInstaller bundle (needs pyinstaller in python-service/venv)
npm run desktop:smoke    # headless e2e: migrations → solve → accept → conflicts
npm run desktop:dev      # interactive app
npm run desktop:build    # NSIS + AppImage/deb in release/
```

`desktop:smoke` is hermetic (all paths redirected to `.smoke-user-data/`) and
asserts migration v2, the pre-flight audit, generation, promotion and zero
conflicts.

Still needing a real application run (not covered by `desktop:smoke`):

1. **Reports → Export** for each of the four kinds, confirming a valid PDF opens
   and that the timetable grid paginates across sections.
2. One **Excel import** against a real workbook to confirm the commit path.
3. One **backup → restore** round-trip.

## 4. Explicitly not implemented

Do not claim these as working:

- **Server-side Excel export** — the per-page SheetJS export buttons remain
  client-side (they work offline, but there is no main-process export service).
- **Auto-update** (spec §14–17) — no `UpdateService`, no update UI, no
  pre-install backup gate; only the `publish` stub in `electron-builder.yml`.
- **Automatic backups** (spec §13) — manual backup/restore exists in
  Settings → Danger Zone; there is no scheduler-driven or pre-update backup.
- **Packaging artefacts** — never built; PyInstaller bundling and installer
  output are unverified.
- **Extra constraints** — section max periods/day (no schema column yet),
  lunch/fixed/preferred periods, room-type/capacity enforcement toggles in Settings.
- **Multiple institutions in the UI** — the schema and IPC support several, the
  UI works with one.
- **`mobile/`** — untouched, out of scope; `client/package.json` and
  `client/node_modules` are stale leftovers from the original layout.

## 5. Next recommended steps

1. Run `npm run desktop:smoke` on a machine that permits native modules — it
   covers everything this machine cannot execute and is the single highest-value
   check available.
2. Add a Data section that surfaces backups and import history in one place.
3. Implement the auto-update service with the pre-install backup gate
   (`docs/update-system.md`), then build installers and test a v1.0.0 → v1.0.1
   upgrade with data intact.
