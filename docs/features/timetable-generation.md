# Timetable Generation

## Purpose

Automatically generates a conflict-free weekly timetable for all sections in a workspace (or a filtered subset by department/semester). The solver is a Python microservice using Google OR-Tools CP-SAT, called asynchronously via an in-memory job queue. The existing timetable is only replaced after the new one is fully ready (atomic swap).

## Where to find it

- **Generate / Regenerate All** button on the Timetable page (`/timetable`), visible only to Owners.
- **Generate Timetable** shortcut button on the Dashboard.

## Who can use it

Owner only. Viewers cannot trigger generation.

## User Workflow

### Regenerate All Sections
1. Navigate to the **Timetable** page.
2. Click **Regenerate All** (top-right).
3. A browser `confirm()` dialog warns that all current timetables will be replaced.
4. Confirm. The API call returns immediately with a `jobId`.
5. A full-screen progress overlay appears showing real-time progress (sections completed / total, percentage bar).
6. The overlay updates every few seconds via polling (`GET /api/timetable/generation-status/:jobId`).
7. When generation finishes:
   - **Completed**: Green checkmark overlay, success toast, timetable grid refreshes.
   - **Partial**: Amber warning overlay, toast indicating which sections failed.
   - **Failed**: Red X overlay, error message shown.

### Generate for a Specific Department / Semester
The API supports filtering by `departmentId` and optionally `semester` (`POST /api/generate-timetable`). However, the UI's "Regenerate All" button uses `POST /api/timetable/regenerate-all` which queues every section in the workspace without department filtering. The per-department endpoint is defined but I couldn't determine from the UI code where it is triggered individually — the dashboard "Generate Timetable" button navigates to `/timetable`, not directly triggering generation.

## How the Scheduler Works

The Python service (`python-service/scheduler.py`) uses **Google OR-Tools CP-SAT** (Constraint Programming - Satisfiability):

### Hard Constraints (must be satisfied)
1. Every subject block must be assigned exactly one time slot and room.
2. No room is used by two different classes at the same time.
3. No faculty member teaches two classes at the same time.
4. No section has two subjects in the same time slot.
5. Lab blocks must be entirely within the morning OR entirely within the afternoon session — they cannot straddle the lunch break.
6. Lab blocks must start at the first period of the session.
7. A faculty member can teach at most 7 hours per day.
8. Previously scheduled sections' occupied slots are respected (prevents cross-section faculty/room conflicts).

### Soft Constraints (optimised, not strict)
1. **Back-to-back penalty**: Minimises the same faculty or same subject being scheduled in consecutive periods on the same day.
2. **Active days minimisation**: Tries to pack classes into fewer days per section (compact schedule).
3. **Late period penalty**: Prefers scheduling earlier in the day to prevent gaps.

### Lab Block Logic
- A lab subject with N weekly hours is broken into blocks of 3, then 2, then 1 as needed.
- A 3-period lab: occupies 2 periods before the morning break + 1 period after.
- A 2-period lab: must not cross the break.
- Labs are restricted to either fully morning or fully afternoon per section per day — a section cannot have both a morning and afternoon lab on the same day.

### Solver Configuration
- Max solve time: **20 seconds per section**.
- Parallel search workers: 8.
- Random seed: 42 (deterministic).
- Returns `OPTIMAL` or `FEASIBLE` status as success, anything else as "Constraints might be too strict."

### Queue & Atomic Swap
1. All section jobs are pushed to an in-memory queue.
2. Sections are processed **sequentially** — each section sees the previously solved sections' occupied slots, preventing cross-section conflicts.
3. Results are written to a staging table (`generation_results`) first.
4. After all sections succeed, results are **atomically promoted** from staging to the live `timetable` table.
5. If some sections fail (partial success), the succeeded sections' results are still promoted.
6. If all sections fail, the staging table is cleaned up and the live timetable is unchanged.

## Buttons & Actions

- **Regenerate All** → `confirm()` → `POST /api/timetable/regenerate-all` → polls `GET /api/timetable/generation-status/:jobId`
- **Generate Timetable** (Dashboard shortcut) → navigates to `/timetable`, does not auto-trigger generation.

## Rate Limiting

Timetable generation is rate-limited to **5 requests per 15 minutes per IP**. Exceeding this returns HTTP 429.

## API

| Method | Path | Role |
|---|---|---|
| POST | `/api/generate-timetable` | Owner |
| POST | `/api/timetable/regenerate-all` | Owner |
| GET | `/api/timetable/generation-status/:jobId` | Any member |
| GET | `/api/timetable` | Any member |

The timetable list endpoint accepts optional query params: `?sectionId=N` and `?facultyId=N`.

## Database

| Table | Operation |
|---|---|
| `generation_jobs` | INSERT (create job), UPDATE (progress, status) |
| `generation_results` | INSERT (staging), DELETE (cleanup or after promotion) |
| `timetable` | DELETE (old entries), INSERT (promoted results) |

## Success Flow

- API returns `{ jobId, status: "started" }` immediately.
- Frontend polls status every few seconds.
- `status` transitions: `pending` → `processing` → `completed` / `partial` / `failed`.
- On `completed`: staging results are atomically moved to `timetable`.
- Timetable data query cache is invalidated, grid refreshes automatically.

## Failure Cases

| Scenario | Error |
|---|---|
| No sections found for selection | HTTP 400 "No sections found for this selection" |
| No classrooms in workspace | Solver returns "No classrooms available." |
| No subjects assigned to any section | Solver returns "No subjects assigned." |
| Constraints too strict | Solver returns "Constraints might be too strict." |
| Solver times out (>20s per section) | Same as above — infeasible result |
| Partial failure | Some sections succeed, others fail. Succeeded sections are still promoted. |
| Rate limit hit | HTTP 429 "Timetable generation rate limit reached." |
| Python service unreachable | I couldn't determine the error handling from the worker code — would likely cause the section job to fail with a connection error. |

## Frequently Asked Questions

**Q: How long does generation take?**
A: Each section gets up to 20 seconds of solver time. With 8 parallel workers, complex timetables resolve faster. A workspace with 10 sections could take up to 3–4 minutes in the worst case, though simpler schedules are solved in seconds.

**Q: Will generating a new timetable delete the old one?**
A: The old timetable is only replaced after the new one is fully generated and validated. If generation fails, the old timetable remains unchanged.

**Q: Generation says "Constraints might be too strict." What do I do?**
A: Check: (1) You have enough time slots to cover each subject's weekly hours. (2) Every subject has a faculty assigned. (3) Faculty daily hour limits (7 per day) are not being exceeded by the total subject load. (4) At least one classroom exists.

**Q: Can I generate for just one department?**
A: The API supports it via `POST /api/generate-timetable` with a `departmentId`. The "Regenerate All" UI button always regenerates all sections. I couldn't determine if there is a UI-level per-department trigger other than the API.

## Related Features

- [Sections](./sections.md)
- [Subjects](./subjects.md)
- [Faculty](./faculty.md)
- [Classrooms](./classrooms.md)
- [Time Slots](./time-slots.md)
- [Timetable Grid & Exports](./exports.md)
