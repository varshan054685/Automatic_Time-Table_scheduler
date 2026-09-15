# PHASE 1 — Architecture Report: Offline-First Mobile App (React Native / Expo)

**Project:** Automatic Timetable Scheduler
**Date:** 2026-08-13
**Status:** Analysis complete — no application code changed.

---

## 1. Repository Overview

```
client/           React 18 + Vite + TailwindCSS + Framer Motion + TanStack Query (web app, JSX)
server/           Express 5 + TypeScript (auth, CRUD, job queue, chatbot)
shared/           Drizzle schema + Zod route definitions shared by client and server
python-service/   FastAPI + Google OR-Tools CP-SAT (solver microservice)
migrations/       Drizzle SQL migration (partially out of sync with schema; DB managed via db:push)
docs/             Feature documentation + project knowledge base
excel/            Excel import templates
data/             Git-ignored local SQLite storage (root backend WIP — do not disturb)
```

Server files: `index.ts` (Express bootstrap, helmet, CORS, rate limiting, error handler),
`auth.ts` (Passport local + Google, sessions, OTP, profile), `routes.ts` (workspace-scoped
CRUD, change requests, generation, chatbot), `storage.ts` (Drizzle data access),
`db.ts` (pg Pool), `queue.ts` + `worker.ts` (in-memory generation queue),
`python-scheduler.ts` (HTTP client to FastAPI), `chatbot-docs.ts` (doc retrieval),
`rate-limit.ts`.

No test files exist anywhere in the repository. The mobile testing stack must be new.

---

## 2. Existing API Inventory

### Auth (`server/auth.ts`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /api/auth/register | public (rate-limited) | Requires OTP for email/phone; auto-login; returns {user, workspace} |
| POST | /api/auth/login | public (rate-limited) | identifier (email or phone) + password; sets session cookie; returns {user, workspace} |
| POST | /api/auth/request-otp | public | email/phone OTP |
| POST | /api/auth/verify-otp | public | |
| POST | /api/auth/forgot-password | public | OTP-based reset flow |
| POST | /api/auth/reset-password | public | |
| PATCH | /api/auth/profile | session | name/email/phoneNumber/avatar |
| GET | /api/auth/google | public | Passport redirect to Google |
| GET | /api/auth/google/callback | public | Redirects to web frontend after login |
| POST | /api/logout | session | Destroys session, clears cookie |
| GET | /api/user | session | {user, workspace: membership or null} |
| GET | /api/auth/config | public | { googleOAuthEnabled } (no secrets) |

### Workspaces (`server/routes.ts`)
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | /api/workspaces | session | Create workspace; caller becomes owner member |
| POST | /api/workspaces/join | session | Join via referral code |
| GET | /api/workspaces/current | member | {workspace, members:[{id,userId,role,email,name}]} |
| PATCH | /api/workspaces/current | owner | name/academicYear |
| POST | /api/workspaces/regenerate-code | owner | |
| DELETE | /api/workspaces/current | owner | Cascade-deletes all workspace data |
| POST | /api/workspaces/leave | member | Owners cannot leave |
| DELETE | /api/workspaces/members/:id | owner | |

### Master Data (`server/routes.ts`) — all workspace-scoped, IDOR-protected
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | /api/departments, /api/classrooms, /api/faculty, /api/sections, /api/subjects, /api/timeslots | member | List all for workspace |
| POST | same paths | owner | Create (no viewer fallback — viewers cannot create) |
| PATCH/DELETE | /:id | owner or viewer | viewerCheck intercepts viewer edits -> creates a change_request (202) |

### Timetable
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | /api/timetable?sectionId=&facultyId= | member | Entries joined with subject, faculty, classroom, timeSlot, section |
| POST | /api/generate-timetable | owner | {departmentId, semester?}; returns {message, jobId, status} (async) |
| POST | /api/timetable/regenerate-all | owner | Same, all sections |
| GET | /api/timetable/generation-status/:jobId | member | Poll status/completed/failed; workspace-scope check |

### Change Requests
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | /api/change-requests | member | Includes requester email/name |
| POST | /api/change-requests/:id/approve | owner | Applies the edit/delete via storage, marks approved |
| POST | /api/change-requests/:id/reject | owner | |

### Other
| Method | Path | Notes |
|---|---|---|
| POST | /api/chatbot | Gemini chatbot (online-only, requires GEMINI_API_KEY, rate-limited) |
| POST | /generate-timetable | Internal FastAPI solver (Python service, NOT exposed to clients) |

---

## 3. Existing Database Entities (PostgreSQL via Drizzle)

| Table | Key columns (relevant to mobile) |
|---|---|
| users | id, email, phoneNumber, password(hash), role (admin/staff), name, googleId, isVerified, avatar, createdAt |
| otp_verifications | email/phone, otp, type, expiresAt — cloud-only |
| workspaces | id, name, ownerId, referralCode, adminReferralCode, academicYear, createdAt |
| workspace_members | id, workspaceId, userId, role (owner/viewer), createdAt |
| change_requests | id, workspaceId, requestedBy, type (edit/delete), data(jsonb), status (pending/approved/rejected), createdAt |
| departments | id, workspaceId, name, code, createdAt |
| classrooms | id, workspaceId, roomNumber, capacity, type (lecture/lab), createdAt |
| faculty | id, workspaceId, name, code, departmentId, email, availability(jsonb string[]), createdAt |
| sections | id, workspaceId, name, year, semester, departmentId, classroomId, createdAt |
| subjects | id, workspaceId, code, name, weeklyHours, departmentId, facultyId, sectionId, type, createdAt |
| time_slots | id, workspaceId, dayOfWeek, startTime, endTime, label (NO createdAt) |
| timetable | id, workspaceId, sectionId, subjectId, facultyId, classroomId, timeSlotId (NO createdAt/updatedAt) |
| generation_jobs | id, workspaceId, totalSections, completedSections, failedSections, status, error, createdAt, updatedAt |
| generation_results | staging for generation; transient |

**Sync-relevant gap:** no updatedAt on any master-data table, no deletedAt/soft-delete anywhere,
no version column. `timetable` and `time_slots` have no timestamp at all. Incremental sync is
impossible without server-side change tracking.

---

## 4. Existing Authentication Flow

1. Session-cookie auth. Passport local strategy; express-session + memorystore.
   Cookie `connect.sid`, httpOnly, sameSite=none + secure in production, maxAge 24h.
2. Login/register respond with {userWithoutPassword, workspace: {workspaceId, role,
   workspaceName, referralCode, adminReferralCode, academicYear}}. The web client's `useUser()`
   relies on GET /api/user with credentials include.
3. OTP flow (registration + password reset) — always online.
4. Google OAuth — web redirect flow (passport-google-oauth20); callback returns to the web
   frontend. Only enabled when GOOGLE_CLIENT_ID/SECRET are set and not placeholders.
5. Logout destroys the session server-side and clears the cookie.

### Mobile implications
- There is NO token/JWT auth — the mobile app must persist the `connect.sid` cookie (from the
  Set-Cookie response header on login/register) in Expo SecureStore and attach it as the Cookie
  header on every request. This works: CORS already allows origin-less requests.
- Sessions are in-memory with a 24h lifetime and die on server restart. Mobile must treat a 401
  as "session expired -> re-login", while continuing to serve local data offline.
- Google OAuth is a browser redirect flow pointing at the web callback URL. For mobile this
  requires either (a) a new Google OAuth client + callback registration, or (b) expo-auth-session
  with a server-side adapter. Deferred to Phase 3 with a concrete proposal.

---

## 5. Existing Roles & Permission Model

- Global user role (users.role): always set to "admin" at registration; effectively unused.
- Workspace role (workspace_members.role):
  - owner — full CRUD on master data, workspace management, timetable generation, approve/reject change requests.
  - viewer — read-only on master data; PATCH/DELETE are intercepted (viewerCheck) and become
    change_requests (HTTP 202). Viewers CANNOT create records at all (no POST fallback).
- Enforcement is server-side (requireOwner, viewerCheck, requireResourceOwnership). The frontend
  only gates UI. The mobile app must do the same: gate UI by workspace.role, but never trust it;
  rely on backend 403/202 responses.

---

## 6. Existing Timetable Generation Flow

```
POST /api/generate-timetable (or /regenerate-all)   [owner, generationLimiter: 5/15min]
  -> storage.createGenerationJob() -> in-memory queue (server/queue.ts)
  -> worker (server/worker.ts) per section:
       fetch section/subjects/faculty/classrooms/timeslots
       build occupiedSlots from live timetable + staged results of earlier sections
       POST /generate-timetable -> FastAPI -> OR-Tools CP-SAT (20s/section, 8 workers)
  -> results written to generation_results (staging)
  -> atomic swap (promoteStagedEntries) into live timetable
  -> client polls GET /api/timetable/generation-status/:jobId
```

Constraints enforced by the Python solver (python-service/scheduler.py):
- Hard: each block in exactly one slot; no two classes share slot+room/faculty/section;
  labs contiguous, wholly in morning or afternoon, start at session start, break-aware;
  faculty <= 7h/day.
- Soft: maximize scheduled hours; minimize back-to-back repeats; minimize active days; minimize late periods.
- This is ONLINE-ONLY. There is no local/offline equivalent in the existing stack.

---

## 7. APIs Reusable by Mobile (as-is)

| Endpoint(s) | Purpose |
|---|---|
| POST /api/auth/login, /register, /request-otp, /verify-otp, /forgot-password, /reset-password, POST /api/logout, GET /api/user, /api/auth/config | Full auth except Google OAuth |
| GET /api/workspaces/current | Workspace + members (sync payload) |
| GET /api/departments|classrooms|faculty|sections|subjects|timeslots | Master-data download |
| GET /api/timetable | Timetable download (joined shape) |
| POST/PATCH/DELETE /api/* (owner) | Direct CRUD sync of local changes |
| PATCH/DELETE /api/*/:id (viewer) | Triggers change-request creation (202) — usable for offline replay |
| GET /api/change-requests, POST .../:id/approve, POST .../:id/reject | Change-request workflow |
| POST /api/generate-timetable, /api/timetable/regenerate-all, GET /api/timetable/generation-status/:jobId | Online generation (Phase 9) |
| POST /api/chatbot | AI assistant (online only) |
| PATCH /api/auth/profile | Profile updates (online) |

---

## 8. APIs That Need Modification / Addition

### Implemented (Phases 3 + 6)

1. **Change tracking columns** — migration `migrations/0002_sync_columns.sql` adds `client_id`,
   `version`, `updated_at`, `deleted_at` to all master-data tables, `timetable`, `change_requests`,
   and `workspace_members` (schema + storage updated in `shared/schema.ts` / `server/storage.ts`).
2. **Sync endpoints** (added to `server/routes.ts`, using the existing `requireWorkspace`):
   - `GET /api/sync/bootstrap` — workspace + members + all master data + timetable + change
     requests + `serverTime` cursor, one response.
   - `GET /api/sync/changes?since=<ISO>` — incremental CREATE/UPDATE/DELETE diff by
     updated_at/deleted_at, workspace-scoped.
   - `POST /api/sync/push` — batched client ops `{entityType, operation, clientId, serverId,
     baseVersion, payload}`; applies with optimistic-concurrency version checks and returns
     per-item `{ok | conflict | error}`. `requestedBy` for change requests is injected
     server-side (never client-trusted). Soft-deletes everywhere instead of hard deletes so
     offline clients can learn about removals.
3. **Google OAuth for mobile** — `POST /api/auth/google/mobile` (`server/auth.ts`) accepts a
   Google ID token, verifies it against Google's tokeninfo endpoint, links/creates the user,
   and issues the same Passport session cookie as the web flow. No OAuth secrets on-device.

### Not implemented
- `GET /api/sync/status` was deemed unnecessary (the client tracks its own cursor). Sync uses
  the existing general `apiLimiter`; a dedicated sync limiter can be added if load demands.

### Alternative (no new push endpoint)
Replay offline ops through the existing CRUD endpoints (PATCH/DELETE). Reuses all business logic
(incl. viewerCheck) but loses atomic batch + server-side conflict detection. The push endpoint
was chosen because the project requires versioned conflict detection, which the current PATCH
endpoints cannot express.

---

## 9. Data That Should Be Stored Locally (SQLite)

| Entity | Why local | Notes |
|---|---|---|
| session (cookie + user profile) | Offline session | SecureStore for the cookie; user row in SQLite |
| workspaces (the user's one workspace) | Dashboard/context | |
| workspace_members | Profile/settings display | |
| departments, classrooms, faculty, sections, subjects, time_slots | Master data browsing + editing offline | Sync metadata per row |
| timetable entries (with joined refs) | Offline timetable, search, filters, conflicts | Store refs; join locally for display |
| change_requests | Offline request creation + status visibility | Mirror server status after sync |
| sync_metadata | Last-sync time, per-entity cursors/watermarks | |
| sync_queue | Pending offline ops (idempotency keys) | |

NOT stored locally: otp_verifications, generation_jobs, generation_results, auth/OTP internals,
full users table (only the signed-in user + member list rows).

---

## 10. Data That Must Remain Cloud-Only

- Registration, OTP, password reset, Google OAuth (all require internet by design).
- Timetable generation (Python/OR-Tools) — online; mobile polls status.
- AI chatbot — online only; show "internet required" offline.
- Excel import/export — web feature; mobile Excel is out of scope for v1.
- Workspace creation/join/leave/delete, member management.
- Anything involving generation_jobs/generation_results (transient server state).

---

## 11. Potential Offline Conflicts (Multi-User)

1. Master-data row edited by two users offline (e.g. faculty name/departmentId, classroom
   capacity) -> version/updated_at mismatch. Resolution: server version, local version, or manual
   pick (per entity policy).
2. Owner regenerates the timetable while a viewer has offline edits or cached entries -> the
   server replaces whole timetable per section. Mobile must detect a generation watermark change
   and refresh, flagging any local timetable-related edits as conflicting.
3. Viewer offline edit vs owner approve/reject of that same edit — change-request status diverges;
   sync must reconcile status + applied data.
4. Delete conflicts — a row deleted server-side while offline edits target it (404 on push).
5. Create conflicts — server has no client-generated UUIDs; offline-created rows need a client
   UUID + temp id mapping (serverId after sync) to avoid duplicates on retry. Current server uses
   serial IDs only, so offline creates need either client UUIDs (schema change) or upload-before-use
   ordering. Flagged as a required design decision.
6. Duplicate sync triggers (network flake) -> idempotency keys in sync_queue.

---

## 12. Recommended Mobile Architecture

### Stack
- Expo SDK (current stable), TypeScript strict, Expo Router, NativeWind, React Navigation under
  the hood, TanStack Query (server-state mirror on top of SQLite), expo-sqlite + Drizzle ORM
  (drizzle-orm/expo-sqlite) — reuses the project's Drizzle conventions for the local DB,
  expo-secure-store, react-native-reanimated, react-native-gesture-handler.
- expo-network / NetInfo for connectivity + an HTTP probe for real reachability.

### Data flow (offline-first)
```
UI (hooks) -> SQLite (source of truth) <- sync engine
                                         | (queued ops / downloads)
                                    Express API (only for sync + online features)
```
- Reads always hit SQLite via Drizzle repositories. TanStack Query keys are hydrated from SQLite
  and invalidated when sync writes complete.
- Writes go to sync_queue first (with idempotency key + base version), then local SQLite is
  updated optimistically; the sync engine replays the queue online.

### Sync engine design
- One sync job at a time (singleton guard/mutex) to avoid duplicate processes.
- Bootstrap on first login after auth; then incremental via `since` cursor.
- Upload pending ops -> download server changes -> merge -> write SQLite -> update sync_metadata.
- Retry with exponential backoff; failed ops stay in queue with error state and a retry affordance.
- Conflict resolution: version compare; policies per entity (server wins for timetable/sections,
  manual for faculty/classrooms), surfaced via a conflict resolution screen. Never silently drop.

### App startup
Load SecureStore session -> open SQLite -> if cached workspace exists, show app immediately ->
check network -> if online run sync (background) -> if offline continue.

### Proposed mobile directory (adapted from the brief)
```
mobile/
  app/ (expo-router) — (auth)/login, register, otp, forgot-password; (tabs)/dashboard,
       timetable, requests, data, profile; timetable/[id]; generate; settings
  database/ sqlite.ts, schema.ts, migrations.ts, repositories/*
  sync/ sync-engine.ts, sync-queue.ts, upload.ts, download.ts, conflict-resolution.ts, connectivity.ts
  services/ api.ts, auth.ts, timetable.ts, master-data (faculty/subjects/etc.), requests.ts
  hooks/, stores/, components/, types/, utils/, constants/
```

---

## 13. Phase Plan (implementation order)

| Phase | Deliverable |
|---|---|
| 1 — Analysis | This report (complete) |
| 2 — Mobile foundation | Expo + Router + NativeWind + SQLite + SecureStore + theme + components |
| 3 — Authentication | Login/register/OTP/forgot-password, cookie session in SecureStore, protected routes; Google OAuth proposal |
| 4 — Local database | Drizzle/expo-sqlite schema + repositories (mirror of entities) |
| 5 — Offline UI | Dashboard, timetable, master data, profile — all read from SQLite |
| 6 — Sync engine | Server changes first (updatedAt/deletedAt/version + sync endpoints), then bootstrap/incremental/upload/retry/conflict/status |
| 7 — Offline editing | Queue + replay for permitted ops (owner direct; viewer -> change requests) |
| 8 — Timetable UX | Day cards, search/filter, details, conflict indicators |
| 9 — Generation | Phase A: online OR-Tools via existing endpoints + status polling; Phase B: local validation engine; Phase C: research local solver (document limits honestly) |
| 10 — AI | Chatbot via /api/chatbot; offline banner |
| 11 — Polish | Animations, a11y, empty/error/offline states, sync indicators |
| 12 — Production | Android build, emulator + device + airplane-mode testing |

**Phase 6 is the critical dependency:** the current server cannot do incremental or
conflict-detecting sync without the schema + endpoint additions described in section 8.

---

## 14. Risks / Constraints / Notes

- Session store is in-memory — restart kills sessions; mobile must handle re-auth gracefully.
- Rate limits (apiLimiter 1000/15min, authLimiter 10/15min) — sync must be coalesced (single job,
  debounced, no poll-every-second patterns). A dedicated syncLimiter is recommended.
- No soft deletes / no versioning server-side today — required work, not optional.
- Offline creates need a client-ID strategy (UUID columns or deferred serverId mapping).
- The root project has uncommitted WIP (SQLite fallback additions, better-sqlite3, data/ dir,
  avatar column). Mobile work must not depend on or disturb it.
- No existing tests — mobile will introduce jest-expo + unit tests for repositories, sync queue,
  conflicts, and offline scenarios.
- Python scheduler constraints are the spec for the local validator (faculty <= 7h/day, lab
  contiguity/morning-afternoon, no double booking). A full CP-SAT equivalent on-device is Phase 9
  Phase C research; do not fake it.
