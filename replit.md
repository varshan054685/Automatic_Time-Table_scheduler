# College Automatic Timetable Scheduler

## Overview

This is a full-stack web application called "College Automatic Timetable Scheduler" designed for college staff and administrators to manage academic resources and automatically generate conflict-free timetables. The app provides CRUD management for departments, classrooms, subjects, faculty, sections, and time slots, plus an automatic timetable generation engine using a greedy scheduling algorithm. Timetables can be viewed by class or by faculty in a color-coded grid format.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with JavaScript (JSX) — not TypeScript for page components and hooks, though UI primitives from shadcn/ui remain in TSX
- **Styling**: Tailwind CSS with CSS variables for theming (premium blue theme)
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives
- **State Management**: TanStack React Query for server state (fetching, caching, mutations)
- **Routing**: React Router with sidebar navigation
- **Entry Point**: `client/src/main.jsx`
- **Build**: Vite with React plugin, outputs to `dist/public`
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Sidebar Navigation & Pages
Each sidebar item has its own dedicated page component and route:
- `/dashboard` → Dashboard (with stats/charts using recharts)
- `/departments` → Departments CRUD
- `/classrooms` → Classrooms CRUD
- `/subjects` → Subjects CRUD
- `/faculty` → Faculty CRUD
- `/sections` → Sections CRUD
- `/timeslots` → Time Slots CRUD
- `/timetable` → Timetable View (grid format, days vs periods)

All CRUD pages follow the same pattern: list table, add form/modal, edit form/modal, delete action.

### Backend
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript (server-side)
- **Entry Point**: `server/index.ts`
- **API Pattern**: RESTful JSON APIs under `/api/` prefix
- **Route Definitions**: Centralized in `shared/routes.ts` with Zod schemas for validation — both client and server share these definitions
- **Authentication**: Passport.js with local strategy, express-session with MemoryStore (in-memory sessions)
- **Build**: esbuild bundles server to `dist/index.cjs` for production

### Database
- **Database**: PostgreSQL (required, provisioned via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Generated via `drizzle-kit push` (`npm run db:push`)
- **Tables**: users, departments, classrooms, subjects, faculty, sections, timeSlots, timetable
- **Key Relationships**: Subjects and Faculty belong to Departments; Sections belong to Departments; Timetable entries reference sections, subjects, faculty, classrooms, and time slots

### Timetable Scheduler
- **Algorithm**: Greedy/rule-based scheduling in `server/scheduler.ts`
- **Constraints**: Prevents faculty time conflicts, prevents classroom conflicts, respects faculty availability, assigns subjects based on weekly hours
- **Scope**: Generates per department (optionally filtered by semester), clears existing entries before regenerating

### Shared Code (`shared/`)
- `schema.ts` — Drizzle table definitions and Zod insert schemas (used by both frontend and backend)
- `routes.ts` — API route path definitions, request/response schemas, and a `buildUrl` helper for parameterized paths

### Key Scripts
- `npm run dev` — Development server with Vite HMR
- `npm run build` — Production build (Vite for client, esbuild for server)
- `npm start` — Run production build
- `npm run db:push` — Push schema changes to database
- `npm run check` — TypeScript type checking
- `python3 -m uvicorn python-service.app:app --host 0.0.0.0 --port 8000` — Start Python microservice

### Seed Data
- `server/seed.ts` provides initial data: admin/staff users, sample departments (CS, ME), classrooms, subjects, faculty, sections, and time slots

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable using `pg` (node-postgres) driver pool

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** (v5) — HTTP server framework
- **passport** + **passport-local** — Authentication
- **express-session** + **memorystore** — Session management
- **zod** + **drizzle-zod** — Runtime validation and schema generation
- **@tanstack/react-query** — Client-side data fetching and caching
- **recharts** — Dashboard charts
- **lucide-react** — Icon library
- **date-fns** — Date formatting utilities
- **shadcn/ui ecosystem** — Radix UI primitives, class-variance-authority, clsx, tailwind-merge

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay in development
- `@replit/vite-plugin-cartographer` — Development tooling (dev only)
- `@replit/vite-plugin-dev-banner` — Development banner (dev only)