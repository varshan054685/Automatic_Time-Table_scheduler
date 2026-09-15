# Desktop Architecture (Electron)

> Phase 2 deliverable.

## 1. Process model

```text
┌────────────────────────── Electron app ──────────────────────────┐
│ Main process (Node)                                              │
│  ├── DatabaseService   better-sqlite3, migrations, queries       │
│  ├── SchedulerService  spawn/manage Python solver, job queue     │
│  ├── ExcelService      xlsx parse/validate/write                 │
│  ├── PdfService        webContents.printToPDF                    │
│  ├── BackupService     file copies + verification                │
│  ├── SettingsService   app_settings table                        │
│  ├── UpdateService     electron-updater (GitHub Releases)        │
│  └── Logger            electron-log → userData/logs              │
│        ▲ validated IPC (ipcMain.handle)                          │
│ Preload (contextBridge → window.api.*)                           │
│        ▲                                                         │
│ Renderer: existing React app (Vite build), wouter, react-query   │
└──────────────────────────────────────────────────────────────────┘
              │ spawn (localhost, random port, 127.0.0.1 only)
              ▼
   Python solver service (PyInstaller bundle): FastAPI + OR-Tools CP-SAT
```

New top-level folder: `electron/` (`main.ts`, `preload.ts`, `services/*.ts`). React app stays in `client/` and is loaded in production from `dist/public` via `loadFile`, in dev via `ELECTRON_START_URL` (Vite dev server).

## 2. Security (spec §22)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity` default.
- No `remote` module; no `shell.openExternal` on arbitrary URLs; file dialogs via `dialog.showOpenDialog` with configured filters/paths only.
- Every `ipcMain.handle` validates its arguments with zod schemas (reusing `shared/` validation style) before touching services; returns typed results `{ok, data | error}`.
- CSP set on the BrowserWindow; renderer has zero Node access — only the whitelisted `window.api` surface below.

## 3. IPC API (narrow, domain-scoped — spec §1)

```text
window.api.institutions   { list, create, update, delete }
window.api.academicYears  { list, create, activate, delete }
window.api.departments    { list, create, update, delete }
window.api.classes        { list, create, update, delete }
window.api.sections       { list, create, update, delete }
window.api.subjects       { list, assignments, create, update, delete, assign }
window.api.teachers       { list, availability, create, update, delete, setAvailability }
window.api.classrooms     { list, create, update, delete }
window.api.timeSlots      { list, bulkCreate, create, update, delete }
window.api.timetable      { get(filters), versions, promote(versionId), restore(versionId), entries() }
window.api.dashboard      { stats() }
window.api.scheduler      { generate(opts), cancel(jobId), job(jobId), history(), onProgress(cb) }
window.api.excel          { preview(fileKind, path), commit(batchId), export(kind, path) }
window.api.pdf            { exportTimetable(opts), exportReport(kind, path) }
window.api.backup         { list, create, restore(id), delete(id), exportData, importData }
window.api.settings       { get, set }
window.api.updater        { status(), check(), download(), install(), onUpdateEvent(cb) }
window.api.system         { openPath(kind), version() }
```

- Event streams (`onProgress`, `onUpdateEvent`) are push-only; the renderer cannot invoke arbitrary channels.
- Channel naming `api:<domain>:<action>`; one zod schema table per domain in `electron/ipc-schemas.ts`.

## 4. Python scheduler lifecycle (spec §7)

- **Dev**: spawn `venv/Scripts/python -m uvicorn app:app --port <random>` from `python-service/` (Windows) / `python3 -m uvicorn` (Linux).
- **Prod**: PyInstaller `onedir` bundle at `resources/solver/timetable-solver(.exe)` (built per-OS on CI); spawn that binary with `--port 0 --host 127.0.0.1`; the service prints its chosen port on stdout, main process parses it, then polls `GET /health` (250 ms → backoff, 30 s cap).
- **Lifecycle**: start lazily before first generation (and proactively on app start after idle); kill on `before-quit` (SIGTERM then kill); crash → auto-restart with exponential backoff (3 attempts); generation request during outage → structured `{status: ERROR, diagnostics: ["Scheduler service unavailable…"]}` instead of a hang.
- **Timeouts**: per-section solve limit from settings (default 20 s); HTTP call timeout = limit × 2; job-level hard cap.
- No internet dependency — everything binds to `127.0.0.1`.

## 5. Generation job system (spec §10)

- `SchedulerService` owns an in-process job runner (sequential per section, mirrors current queue semantics + staged conflict avoidance).
- Progress events over IPC after each section: `{jobId, completed, failed, total, currentSection}` → UI progress bars without polling.
- Cancellation via `scheduler.cancel(jobId)`: aborts in-flight HTTP solve, flags job `cancelled`, discards staging rows.
- Terminal states: `completed | partial | failed | cancelled`; per-section `solver_status` and diagnostics stored in `generation_job_sections`/`generation_jobs.diagnostics_json`.
- Safe apply: results land in `generation_results_staging` → UI previews → user accepts → new `timetable_versions` row created and activated; previous version retained for restore (spec §11).

## 6. Packaging (spec §8, Phase 8)

- **electron-builder** targets: NSIS installer (Windows x64), AppImage + deb (Linux x64).
- Native module handling: `better-sqlite3` rebuilt for Electron ABI (`electron-rebuild` in install script); PyInstaller bundle shipped under `extraResources`.
- Icons for both platforms; product name "Automatic Timetable Scheduler"; appId `com.timetablescheduler.app`.
- GitHub Releases as publish provider (feeds UpdateService — see update-system.md).
- CI builds both OS artifacts, runs smoke tests (launch → db created → solver health → generate sample), then drafts a release.

## 7. Logging (spec §23)

`electron-log` rotating files in `userData/logs`: `main.log` (startup, IPC errors), `db.log` (migrations, query errors), `scheduler.log` (spawn/health/jobs/failures), `updater.log`. No user academic content logged; PII-free by construction.
