# Current Architecture Analysis → Offline Desktop Transformation

> **Historical document.** This is the Phase 1/2 *as-is* analysis of the original
> online application, written before any code was changed. Everything below the
> "Current Architecture" heading describes the legacy stack (Express, PostgreSQL,
> OAuth, cloud workspaces) that has since been **removed** — it is kept as the
> rationale for the transformation, not as a description of the shipped app.
> For the live state see `implementation-status.md`; for the target see
> `desktop-architecture.md`.

> Phase 2 deliverable. Analysis only — no production code modified.

## 1. Current Architecture (as-is)

```text
Browser (React 18 + Vite SPA, client/)
   │  HTTP fetch + session cookie (apiUrl() → localhost:5000 / VITE_API_URL)
   ▼
Node.js Express API (TypeScript, server/)
   │  helmet · cors · rate-limit · express-session (memory store)
   │  passport (local email/phone + Google OAuth) · OTP via SendGrid/SMTP
   │  Drizzle ORM
   ▼
PostgreSQL (Supabase/Render — DATABASE_URL in .env)
   ▲
   │  axios POST http://127.0.0.1:8000/generate-timetable (190s timeout)
Python FastAPI microservice (python-service/)
   │  scheduler.py — Google OR-Tools CP-SAT
   ▼
JSON timetable rows → staging table → atomic promote → live `timetable`
```

### Component inventory

| Area | Files | Notes |
|---|---|---|
| React SPA | `client/src` (pages/, components/, hooks/, lib/) | 13 pages, AppShell/Sidebar layout, TimetableGrid, TanStack Query, wouter, framer-motion |
| Auth | `server/auth.ts` (913-line pair with routes), passport-local + Google OAuth, OTP (SendGrid/SMTP), bcrypt, sessions | Fully cloud-oriented |
| API routes | `server/routes.ts` | workspaces, change-requests, master-data CRUD, generation, sync endpoints |
| Data layer | `server/storage.ts` (765 lines), `server/db.ts` (pg Pool) | All queries workspace-scoped, soft deletes, sync columns (clientId, version, deletedAt) |
| Job queue | `server/queue.ts`, `server/worker.ts` | In-memory queue, sequential per-section solves, staging → atomic promote |
| Python bridge | `server/python-scheduler.ts` | Thin axios wrapper → `http://127.0.0.1:8000` |
| Scheduler | `python-service/scheduler.py` (~430 lines), `app.py` (FastAPI), `solve.py` (CLI harness) | CP-SAT model — see §4 |
| Excel | Client-side SheetJS (`xlsx`) in 6 pages; templates in `excel/` | No server-side validation; rows POSTed straight to CRUD APIs |
| PDF | None — only `window.print()` + print CSS in TimetableGrid | |
| Cloud deploy | `vercel.json` (static SPA), Render callback URL hardcoded in `auth.ts` | |
| Mobile | `mobile/` — Expo React Native client w/ expo-sqlite, sync service hitting `/api/sync/*` | Out of scope (kept untouched) |
| Migrations | `migrations/` (drizzle-kit SQL) + `script/migrate.ts` (**destructive**: DROPs all tables then re-applies) | No real versioned migration runner |
| Misc | `server/chatbot-docs.ts` + `/api/chatbot` (Gemini), referral codes, change requests | Cloud/AI features |
| Leftover | `data/timetable.sqlite*` artifacts, `better-sqlite3` already in deps (unused by server code) | SQLite path is already half-prepared |

## 2. Reusable as-is (or nearly)

- **`python-service/scheduler.py`** — the CP-SAT model (see §4). Core logic preserved; will be extended, not rewritten.
- **React UI kit** — `components/ui/*` (Radix/shadcn), `TimetableGrid.jsx`, `StatCard.jsx`, `AppShell.jsx`, page shells, `settings/helpers.js` health calculators.
- **Data model semantics** — departments/classrooms/subjects/faculty/sections/timeslots CRUD shapes, zod validation schemas in `routes.ts`, `TimetableGrid` slot-merging logic.
- **Excel templates** — `excel/*.xlsx` structure and column conventions.
- **Job staging concept** — `generation_jobs` + `generation_results` staging + atomic promote is exactly the "timetable data safety" workflow; carries over to desktop.
- **Health/analytics helpers** — setup/timetable health scoring logic.

## 3. Replace / Redesign

| Current | Replacement |
|---|---|
| Express API over HTTP with cookie sessions | Electron main-process services exposed via **narrow, validated IPC** (`window.api.*`) |
| PostgreSQL + Drizzle | **SQLite (better-sqlite3)** in `app.getPath("userData")` + hand-rolled versioned migration runner |
| Workspaces + members + referral codes + change requests | **Local institutions** (multiple allowed) + academic years; no membership concept |
| Passport auth (local/Google/OTP/email) | **Removed** for v1; optional local profile lock later (§ "Auth") |
| axios → `http://127.0.0.1:8000` with hardcoded URL | **Python process manager**: spawn bundled solver service on 127.0.0.1 with random free port, health-check, restart-on-crash |
| In-memory queue polling via HTTP | Generation jobs managed by main process; **progress events pushed over IPC** (no polling) |
| Client-side SheetJS import straight to API | Main-process import pipeline: parse → **validate/preview report** → user confirms → transactional write |
| `window.print()` PDF | Electron `webContents.printToPDF()` report service |
| `script/migrate.ts` (drop-all) | Real migration runner with schema_version, backup-before-migrate, rollback-to-backup on failure |

## 4. Delete (after UI rewiring is verified)

- `server/auth.ts`, passport/passport-google/express-session/memorystore/connect-pg-simple/bcrypt deps
- `server/chatbot-docs.ts`, `/api/chatbot`, `@google/genai`, Gemini env vars
- `@sendgrid/mail`, `nodemailer`, `resend` and all OTP/email flows
- Referral-code, workspace-member, change-request, invite flows (UI: `ReferralPage.jsx`, `RequestsPage.jsx`, `WorkspaceSetupDialog.jsx`, `settings/ReferralsSection.jsx`, `settings/RequestsSection.jsx`)
- `/api/sync/*` endpoints and sync columns (`clientId`, `version`, `deletedAt`) — server was the sync authority; desktop is the single source of truth
- `vercel.json`, Render/Vercel env plumbing, CORS origin lists
- Replit vite plugins
- `data/*.sqlite` artifacts from the repo (gitignored output dir instead)
- `mobile/` — untouched during transformation; removal decision deferred (see migration-plan.md §14)

## 5. Current Generation Flow (traced end-to-end)

1. UI `Timetable.jsx` → `useRegenerateAll()` → `POST /api/timetable/regenerate-all`.
2. `routes.ts` loads all workspace sections → `addGenerationJobs(wsId, sections)` creates a `generation_jobs` row and enqueues one in-memory job per section.
3. `queue.ts` processes sections **sequentially**; per section `worker.ts`:
   - loads section, its subjects (sectionId match **or** department-shared with null sectionId), faculty referenced by those subjects, all classrooms, all timeslots;
   - builds `occupiedSlots` from (a) live timetable of *other* sections and (b) staged results of *earlier sections in this job* — sequential cross-section conflict avoidance;
   - derives `days` from timeslots; calls Python `POST /generate-timetable` (timeout 190s).
4. `scheduler.py` solves (20s cap) → returns flat rows `{day, period(label), sectionId, subjectId, facultyId, room(roomNumber)}`.
5. Worker maps room/label strings back to ids, writes rows to **staging** (`generation_results`).
6. After all sections: 0 failed → atomic promote (delete live rows for succeeded sections, insert staged) → job `completed`; some failed → promote what succeeded → `partial`; all failed → cleanup → `failed`.
7. UI polls `/api/timetable/generation-status/:jobId` every 2s; on terminal state invalidates timetable query and toasts.

**Weaknesses carried into the redesign:** no cancellation; no timeout escalation; failure message is a single opaque string; greedy sequential solves can cascade (a tight section solved late gets the leftovers); teacher availability is stored but never sent to the solver; room type/capacity ignored.

## 6. Proposed Desktop Generation Flow

```text
React UI
   │  IPC: scheduler.generate({institutionId, yearId, sectionIds})   (renderer never blocks)
   ▼
Electron main — SchedulerService
   │  1. ensure Python solver running (spawn once, health-check, random port)
   │  2. assemble payload from SQLite (per section, like worker.ts today)
   │  3. pre-flight feasibility audit → structured diagnostics before solving
   │  4. POST solve → job progress events over IPC (sections done/failed/total)
   │  5. write results to staging; status: optimal|feasible|infeasible|timeout|error
   ▼
UI shows staged result → user accepts → promote staging → live (previous rows
archived to timetable_versions for restore)
```

Cancellation: IPC `scheduler.cancel(jobId)` → abort HTTP call + Python job cancel; staged rows discarded. Progress is event-driven (no HTTP polling). Solver timeouts configurable in Settings (default 20s/section, escalate to 60s on `unknown` status once).
