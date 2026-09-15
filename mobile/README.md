# Timetable Mobile

Offline-first React Native companion app for the **Automatic Timetable Scheduler**.
The mobile app is an additional client of the existing Express + PostgreSQL +
OR-Tools backend — it never talks to the database directly and never invents a
second backend.

See `../docs/mobile-architecture.md` for the Phase 1 architecture report.

## Stack

- Expo SDK 57 (React Native 0.86, React 19, TypeScript strict)
- Expo Router (file-based navigation, typed routes)
- NativeWind (Tailwind CSS for React Native)
- expo-sqlite (local database, migrations in `database/migrations.ts`)
- expo-secure-store (Passport session cookie — never passwords/keys)
- TanStack Query (cached mirrors of local SQLite reads)
- @react-native-community/netinfo + reachability probe (connectivity)
- expo-auth-session + expo-web-browser (Google OAuth → backend ID-token exchange)

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_URL (+ Google client IDs for OAuth)
npm start              # or: npm run android
```

### Google OAuth (optional)

Google sign-in needs a web/native OAuth client configured in Google Cloud.
Set the matching client ID in `.env`:

```
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-web-or-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
```

The token is exchanged with the backend's `POST /api/auth/google/mobile`
endpoint — OAuth secrets never ship on the device.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` / `npm run ios` | Launch on a device/emulator |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify:db` | Runs the SQLite migrations against Node SQLite and validates the schema |
| `npm run verify:sync` | Unit-check sync queue idempotency + conflict-resolution semantics |

## Architecture (offline-first)

```
UI (hooks) → SQLite (source of truth) ← sync engine
                                        ↕ queued ops / incremental downloads
                                   Express API (only for sync + online features)
```

- Screens read from SQLite. The API is reserved for authentication,
  synchronization, generation, and the chatbot.
- Every synchronizable entity carries `server_id`, `client_id`, `workspace_id`,
  `version`, `created_at`, `updated_at`, `deleted_at`, `sync_status`.
- `sync_queue` records offline CREATE/UPDATE/DELETE operations with idempotency
  keys; the sync engine (`sync/`) pushes them in one batch and reconciles
  per-item results (ok / conflict / error).

## Sync engine

- `services/sync.ts` — API client for `/api/sync/bootstrap`, `/api/sync/changes`,
  `/api/sync/push` (server endpoints added in Phase 6).
- `sync/download.ts` — applies bootstrap + incremental changes to SQLite;
  rows with local pending edits are never silently overwritten.
- `sync/upload.ts` — batched push of queued operations; conflicts are marked
  and surfaced for resolution.
- `sync/conflict-resolution.ts` — server-wins / local-wins / dismiss per item.
- `sync/sync-engine.ts` — single-flight orchestration (upload → download →
  cursor), drives the sync status store.
- `hooks/use-sync.ts` — runs the engine on sign-in and on offline→online
  transitions.

## Offline capabilities

- Authenticated offline session (cookie in SecureStore, snapshot in SQLite) —
  the app opens immediately with no network request.
- View timetable by day with search + inline conflict indicators.
- Browse master data (departments, faculty, subjects, sections, classrooms,
  time slots).
- Owners: create/edit/delete master data offline (queued, synced later).
- Viewers: submit edit/delete change requests offline for owner approval.
- Offline validation of double bookings and missing references.

## Online-only

- First login / registration / OTP / password reset / Google OAuth.
- Timetable generation (cloud OR-Tools solver, polled to completion).
- Change-request approve/reject.
- AI chatbot (Gemini via backend).
- Workspace create/join.

## Phase status

- **Phase 1** ✅ Analysis (`../docs/mobile-architecture.md`)
- **Phase 2** ✅ Mobile foundation
- **Phase 3** ✅ Authentication (login, register + OTP, forgot/reset, Google)
- **Phase 4** ✅ Local database (SQLite schema + repositories)
- **Phase 5** ✅ Offline master-data UI (reads from SQLite)
- **Phase 6** ✅ Sync engine (bootstrap, incremental, queue, conflicts)
- **Phase 7** ✅ Offline editing + change requests
- **Phase 8** ✅ Timetable UX (day cards, search, conflicts)
- **Phase 9** ✅ Online generation + offline validation (local solver
  documented as not feasible — cloud solver stays authoritative)
- **Phase 10** ✅ AI chatbot (online-only, graceful offline state)
- **Phase 11** ✅ Polish (sync status, empty/loading/error states)
- **Phase 12** ⏳ Production device testing (needs an Android emulator/physical
  device — not available in this environment)
