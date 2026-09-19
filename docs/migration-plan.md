# Migration Plan — Web SaaS → Offline Desktop

> Phase 2 deliverable. Production code changes start **only after approval** of this plan.
>
> **Current progress: see [`implementation-status.md`](./implementation-status.md)** —
> phases 1–4 are implemented, phase 5 is mostly done, 6–8 remain.

## 1. Current architecture (summary)
React+Vite SPA → Express/TS API (passport auth, workspaces, change requests, sync) → PostgreSQL/Drizzle → axios → FastAPI + OR-Tools CP-SAT → staging → atomic promote. Full trace in offline-architecture.md.

## 2. Reuse / Replace / Delete

| Disposition | Items |
|---|---|
| **Reuse** | CP-SAT solver core (`scheduler.py` logic), React pages/UI kit/TimetableGrid, zod validation patterns, Excel templates & SheetJS parsing, staging→promote workflow, health calculators |
| **Replace** | Express API → IPC services; PostgreSQL/Drizzle → better-sqlite3 + migration runner; auth/workspaces → local institutions; axios→localhost:8000 → managed Python process; HTTP polling → IPC events; client-side import → validated preview pipeline; print CSS → printToPDF reports; destructive `script/migrate.ts` → versioned migrations |
| **Delete** | `server/auth.ts`, chatbot (Gemini), SendGrid/SMTP/OTP, referral/member/change-request flows, `/api/sync/*`, `vercel.json`, Replit plugins, `data/*.sqlite` artifacts, OAuth env plumbing |

## 3. Implementation phases

| # | Phase | Key deliverables |
|---|---|---|
| 0 | **Approvals** | This plan signed off; GitHub repo + release pipeline decisions confirmed |
| 1 | **Foundation** | `electron/` main+preload (secure defaults), Vite/electron dev workflow, better-sqlite3 service in `userData`, migration runner v1 schema, app settings |
| 2 | **Core data** | IPC CRUD for institutions/years/departments/classes/sections/subjects+assignments/teachers+availability/classrooms/time slots; React Query hooks rewired from `fetch(apiUrl)` → `window.api.*`; institution/year switcher; remove login/workspace UI |
| 3 | **Scheduler** | Python package restructure (model_builder/constraints/diagnostics/solver/service), PyInstaller bundling, SchedulerService with spawn/health/cancel/backoff, staging jobs + IPC progress, safe promote w/ timetable_versions, explainable failures in UI |
| 4 | **Data features** | Excel import preview (validate → review errors → commit) & export for all entities; PDF export via printToPDF (timetable, teacher workload, room utilization, analytics); BackupService (manual + auto before update/migration/restore/destructive ops) |
| 5 | **Reports & settings** | Dashboard analytics, Reports section (workload/utilization), Settings (General/Data/Updates/About), generation history view |
| 6 | **Auto-update** | electron-updater + GitHub Releases, state machine UI, pre-install backup gate, migration-on-startup flow |
| 7 | **Packaging** | electron-builder NSIS + AppImage/deb, icons, CI matrix (Win/Linux), smoke tests, fresh-install + upgrade-install verification |
| 8 | **Cleanup** | Delete `server/`, `migrations/` (pg), `vercel.json`, cloud deps & pages; final dependency prune; docs refresh |

## 4. Data migration strategy
No automatic PostgreSQL→SQLite conversion ships. Existing users migrate via Excel export → desktop import (templates preserve the current column conventions). The old web app copy stays untouched as the reference.

## 5. Testing matrix (spec §26)

- **DB**: CRUD round-trips, backup create/restore/list/delete, migration fresh + upgrade + failure-rollback, corrupt DB handling.
- **Scheduler**: valid generation, no teacher/room/section clashes, lab contiguity, availability respected, impossible constraints → INFEASIBLE + diagnostics, timeout → TIMEOUT, cancel mid-run, partial generation.
- **Offline** (airplane mode): launch, all CRUD, generation, Excel import/export, PDF, backup/restore.
- **Updates**: packaged v1.0.0→v1.0.1 (data survives, backup exists, migration runs, restart OK), update-server down, backup failure postpones install, migration failure → restore path.

## 6. Risks

| Risk | Mitigation |
|---|---|
| better-sqlite3 native ABI vs Electron | electron-rebuild in postinstall; pinned versions; CI smoke test |
| PyInstaller bundle size / AV false positives on Windows | code-sign when available; document exclusions; onedir over onefile |
| Solver behavior regression after restructure | golden tests on fixture payloads before/after refactor (same input → same hard-constraint output) |
| UI rewiring breadth (13 pages) | domain-by-domain migration with a thin `apiClient` shim so pages change minimally |
| Scope creep on new constraints | constraint registry ships with the current constraint set + availability + room type/capacity; the rest are opt-in additions |

## 7. Explicitly out of scope (this transformation)
- React Native/mobile parity (kept untouched), cloud sync, multi-user roles, telemetry, online AI.

## 8. UI navigation target (spec §20)

```text
Dashboard
Academic Setup: Years · Departments/Classes · Sections · Subjects · Teachers · Classrooms · Time Slots
Scheduling: Generate · Timetable · Conflicts · History
Data: Import · Export · Backups
Reports: Timetable · Teacher Workload · Room Utilization · Analytics
Settings: General · Data · Updates · About
```

Existing pages map cleanly onto this; Sidebar.jsx is restructured, wouter routes kept.
