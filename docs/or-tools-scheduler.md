# Current OR-Tools CP-SAT Scheduler — Analysis & Improvement Plan

> Phase 2 deliverable. `python-service/scheduler.py` inspected end-to-end. The solver is the crown jewel of this project: it is **preserved and restructured, not rewritten**.

## 1. What the current model does

### Input (via FastAPI `app.py`, sent by `server/worker.ts`)
- `classrooms[] {roomNumber}`, `subjects[] {id, name, departmentId, sectionId, facultyId, weeklyHours, type}`
- `faculty[] {id, name, departmentId}`, `sections[] {id, name, departmentId}`
- `timeslots[] {id, dayOfWeek, label, startTime, endTime}`, `days[]`
- `occupiedSlots[] {day, period, facultyId, room}` — from live timetable (other sections) + staged results of earlier sections in the same job

### Preprocessing
- Excludes slots whose label contains Break/Lunch from teaching periods; sorts periods by start time.
- Derives morning/afternoon period sets from the lunch slot's start time.
- Builds **blocks**: lab subjects → contiguous chunks of 3/2/1 periods; lectures → 1-period blocks. Subjects without a faculty are silently skipped. Blocks are shuffled with a fixed seed.

### Candidate variables & filters
- `x[(block, day, start_period, room)]` booleans, created only where:
  - the `size` periods are contiguous within that day;
  - labs fit entirely in morning **or** afternoon;
  - `_lab_start_allowed()`: labs must start at the day's first period; 2-period labs must not straddle the mid-morning break; 3-period labs must be exactly P1,P2|Break|P3;
  - the block does not overlap any `occupiedSlots` (faculty or room).

### Hard constraints
- `AddExactlyOne` per block (if it has ≥1 candidate).
- `AddAtMostOne` per (slot, room), (slot, faculty), (slot, section) — no room/faculty/section double-booking.
- Faculty daily load ≤ **7** periods (weighted by block size) — hardcoded magic number.

### Objective (`model.Maximize(- …)`)
- −10 × faculty back-to-back and same-subject-in-adjacent-period penalties,
- −50 × active days per section (pack into fewer days),
- −1 × late-period index (push classes earlier / leave gaps at day end).

### Solver & output
- 20 s limit, 8 workers, seed 42 → flat rows `{day, period, sectionId, subjectId, facultyId, room}`.
- Failure returns `{"error": "Constraints might be too strict."}` — one opaque string for INFEASIBLE and UNKNOWN alike.

## 2. Weaknesses / bugs found (must fix)

1. **Silent partial loss**: a block with zero candidates is silently dropped (no `AddExactlyOne` possible) while the solve still "succeeds" — timetable quietly misses hours.
2. **Teacher availability ignored**: `faculty.availability` is stored in the DB but never sent to the solver.
3. **Room type/capacity ignored**: labs can be scheduled into lecture rooms; capacity never checked (section size isn't even in the payload).
4. **Hardcoded daily limit 7** — not configurable per teacher or institution.
5. **Dead code**: `total_sch`, `lab_consecutive` vars computed but never used in the objective.
6. **Statuses collapsed**: OPTIMAL vs FEASIBLE vs INFEASIBLE vs UNKNOWN not distinguished downstream.
7. **No cancellation**; timeout fixed at 20 s; `num_search_workers` hardcoded.
8. **Greedy sequential section solves** — later sections inherit leftovers; no global optimization across sections of a department.
9. **Late-period penalty conflates** "compact day" with "everything early" — creates systematic end-of-day free periods.

## 3. Redesign (new `python-service/scheduler/` package)

```text
scheduler/
  model_builder.py   # blocks, candidates, occupied slots
  constraints/
    hard.py          # exactly-one, no-clash (room/teacher/section), availability,
                     # room type/capacity, lab contiguity, max periods day/week,
                     # lunch protection, working days, fixed periods
    soft.py          # b2b, compact days, preferred periods, avoid first/last,
                     # gaps minimization — each a named, weighted, toggleable rule
  diagnostics.py     # feasibility pre-audit + INFEASIBLE explanation engine
  solver.py          # CpSolver wrapper: status mapping, timeout, cancel flag,
                     # worker count from settings
  service.py         # FastAPI app: /health /solve /cancel (replaces app.py)
```

- **Constraint registry**: every constraint = `{id, scope, hard|soft, weight, params}` — the UI can toggle/weight; no blind hard-coded additions.
- **Availability**: teacher availability grid passed in payload; unavailable (teacher, slot) pairs prune candidates (hard).
- **Rooms**: candidate filter on room `type` and `capacity ≥ section.strength`.
- **Configurable limits**: per-teacher max/day & max/week, per-section max/day from DB settings.
- **Explainable failure** (spec §9): pre-flight audit computes demand vs supply per teacher/section/room (e.g. "Teacher X has 3 available periods but subjects require 6"); on INFEASIBLE/UNKNOWN, use `solver.Assumptions` + `sufficient_assumptions_for_infeasibility` plus the audit to emit structured causes + suggested actions. Response: `{status: OPTIMAL|FEASIBLE|INFEASIBLE|TIMEOUT|ERROR, timetable?, diagnostics[], unscheduled_blocks[]}`.
- **Cancellation**: solve runs in a worker thread with a `CpSolverSolutionCallback` that checks a cancel flag and calls `StopSearch()`.
- **Result integrity** (fixes bug #1): every block either scheduled or listed in `unscheduled_blocks` with reason — never silently dropped.
- **Phase-2 upgrade**: single-model multi-section solve per department (better global quality) with the current sequential mode as fallback for large datasets.

## 4. Solver test plan (offline; calls `generate_timetable` directly)

Fixtures: small school (4 sections, 5×8 grid), college with labs, a teacher pinned 3 periods/week but needed 6 (infeasible), one lab room over-demanded, availability-heavy case.
Assertions: no room/teacher/section clash; lab contiguity & morning/afternoon rules; availability respected; room-type respected; status mapping correct; diagnostics non-empty and human-readable on INFEASIBLE; unscheduled blocks reported; cancellation returns promptly; timeout yields TIMEOUT + partial diagnostics.

## 5. Implementation status (as actually built)

Keeping the proven CP-SAT model intact in `python-service/scheduler.py` was chosen over
the package restructure in §3: the model is unchanged apart from additive constraints,
which keeps the behaviour of existing timetables reproducible.

**Implemented**

| Item | Where |
|---|---|
| Explicit `status`: `OPTIMAL` / `FEASIBLE` / `INFEASIBLE` / `TIMEOUT` / `ERROR` | `generate_timetable` return value (previously one opaque error string) |
| Structured `diagnostics[]` (`NO_ROOMS`, `NO_ASSIGNMENTS`, `NO_FEASIBLE_SLOT`, `HOURS_SHORTFALL`, `NO_SOLUTION`, `EMPTY_TIME_GRID`, `SOLVER_ERROR`) | `_build_diagnostics()` + `app.py` |
| Teacher availability as a hard constraint (`teacherUnavailable`) | candidate pruning in the variable loop |
| Teacher `maxPeriodsDay` (per teacher, default 7) and `maxPeriodsWeek` | hard constraints; replaces the hardcoded `<= 7` |
| Room type / capacity (opt-in: `enforceRoomTypes`, `enforceCapacity`) | candidate filtering |
| Configurable time limit and worker count | `timeLimitSeconds`, `maxWorkers` from `app_settings` |
| No silent hour loss | blocks with zero candidate slots now return `INFEASIBLE` with an explanation instead of a timetable quietly missing periods |
| Cancellation | HTTP abort from the main process + staged rows discarded |
| Local lifecycle | spawned on a loopback port, health-checked, restarted with backoff, killed on quit (see `electron/services/scheduler.ts`) |

**Still open** (documented, not claimed as done)

- The `scheduler/` package split and the toggleable constraint registry from §3.
- `solver.Assumptions` based minimal-conflict extraction (current diagnostics are computed from demand/supply and candidate pruning, not from an unsat core).
- In-solver cancellation via a solution callback (`StopSearch()`); today cancellation aborts the HTTP request and discards staging.
- Single-model multi-section solves; generation is still sequential per section (with staging-aware conflict avoidance).
- Per-section max periods/day: supported by the solver payload but the v1 schema has no column for it.
- Lunch/fixed/preferred-period rules beyond the existing break and lab logic.
