# Project Knowledge Base

A complete reference for the AI Timetable Scheduler application — for use by the AI Project Assistant, developers, and technical contributors.

---

## Application Overview

The AI Timetable Scheduler is a multi-user SaaS web application that generates conflict-free academic timetables for educational institutions using constraint programming. Users set up their academic master data and the system produces weekly schedules automatically, enforcing hard constraints (no double-bookings) and optimising soft constraints (compact schedules, back-to-back classes).

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, TanStack Query, Wouter |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Auth | Passport.js (Local + Google OAuth 2.0), express-session, bcrypt |
| Scheduler | Python 3, FastAPI, Google OR-Tools CP-SAT |
| Email | SendGrid (primary), Nodemailer/SMTP (fallback) |
| Validation | Zod (both client and server) |
| Excel I/O | SheetJS (xlsx) |

---

## Architecture

```
Browser (React/Vite)
        ↕  HTTP / JSON
Express Server (Node.js/TypeScript)
        ↕  Drizzle ORM
PostgreSQL Database
        ↕  HTTP (internal)
Python FastAPI Microservice (OR-Tools Solver)
```

The Node.js backend handles all auth, CRUD, workspace management, job queue management, and result staging. The Python service is called per-section with the full scheduling payload and returns a timetable or an error. The Node backend manages atomic promotion from staging → live timetable.

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `users` | User accounts (email, phone, password hash, Google ID, role) |
| `otp_verifications` | Temporary OTP records for registration and password reset |
| `workspaces` | Workspace containers with owner, name, academic year, and two invite codes |
| `workspace_members` | Many-to-many: users ↔ workspaces with a role field |
| `change_requests` | Queued edit/delete requests from Viewer-role members |
| `departments` | Academic departments scoped to a workspace |
| `classrooms` | Physical rooms scoped to a workspace |
| `faculty` | Teaching staff scoped to a workspace |
| `sections` | Class cohorts (year, semester, department) scoped to a workspace |
| `subjects` | Courses with weekly hours, type, faculty, section assignments |
| `time_slots` | Day + time + label records defining the weekly period grid |
| `timetable` | Live timetable entries (section × subject × faculty × classroom × timeslot) |
| `generation_jobs` | Job tracking records for async timetable generation |
| `generation_results` | Staging table for generation output before atomic promotion |

---

## Key Server Middleware

| Middleware | File | Purpose |
|---|---|---|
| `requireWorkspace` | `server/routes.ts` | Validates session, resolves workspace membership, injects `workspaceId` and `workspaceRole` |
| `requireOwner` | `server/routes.ts` | Blocks non-owner access to mutation endpoints (403) |
| `requireResourceOwnership` | `server/routes.ts` | Prevents IDOR by verifying resource belongs to the session's workspace (404 if not) |
| `viewerCheck` | `server/routes.ts` | Intercepts Viewer PATCH/DELETE and creates a change request instead |
| `authLimiter` | `server/rate-limit.ts` | 10 req / 15 min per IP for auth endpoints |
| `apiLimiter` | `server/rate-limit.ts` | 1000 req / 15 min per IP for general endpoints |
| `generationLimiter` | `server/rate-limit.ts` | 5 req / 15 min per IP for timetable generation |

---

## API Endpoint Reference

### Auth
| Method | Path |
|---|---|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/request-otp` |
| POST | `/api/auth/verify-otp` |
| POST | `/api/auth/forgot-password` |
| POST | `/api/auth/reset-password` |
| PATCH | `/api/auth/profile` |
| GET | `/api/auth/google` |
| GET | `/api/auth/google/callback` |
| POST | `/api/logout` |
| GET | `/api/user` |
| GET | `/api/auth/config` |

### Workspaces
| Method | Path |
|---|---|
| POST | `/api/workspaces` |
| POST | `/api/workspaces/join` |
| GET | `/api/workspaces/current` |
| PATCH | `/api/workspaces/current` |
| POST | `/api/workspaces/regenerate-code` |
| DELETE | `/api/workspaces/current` |
| POST | `/api/workspaces/leave` |
| DELETE | `/api/workspaces/members/:id` |

### Master Data (all workspace-scoped)
| Method | Path |
|---|---|
| GET/POST | `/api/departments` |
| PATCH/DELETE | `/api/departments/:id` |
| GET/POST | `/api/classrooms` |
| PATCH/DELETE | `/api/classrooms/:id` |
| GET/POST | `/api/faculty` |
| PATCH/DELETE | `/api/faculty/:id` |
| GET/POST | `/api/sections` |
| PATCH/DELETE | `/api/sections/:id` |
| GET/POST | `/api/subjects` |
| PATCH/DELETE | `/api/subjects/:id` |
| GET/POST | `/api/timeslots` |
| PATCH/DELETE | `/api/timeslots/:id` |

### Timetable
| Method | Path |
|---|---|
| GET | `/api/timetable` |
| POST | `/api/generate-timetable` |
| POST | `/api/timetable/regenerate-all` |
| GET | `/api/timetable/generation-status/:jobId` |

### Change Requests
| Method | Path |
|---|---|
| GET | `/api/change-requests` |
| POST | `/api/change-requests/:id/approve` |
| POST | `/api/change-requests/:id/reject` |

---

## Frontend Page Map

| Page Component | Route | Description |
|---|---|---|
| `Login.jsx` | `/login` | Auth (login, register, OTP, forgot password) |
| `Dashboard.jsx` | `/` | KPIs, setup checklist, quick actions, pending requests |
| `Departments.jsx` | `/departments` | Department CRUD |
| `Classrooms.jsx` | `/classrooms` | Classroom CRUD |
| `Faculty.jsx` | `/faculty` | Faculty CRUD + Excel import/export |
| `Sections.jsx` | `/sections` | Section CRUD |
| `Subjects.jsx` | `/subjects` | Subject CRUD + Excel import/export |
| `TimeSlots.jsx` | `/timeslots` | Time slot CRUD |
| `Timetable.jsx` | `/timetable` | Generation, grid view, print |
| `Settings.jsx` | `/settings` | Profile, workspace, referrals, requests, danger zone |

---

## Scheduler Logic Summary

The Python scheduler (`python-service/scheduler.py`) implements a CP-SAT model:

1. **Blocks** are created from subjects: one block per lecture hour, and 2–3 period blocks for labs.
2. **Variables** `x[(block, day, period_start, room)]` are boolean.
3. **Hard constraints**: exactly one slot per block, at most one class per slot/room/faculty/section.
4. **Lab constraints**: fully in morning or afternoon, no lunch crossing, start at session beginning.
5. **Faculty daily limit**: max 7 hours/day.
6. **Soft objective**: maximise scheduling, penalise back-to-back repeats, minimise active days per section, minimise late-period placement.
7. **Timeout**: 20 seconds per section with 8 parallel workers.
8. **Occupied slots**: previously scheduled sections are passed as `occupiedSlots` to prevent cross-section conflicts.

---

## Scheduler Configuration (Environment Variables)

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Express session secret (min 32 chars, required) |
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URL |
| `SENDGRID_API_KEY` | SendGrid API key for email OTPs |
| `SENDGRID_FROM` | Sender email for SendGrid |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | SMTP fallback for email |
| `FRONTEND_URL` | Production frontend URL for OAuth redirect |
| `NODE_ENV` | `development` or `production` |

---

## Feature Documentation Index

| Feature | Document |
|---|---|
| User Registration, Login, OTP, Google OAuth, Password Reset | [authentication.md](./features/authentication.md) |
| Workspace creation, joining, management, member removal | [workspaces.md](./features/workspaces.md) |
| Departments CRUD | [departments.md](./features/departments.md) |
| Faculty CRUD + Excel import/export | [faculty.md](./features/faculty.md) |
| Subjects CRUD + Excel import/export | [subjects.md](./features/subjects.md) |
| Sections CRUD | [sections.md](./features/sections.md) |
| Classrooms CRUD | [classrooms.md](./features/classrooms.md) |
| Time Slots CRUD | [time-slots.md](./features/time-slots.md) |
| AI timetable generation (OR-Tools CP-SAT, job queue, atomic swap) | [timetable-generation.md](./features/timetable-generation.md) |
| Timetable grid view, print/export | [exports.md](./features/exports.md) |
| Viewer change request workflow | [change-requests.md](./features/change-requests.md) |
| Owner vs Viewer permissions, middleware enforcement | [roles-and-permissions.md](./features/roles-and-permissions.md) |
| Settings page (profile, workspace, invites, requests, danger zone) | [settings.md](./features/settings.md) |

---

## Complete Beginner Workflow

See [user-guide.md](./user-guide.md) for a step-by-step walkthrough from registration to printing a timetable.

---

## Known Limitations & Incomplete Behaviours

- **Faculty availability field**: The `availability` column exists in the database but has no UI input in the Add/Edit Faculty form. The scheduler does not use it to restrict which days a faculty member can teach.
- **Per-department generation UI**: The API supports generating for a specific department, but the "Regenerate All" button always regenerates all sections. I couldn't determine if there is a separate per-department trigger in the UI.
- **Cascade on delete**: The schema does not define explicit ON DELETE CASCADE rules in code. Deleting a department/section with linked subjects or timetable entries may produce orphaned foreign key references depending on the database configuration.
- **Phone number OTP**: The `sendPhoneOtp` function only logs to the console — no SMS provider (e.g. Twilio) is integrated. Phone-based login/registration OTPs will not be delivered.
- **Session store**: Sessions are stored in-memory (`memorystore`). Sessions are lost on server restart in development. This is not suitable for multi-instance production deployments without replacing the store with Redis or a database-backed alternative.
- **Viewer create permissions**: Viewers cannot create new records at all (no change request fallback for POST operations). Only edit and delete operations fall through to the change request system.
