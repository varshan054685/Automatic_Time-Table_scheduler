# Automatic Timetable Scheduler

A multi-user SaaS web application that generates conflict-free academic timetables using constraint programming (Google OR-Tools CP-SAT).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, TanStack Query |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Passport.js (Local + Google OAuth 2.0), bcrypt |
| Scheduler | Python 3, FastAPI, Google OR-Tools CP-SAT |
| Email | SendGrid (primary), Nodemailer/SMTP (fallback) |

## Architecture

```
Browser (React/Vite)
      ↕  HTTP/JSON
Express Server (Node.js/TypeScript)
      ↕  Drizzle ORM
PostgreSQL Database
      ↕  HTTP (internal)
Python FastAPI Microservice (OR-Tools Solver)
```

## Prerequisites

- Node.js 20+
- Python 3.10+
- PostgreSQL database

## Setup

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd Automatic_Time-Table_scheduler
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, and any optional keys
```

See `.env.example` for all available variables (Google OAuth, SendGrid, SMTP, Gemini API).

### 3. Set up the database

```bash
npm run db:push
```

### 4. Set up the Python service

```bash
cd python-service
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Run in development

```bash
npm run dev
```

This starts the Node backend, Vite dev server, and Python FastAPI service concurrently.

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5173/api |
| Python solver | http://localhost:8000 |

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start all services in development mode |
| `npm run build` | Build the frontend |
| `npm run backend-build` | Bundle the Node.js server |
| `npm run start` | Run the production server |
| `npm run db:push` | Push schema changes to the database |
| `npm run check` | TypeScript type check |

## Project Structure

```
├── client/          # React frontend (Vite)
├── server/          # Express backend (TypeScript)
├── shared/          # Shared types and Zod schema
├── python-service/  # FastAPI + OR-Tools scheduler
├── migrations/      # Drizzle SQL migrations
├── docs/            # Feature documentation
└── excel/           # Excel import templates
```

## Features

- **Workspace-based multi-tenancy** — Owner and Viewer roles with invite codes
- **Master data management** — Departments, classrooms, faculty, sections, subjects, time slots
- **AI timetable generation** — CP-SAT solver with hard constraints (no double-bookings) and soft optimisation
- **Excel import/export** — Bulk import faculty and subjects via spreadsheet
- **Change request workflow** — Viewers submit edit/delete requests; Owners approve or reject
- **Google OAuth + OTP auth** — Email-based OTP for registration and password reset
- **AI Chatbot assistant** — Powered by Gemini 2.0 Flash

## Documentation

See the [`docs/`](./docs/) folder for detailed feature documentation and the [user guide](./docs/user-guide.md).

## License

MIT
