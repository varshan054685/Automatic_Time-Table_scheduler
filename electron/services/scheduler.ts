/**
 * SchedulerService — owns the local Python/OR-Tools solver and the generation
 * job pipeline, entirely inside the main process (spec §7/§8/§10/§11).
 *
 * Design notes
 * ------------
 * - The solver is a local child process bound to 127.0.0.1 on a free port. It is
 *   spawned lazily, health-checked, restarted with backoff on crashes, and killed
 *   on quit. No internet access is involved at any point.
 * - Generation runs strictly per section (same semantics as the legacy queue),
 *   writing rows to `generation_results_staging`. The live timetable is only
 *   replaced when the user explicitly accepts the result, and every accepted
 *   result becomes a new `timetable_versions` row so the previous timetable is
 *   never destroyed (spec §11).
 * - Solver failures are reported as structured diagnostics, not a generic
 *   "constraints too strict" string (spec §9).
 */
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { app, BrowserWindow } from "electron";
import { getDb, inTransaction } from "./database";
import { getSetting } from "./settings";
import { log, logError } from "./logger";
import { DAY_NAMES } from "./days";

export type SolverStatus = "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "TIMEOUT" | "ERROR";
export type JobStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";

export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  section?: string;
  subject?: string;
  message: string;
}

export interface GenerateOptions {
  institutionId?: number;
  allSections?: boolean;
  sectionIds?: number[];
  timeLimitSeconds?: number;
}

export interface ProgressEvent {
  jobId: number;
  status: JobStatus;
  completedSections: number;
  totalSections: number;
  failedSections: number;
  currentSection?: string | null;
  error?: string | null;
  diagnostics?: Diagnostic[];
}

interface OccupiedSlot {
  day: string;
  period: string;
  facultyId?: number | null;
  room?: string | null;
}

type Row = Record<string, unknown>;

// ─── Python solver process ──────────────────────────────────────────────────

interface SolverProcess {
  child: ChildProcess;
  port: number;
  stopping: boolean;
  restarts: number;
}

let solver: SolverProcess | null = null;
let starting: Promise<number> | null = null;

function pythonServiceDir(): string {
  return path.join(process.cwd(), "python-service");
}

/** Resolve how to launch the solver: bundled binary in prod, venv in dev. */
function resolveSolverCommand(port: number): { command: string; args: string[]; cwd?: string } | null {
  const bundledName = process.platform === "win32" ? "timetable-solver.exe" : "timetable-solver";
  const bundled = path.join(process.resourcesPath || "", "solver", bundledName);
  if (app.isPackaged && fs.existsSync(bundled)) {
    return { command: bundled, args: ["--host", "127.0.0.1", "--port", String(port)] };
  }

  const serviceDir = pythonServiceDir();
  const venvPython =
    process.platform === "win32"
      ? path.join(serviceDir, "venv", "Scripts", "python.exe")
      : path.join(serviceDir, "venv", "bin", "python");

  const python =
    process.env.PYTHON_BIN ||
    (fs.existsSync(venvPython) ? venvPython : process.platform === "win32" ? "python" : "python3");

  if (!fs.existsSync(serviceDir)) return null;

  return {
    command: python,
    cwd: serviceDir,
    args: ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", String(port), "--log-level", "warning"],
  };
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => (port ? resolve(port) : reject(new Error("Could not allocate a port"))));
    });
  });
}

async function waitForHealth(port: number, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let delay = 150;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1000);
  }
  return false;
}

/** Spawn the solver and resolve once it answers /health. */
function spawnSolver(): Promise<number> {
  return (async () => {
    const port = await getFreePort();
    const cmd = resolveSolverCommand(port);
    if (!cmd) {
      throw new Error(
        "Solver executable not found. Expected python-service/ (development) or resources/solver (packaged build)."
      );
    }

    log(`Starting solver: ${cmd.command} (port ${port})`, "scheduler");
    const child = spawn(cmd.command, cmd.args, {
      cwd: cmd.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const proc: SolverProcess = { child, port, stopping: false, restarts: 0 };
    solver = proc;

    child.stdout?.on("data", (d: Buffer) => log(`[solver] ${d.toString().trim()}`, "scheduler"));
    child.stderr?.on("data", (d: Buffer) => log(`[solver:err] ${d.toString().trim()}`, "scheduler"));

    child.on("exit", (code) => {
      if (solver === proc) solver = null;
      if (proc.stopping) {
        log(`Solver stopped (code ${code ?? 0})`, "scheduler");
        return;
      }
      logError(`Solver exited unexpectedly (code ${code ?? "signal"})`, null, "scheduler");
      // Auto-restart with backoff, capped so a broken install can't spin forever.
      if (proc.restarts < 3) {
        const backoff = 1000 * Math.pow(2, proc.restarts);
        proc.restarts += 1;
        setTimeout(() => {
          ensureSolverRunning().catch((err) => logError("Solver restart failed", err, "scheduler"));
        }, backoff);
      }
    });

    const healthy = await waitForHealth(port);
    if (!healthy) {
      try { child.kill(); } catch { /* ignore */ }
      solver = null;
      throw new Error("Solver process started but never became healthy.");
    }

    log(`Solver ready on 127.0.0.1:${port}`, "scheduler");
    return port;
  })();
}

/** Ensure the solver is running; concurrent callers share one start attempt. */
export function ensureSolverRunning(): Promise<number> {
  if (solver && solver.child.exitCode === null) return Promise.resolve(solver.port);
  if (!starting) {
    starting = spawnSolver().finally(() => {
      starting = null;
    });
  }
  return starting;
}

/** Stop the solver (called on app quit). */
export function stopSolver(): void {
  if (!solver) return;
  solver.stopping = true;
  try {
    solver.child.kill();
    log("Solver process terminated", "scheduler");
  } catch (err) {
    logError("Failed to terminate solver", err, "scheduler");
  }
  solver = null;
}

// ─── Solver HTTP call ───────────────────────────────────────────────────────

interface SolveResult {
  status: SolverStatus;
  timetable: Array<{
    day: string;
    period: string;
    sectionId: number;
    subjectId: number;
    facultyId: number;
    room: string;
  }>;
  error?: string;
  diagnostics?: Diagnostic[];
}

async function callSolver(port: number, body: unknown, timeoutMs: number, signal: AbortSignal): Promise<SolveResult> {
  const res = await fetch(`http://127.0.0.1:${port}/generate-timetable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
  });
  if (!res.ok) {
    throw new Error(`Solver responded with HTTP ${res.status}`);
  }
  const data = (await res.json()) as Partial<SolveResult>;
  return {
    status: (data.status as SolverStatus) ?? "ERROR",
    timetable: data.timetable ?? [],
    error: data.error,
    diagnostics: data.diagnostics ?? [],
  };
}

// ─── Job bookkeeping helpers ────────────────────────────────────────────────

function emitProgress(event: ProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("scheduler:progress", event);
  }
}

function updateJob(jobId: number, fields: Record<string, unknown>): void {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  getDb()
    .prepare(`UPDATE generation_jobs SET ${sets} WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), jobId);
}

function jobProgress(jobId: number): ProgressEvent {
  const row = getDb().prepare("SELECT * FROM generation_jobs WHERE id = ?").get(jobId) as Row | undefined;
  if (!row) throw new Error("Generation job not found");
  return {
    jobId,
    status: row.status as JobStatus,
    completedSections: Number(row.completed_sections ?? 0),
    totalSections: Number(row.total_sections ?? 0),
    failedSections: Number(row.failed_sections ?? 0),
    error: (row.error_message as string | null) ?? null,
  };
}

/** Sections that have at least one subject-assignment with a teacher. */
function loadSections(institutionId: number, sectionIds?: number[]): Row[] {
  const db = getDb();
  if (sectionIds && sectionIds.length > 0) {
    const marks = sectionIds.map(() => "?").join(", ");
    return db
      .prepare(`SELECT * FROM sections WHERE institution_id = ? AND id IN (${marks}) ORDER BY id`)
      .all(institutionId, ...sectionIds) as Row[];
  }
  return db.prepare("SELECT * FROM sections WHERE institution_id = ? ORDER BY id").all(institutionId) as Row[];
}

// ─── Pre-flight audit (no solving) ─────────────────────────────────────────

export interface AuditResult {
  ok: boolean;
  issues: Diagnostic[];
  sections: number;
  subjects: number;
  teachers: number;
  classrooms: number;
  teachingSlots: number;
}

/**
 * Cheap, explainable feasibility audit run before solving. It catches the
 * common "obviously impossible" setups so the user gets actionable advice
 * instead of waiting for a full solve to fail.
 */
export function audit(options: { institutionId?: number; sectionIds?: number[] } = {}): AuditResult {
  const db = getDb();
  const institutionId = options.institutionId ?? currentInstitutionId();
  const issues: Diagnostic[] = [];

  const classrooms = db
    .prepare("SELECT * FROM classrooms WHERE institution_id = ?")
    .all(institutionId) as Row[];
  const slots = db
    .prepare("SELECT * FROM time_slots WHERE institution_id = ? AND type = 'teaching'")
    .all(institutionId) as Row[];
  const teachers = db.prepare("SELECT * FROM teachers WHERE institution_id = ?").all(institutionId) as Row[];
  const subjects = db.prepare("SELECT * FROM subjects WHERE institution_id = ?").all(institutionId) as Row[];
  const sections = loadSections(institutionId, options.sectionIds);

  if (sections.length === 0) {
    issues.push({ code: "NO_SECTIONS", severity: "error", message: "No sections exist. Add at least one section first." });
  }
  if (classrooms.length === 0) {
    issues.push({ code: "NO_ROOMS", severity: "error", message: "No classrooms exist. Add at least one classroom or lab." });
  }

  const teachingPeriods = new Set(slots.map((s) => String(s.label))).size;
  const days = new Set(slots.map((s) => String(s.day_of_week))).size;
  if (teachingPeriods === 0 || days === 0) {
    issues.push({
      code: "NO_TIME_GRID",
      severity: "error",
      message: "No teaching time slots are defined. Add time slots before generating.",
    });
  }
  const gridCapacity = teachingPeriods * days;

  const unavailable = new Set(
    (db
      .prepare("SELECT teacher_id, time_slot_id FROM teacher_availability WHERE available = 0")
      .all() as Row[]).map((r) => `${r.teacher_id}:${r.time_slot_id}`)
  );
  const slotsPerDayLabel = slots.length; // (day, period) pairs

  for (const section of sections) {
    const secId = Number(section.id);
    const secName = String(section.name ?? `Section ${secId}`);
    const assigned = subjects.filter(
      (s) =>
        Number(s.section_id) === secId ||
        (s.section_id === null && Number(s.department_id) === Number(section.department_id))
    );

    const withTeacher = assigned.filter((s) => s.faculty_id !== null && s.faculty_id !== undefined);
    if (withTeacher.length === 0) {
      issues.push({
        code: "NO_ASSIGNMENTS",
        severity: "error",
        section: secName,
        message: `${secName} has no subject with a teacher assigned. Assign a teacher on the Subjects page.`,
      });
      continue;
    }

    const requested = withTeacher.reduce((sum, s) => sum + Number(s.weekly_hours ?? 1), 0);
    if (gridCapacity > 0 && requested > gridCapacity) {
      issues.push({
        code: "OVER_CAPACITY",
        severity: "warning",
        section: secName,
        message: `${secName} requests ${requested} weekly periods but the week only has ${gridCapacity}. Some periods cannot be scheduled.`,
      });
    }

    // Teacher availability vs the hours they must teach in this section.
    const perTeacher = new Map<number, number>();
    for (const s of withTeacher) {
      const tId = Number(s.faculty_id);
      perTeacher.set(tId, (perTeacher.get(tId) ?? 0) + Number(s.weekly_hours ?? 1));
    }
    for (const [tId, hours] of perTeacher) {
      const teacher = teachers.find((t) => Number(t.id) === tId);
      const blocked = unavailableCount(unavailable, tId, slots);
      const availableSlots = Math.max(slotsPerDayLabel - blocked, 0);
      if (availableSlots < hours) {
        issues.push({
          code: "TEACHER_UNAVAILABLE",
          severity: "warning",
          section: secName,
          message: `${teacher ? String(teacher.name) : `Teacher ${tId}`} can only work ${availableSlots} of the ${slotsPerDayLabel} weekly periods but must teach ${hours} in ${secName}. Free up availability or reduce hours.`,
        });
      }
      const maxWeek = teacher ? Number(teacher.max_periods_week ?? 0) : 0;
      if (maxWeek > 0 && hours > maxWeek) {
        issues.push({
          code: "TEACHER_WEEK_LIMIT",
          severity: "warning",
          section: secName,
          message: `${teacher ? String(teacher.name) : `Teacher ${tId}`} is limited to ${maxWeek} periods/week but ${hours} are required in ${secName}.`,
        });
      }
    }

    // Lab subjects need a lab room when room types are actually used.
    const labSubjects = withTeacher.filter((s) => String(s.type).toLowerCase() === "lab");
    const typedRooms = classrooms.filter((c) => c.type !== undefined && c.type !== null);
    const labRooms = classrooms.filter((c) => String(c.type).toLowerCase() === "lab");
    if (labSubjects.length > 0 && typedRooms.length > 0 && labRooms.length === 0) {
      issues.push({
        code: "NO_LAB_ROOMS",
        severity: "info",
        section: secName,
        message: `${secName} has lab subjects but no classroom is marked as a lab. Labs will be placed in regular rooms.`,
      });
    }
  }

  return {
    ok: issues.every((i) => i.severity !== "error"),
    issues,
    sections: sections.length,
    subjects: subjects.length,
    teachers: teachers.length,
    classrooms: classrooms.length,
    teachingSlots: slots.length,
  };
}

function unavailableCount(unavailable: Set<string>, teacherId: number, slots: Row[]): number {
  let count = 0;
  for (const slot of slots) {
    if (unavailable.has(`${teacherId}:${slot.id}`)) count += 1;
  }
  return count;
}

// ─── Generation ─────────────────────────────────────────────────────────────

const cancellations = new Map<number, AbortController>();

export function currentInstitutionId(): number {
  const row = getDb().prepare("SELECT id FROM institutions ORDER BY id LIMIT 1").get() as { id: number } | undefined;
  if (!row) throw new Error("No institution exists yet.");
  return row.id;
}

/**
 * Create a generation job and start it in the background. Returns immediately
 * with the jobId so the renderer never blocks (spec §10).
 */
export async function startGeneration(options: GenerateOptions = {}): Promise<{ jobId: number }> {
  const institutionId = options.institutionId ?? currentInstitutionId();
  const sections = loadSections(institutionId, options.allSections ? undefined : options.sectionIds);

  if (sections.length === 0) throw new Error("No sections available to generate a timetable for.");

  // Blocking preconditions fail fast with an explanation.
  const pre = audit({ institutionId, sectionIds: sections.map((s) => Number(s.id)) });
  const blockers = pre.issues.filter((i) => i.severity === "error");
  if (blockers.length > 0) {
    throw new Error(blockers.map((b) => b.message).join(" "));
  }

  const timeLimitSeconds = options.timeLimitSeconds ?? Number(getSetting("scheduler.timeLimitSeconds", 20)) ?? 20;

  const db = getDb();
  const jobId = inTransaction((d) => {
    const info = d
      .prepare(
        "INSERT INTO generation_jobs (institution_id, status, total_sections, diagnostics_json) VALUES (?, 'queued', ?, ?)"
      )
      .run(institutionId, sections.length, JSON.stringify({ preflight: pre.issues }));
    const id = Number(info.lastInsertRowid);
    const insertSection = d.prepare(
      "INSERT INTO generation_job_sections (job_id, section_id, status) VALUES (?, ?, 'pending')"
    );
    for (const s of sections) insertSection.run(id, Number(s.id));
    return id;
  });

  log(`Generation job ${jobId} queued (${sections.length} sections, limit ${timeLimitSeconds}s)`, "scheduler");
  emitProgress({ ...jobProgress(jobId), status: "queued", diagnostics: pre.issues });

  void runJob(jobId, institutionId, sections, timeLimitSeconds, pre.issues).catch((err) => {
    logError(`Generation job ${jobId} crashed`, err, "scheduler");
  });

  return { jobId };
}

async function runJob(
  jobId: number,
  institutionId: number,
  sections: Row[],
  timeLimitSeconds: number,
  preflight: Diagnostic[]
): Promise<void> {
  const db = getDb();
  const controller = new AbortController();
  cancellations.set(jobId, controller);

  updateJob(jobId, { status: "running" });
  emitProgress(jobProgress(jobId));

  const jobSectionIds = new Set(sections.map((s) => Number(s.id)));
  const diagnosticsBySection: Record<number, Diagnostic[]> = {};
  const solverStatuses: Record<number, SolverStatus> = {};

  let completed = 0;
  let failed = 0;

  for (const section of sections) {
    if (controller.signal.aborted) break;

    const sectionId = Number(section.id);
    const sectionName = String(section.name ?? `Section ${sectionId}`);
    const started = Date.now();

    emitProgress({ ...jobProgress(jobId), currentSection: sectionName });

    try {
      const port = await ensureSolverRunning();
      const payload = buildSectionPayload(institutionId, jobId, sectionId, section, jobSectionIds, timeLimitSeconds);

      const result = await callSolver(
        port,
        payload,
        timeLimitSeconds * 2000 + 15000,
        controller.signal
      );
      solverStatuses[sectionId] = result.status;
      if (result.diagnostics?.length) diagnosticsBySection[sectionId] = result.diagnostics;

      if (result.status === "INFEASIBLE" || result.status === "TIMEOUT" || result.status === "ERROR") {
        const message =
          result.error ??
          (result.diagnostics?.find((d) => d.severity === "error")?.message || "The solver could not build this section.");
        throw new Error(message);
      }

      const saved = stageSectionResults(jobId, institutionId, payload, result);
      if (saved === 0) {
        throw new Error("The solver returned no usable periods for this section.");
      }

      db.prepare(
        "UPDATE generation_job_sections SET status = 'completed', solver_status = ?, entries_count = ?, duration_ms = ?, message = ? WHERE job_id = ? AND section_id = ?"
      ).run(result.status, saved, Date.now() - started, null, jobId, sectionId);

      log(`Job ${jobId}: section ${sectionId} solved (${result.status}, ${saved} entries)`, "scheduler");
    } catch (err) {
      if (controller.signal.aborted) break;
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      const sectionDiagnostics = diagnosticsBySection[sectionId];
      db.prepare(
        "UPDATE generation_job_sections SET status = 'failed', solver_status = ?, message = ?, duration_ms = ? WHERE job_id = ? AND section_id = ?"
      ).run(solverStatuses[sectionId] ?? "ERROR", message, Date.now() - started, jobId, sectionId);
      diagnosticsBySection[sectionId] = [
        ...(sectionDiagnostics ?? []),
        { code: "SECTION_FAILED", severity: "error", section: sectionName, message },
      ];
      logError(`Job ${jobId}: section ${sectionId} failed`, err, "scheduler");
    }

    completed += 1;
    updateJob(jobId, { completed_sections: completed, failed_sections: failed });
    emitProgress(jobProgress(jobId));
  }

  cancellations.delete(jobId);

  if (controller.signal.aborted) {
    db.prepare("DELETE FROM generation_results_staging WHERE job_id = ?").run(jobId);
    updateJob(jobId, { status: "cancelled", finished_at: new Date().toISOString() });
    log(`Job ${jobId} cancelled — staged results discarded`, "scheduler");
    emitProgress(jobProgress(jobId));
    return;
  }

  // Recount from the job table so the reported numbers can never drift from
  // what was actually persisted per section.
  failed = (
    getDb()
      .prepare("SELECT COUNT(*) AS c FROM generation_job_sections WHERE job_id = ? AND status = 'failed'")
      .get(jobId) as { c: number }
  ).c;
  const status: JobStatus = failed === 0 ? "completed" : failed >= sections.length ? "failed" : "partial";

  updateJob(jobId, {
    status,
    completed_sections: sections.length,
    failed_sections: failed,
    solver_statuses_json: JSON.stringify(solverStatuses),
    diagnostics_json: JSON.stringify({ preflight, sections: diagnosticsBySection }),
    finished_at: new Date().toISOString(),
    error_message:
      status === "failed"
        ? Object.values(diagnosticsBySection).flat().find((d) => d.severity === "error")?.message ??
          "All sections failed to generate."
        : null,
  });

  log(`Job ${jobId} finished: ${status} (${sections.length - failed}/${sections.length} sections)`, "scheduler");
  emitProgress(jobProgress(jobId));
}

/** Assemble one section's solver payload from SQLite (mirrors the legacy worker). */
function buildSectionPayload(
  institutionId: number,
  jobId: number,
  sectionId: number,
  section: Row,
  jobSectionIds: Set<number>,
  timeLimitSeconds: number
): Record<string, unknown> {
  const db = getDb();

  const allSubjects = db
    .prepare("SELECT * FROM subjects WHERE institution_id = ?")
    .all(institutionId) as Row[];
  const subjects = allSubjects.filter(
    (s) =>
      Number(s.section_id) === sectionId ||
      (s.section_id === null && Number(s.department_id) === Number(section.department_id))
  );

  const teacherIds = new Set(subjects.map((s) => Number(s.faculty_id)).filter((v) => Number.isFinite(v)));
  const teachers = (db.prepare("SELECT * FROM teachers WHERE institution_id = ?").all(institutionId) as Row[]).filter(
    (t) => teacherIds.has(Number(t.id))
  );

  const classrooms = db.prepare("SELECT * FROM classrooms WHERE institution_id = ?").all(institutionId) as Row[];
  const allSlots = db
    .prepare("SELECT * FROM time_slots WHERE institution_id = ? ORDER BY day_of_week, sort_order, start_time")
    .all(institutionId) as Row[];

  // day_of_week 0-6 (Monday=0); keep only days that actually have slots.
  const daySet = new Set(allSlots.map((s) => Number(s.day_of_week)));
  const days = DAY_NAMES.filter((_, idx) => daySet.has(idx));

  // Availability grid → {teacherId: [unavailable slot ids]}
  const unavailableRows = db
    .prepare("SELECT teacher_id, time_slot_id FROM teacher_availability WHERE available = 0")
    .all() as Row[];
  const teacherUnavailable: Record<number, number[]> = {};
  for (const row of unavailableRows) {
    const tId = Number(row.teacher_id);
    if (!teacherIds.has(tId)) continue;
    (teacherUnavailable[tId] ??= []).push(Number(row.time_slot_id));
  }

  // Occupied slots: entries this job must not clash with — other sections'
  // live rows plus sections already solved earlier in THIS job. Sections being
  // regenerated here are excluded from the old timetable so it does not constrain
  // its own replacement, while earlier staged sections in this job ARE preserved.
  const occupied = loadOccupiedSlots(institutionId, jobId, sectionId, jobSectionIds);

  return {
    classrooms: classrooms.map((c) => ({
      id: Number(c.id),
      roomNumber: String(c.room_number),
      type: String(c.type ?? "lecture"),
      capacity: Number(c.capacity ?? 0),
    })),
    subjects: subjects.map((s) => ({
      id: Number(s.id),
      name: String(s.name),
      departmentId: Number(s.department_id),
      sectionId: s.section_id === null ? null : Number(s.section_id),
      facultyId: s.faculty_id === null ? null : Number(s.faculty_id),
      weeklyHours: Number(s.weekly_hours ?? 1),
      type: String(s.type ?? "lecture"),
    })),
    faculty: teachers.map((t) => ({
      id: Number(t.id),
      name: String(t.name),
      departmentId: Number(t.department_id ?? 0),
      maxPeriodsDay: t.max_periods_day === null ? null : Number(t.max_periods_day),
      maxPeriodsWeek: t.max_periods_week === null ? null : Number(t.max_periods_week),
    })),
    sections: [
      {
        id: Number(section.id),
        name: String(section.name),
        departmentId: Number(section.department_id),
        strength: section.strength === null ? null : Number(section.strength),
      },
    ],
    timeslots: allSlots.map((s) => ({
      id: Number(s.id),
      dayOfWeek: DAY_NAMES[Number(s.day_of_week)],
      label: String(s.label),
      startTime: String(s.start_time),
      endTime: String(s.end_time),
    })),
    days,
    occupiedSlots: occupied,
    teacherUnavailable,
    timeLimitSeconds,
  };
}

function loadOccupiedSlots(
  institutionId: number,
  jobId: number,
  currentSectionId: number,
  jobSectionIds: Set<number>
): OccupiedSlot[] {
  const db = getDb();
  const occupied: OccupiedSlot[] = [];

  const activeVersion = db
    .prepare("SELECT id FROM timetable_versions WHERE institution_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1")
    .get(institutionId) as { id: number } | undefined;

  if (activeVersion) {
    const rows = db
      .prepare(
        `SELECT e.section_id, e.teacher_id, ts.day_of_week, ts.label AS slot_label, c.room_number
         FROM timetable_entries e
         JOIN time_slots ts ON ts.id = e.time_slot_id
         JOIN classrooms c ON c.id = e.classroom_id
         LEFT JOIN teachers t ON t.id = e.teacher_id
         WHERE e.version_id = ?`
      )
      .all(activeVersion.id) as Row[];
    for (const r of rows) {
      if (jobSectionIds.has(Number(r.section_id))) continue;
      occupied.push({
        day: DAY_NAMES[Number(r.day_of_week)],
        period: String(r.slot_label),
        facultyId: r.teacher_id === null ? null : Number(r.teacher_id),
        room: String(r.room_number),
      });
    }
  }

  // Sections already solved earlier in THIS job. Staging rows from other
  // (abandoned/rejected) jobs are intentionally ignored.
  // ONLY exclude the current section being solved so previous sections in this job are respected.
  const staged = db
    .prepare(
      `SELECT g.section_id, g.teacher_id, ts.day_of_week, ts.label AS slot_label, c.room_number
       FROM generation_results_staging g
       JOIN time_slots ts ON ts.id = g.time_slot_id
       JOIN classrooms c ON c.id = g.classroom_id
       WHERE g.job_id = ?`
    )
    .all(jobId) as Row[];
  for (const r of staged) {
    if (Number(r.section_id) === currentSectionId) continue;
    occupied.push({
      day: DAY_NAMES[Number(r.day_of_week)],
      period: String(r.slot_label),
      facultyId: r.teacher_id === null ? null : Number(r.teacher_id),
      room: String(r.room_number),
    });
  }

  return occupied;
}

/** Map the solver's string rows back to ids and write them to staging. */
function stageSectionResults(
  jobId: number,
  institutionId: number,
  payload: Record<string, unknown>,
  result: SolveResult
): number {
  const db = getDb();
  const slots = payload.timeslots as Array<{ id: number; dayOfWeek: string; label: string }>;
  const slotByKey = new Map(slots.map((s) => [`${s.dayOfWeek.trim()}__${s.label.trim()}`, s]));

  const classroomIdByNumber = new Map(
    (db.prepare("SELECT id, room_number FROM classrooms WHERE institution_id = ?").all(institutionId) as Row[]).map(
      (r) => [String(r.room_number).trim(), Number(r.id)]
    )
  );

  const insert = db.prepare(
    `INSERT INTO generation_results_staging (job_id, section_id, subject_id, teacher_id, classroom_id, time_slot_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let saved = 0;
  inTransaction((d) => {
    for (const row of result.timetable) {
      const slot = slotByKey.get(`${String(row.day).trim()}__${String(row.period).trim()}`);
      if (!slot) continue;
      const classroomId = classroomIdByNumber.get(String(row.room).trim());
      if (!classroomId) continue;
      insert.run(
        jobId,
        Number(row.sectionId),
        Number(row.subjectId),
        row.facultyId === null || row.facultyId === undefined ? null : Number(row.facultyId),
        classroomId,
        Number(slot.id)
      );
      saved += 1;
    }
  });
  return saved;
}

export function cancelGeneration(jobId: number): { ok: boolean } {
  const controller = cancellations.get(jobId);
  if (controller) controller.abort();
  getDb().prepare("DELETE FROM generation_results_staging WHERE job_id = ?").run(jobId);
  const current = jobProgress(jobId);
  if (current.status === "queued" || current.status === "running") {
    updateJob(jobId, { status: "cancelled", finished_at: new Date().toISOString() });
    emitProgress(jobProgress(jobId));
  }
  log(`Generation job ${jobId} cancel requested`, "scheduler");
  return { ok: true };
}

// ─── Inspection: job, history, staged preview ──────────────────────────────

export function getJob(jobId: number): Record<string, unknown> {
  const job = getDb().prepare("SELECT * FROM generation_jobs WHERE id = ?").get(jobId) as Row | undefined;
  if (!job) throw new Error("Generation job not found");
  const sections = getDb()
    .prepare(
      `SELECT gs.*, s.name AS section_name FROM generation_job_sections gs
       LEFT JOIN sections s ON s.id = gs.section_id
       WHERE gs.job_id = ? ORDER BY gs.section_id`
    )
    .all(jobId) as Row[];
  const parse = (v: unknown): unknown => {
    if (typeof v !== "string" || !v) return null;
    try { return JSON.parse(v); } catch { return null; }
  };
  return {
    ...job,
    diagnostics: parse(job.diagnostics_json),
    solverStatuses: parse(job.solver_statuses_json),
    sections,
  };
}

/**
 * The queued/running generation job, if any.
 *
 * The pre-update safety gate (spec §15) uses this to postpone an install that
 * would kill an in-flight generation, and Settings warns before offering it.
 */
export function runningGenerationJob(): { running: boolean; jobId: number | null } {
  const row = getDb()
    .prepare("SELECT id FROM generation_jobs WHERE status IN ('queued','running') ORDER BY id DESC LIMIT 1")
    .get() as { id: number } | undefined;
  return { running: row !== undefined, jobId: row?.id ?? null };
}

export function getHistory(institutionId?: number): Record<string, unknown>[] {
  const db = getDb();
  const rows = institutionId
    ? (db.prepare("SELECT * FROM generation_jobs WHERE institution_id = ? ORDER BY id DESC LIMIT 50").all(institutionId) as Row[])
    : (db.prepare("SELECT * FROM generation_jobs ORDER BY id DESC LIMIT 50").all() as Row[]);
  return rows.map((r) => ({
    id: Number(r.id),
    status: String(r.status),
    totalSections: Number(r.total_sections ?? 0),
    completedSections: Number(r.completed_sections ?? 0),
    failedSections: Number(r.failed_sections ?? 0),
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    error: r.error_message ?? null,
  }));
}

/** Staged rows for a job, shaped for the existing timetable grid. */
export function getStaged(jobId: number): Record<string, unknown>[] {
  const rows = getDb()
    .prepare(
      `SELECT g.id, g.section_id, g.subject_id, g.teacher_id, g.classroom_id, g.time_slot_id,
              s.name AS subject_name, s.code AS subject_code, s.type AS subject_type,
              t.name AS teacher_name, t.code AS teacher_code,
              c.room_number AS room_number,
              ts.label AS slot_label, ts.day_of_week AS slot_day, ts.start_time AS slot_start, ts.end_time AS slot_end,
              sec.name AS section_name
       FROM generation_results_staging g
       LEFT JOIN subjects s ON s.id = g.subject_id
       LEFT JOIN teachers t ON t.id = g.teacher_id
       LEFT JOIN classrooms c ON c.id = g.classroom_id
       LEFT JOIN time_slots ts ON ts.id = g.time_slot_id
       LEFT JOIN sections sec ON sec.id = g.section_id
       WHERE g.job_id = ?
       ORDER BY ts.day_of_week, ts.sort_order`
    )
    .all(jobId) as Row[];

  return rows.map((r) => ({
    id: Number(r.id),
    versionId: null,
    sectionId: Number(r.section_id),
    subjectId: Number(r.subject_id),
    facultyId: r.teacher_id === null ? null : Number(r.teacher_id),
    classroomId: Number(r.classroom_id),
    timeSlotId: Number(r.time_slot_id),
    subject: { id: Number(r.subject_id), name: r.subject_name, code: r.subject_code, type: r.subject_type },
    faculty: { id: r.teacher_id, name: r.teacher_name, code: r.teacher_code },
    classroom: { id: Number(r.classroom_id), roomNumber: r.room_number, type: null },
    timeSlot: {
      id: Number(r.time_slot_id),
      dayOfWeek: DAY_NAMES[Number(r.slot_day)],
      label: r.slot_label,
      startTime: r.slot_start,
      endTime: r.slot_end,
    },
    section: { id: Number(r.section_id), name: r.section_name },
  }));
}

/**
 * Promote staged results into a NEW active version. The previous version is
 * left untouched so the user can always roll back (spec §11).
 */
export function acceptStaged(jobId: number, label?: string): { versionId: number; entries: number } {
  const db = getDb();
  const job = db.prepare("SELECT * FROM generation_jobs WHERE id = ?").get(jobId) as Row | undefined;
  if (!job) throw new Error("Generation job not found");

  const stagedCount = (
    db.prepare("SELECT COUNT(*) AS c FROM generation_results_staging WHERE job_id = ?").get(jobId) as { c: number }
  ).c;
  if (stagedCount === 0) throw new Error("There is no staged timetable to apply for this job.");

  return inTransaction((d) => {
    // Safety net before replacing the live timetable (spec §13).
    d.prepare("UPDATE timetable_versions SET is_active = 0 WHERE institution_id = ?").run(Number(job.institution_id));

    const info = d
      .prepare(
        "INSERT INTO timetable_versions (institution_id, label, source, generation_job_id, is_active) VALUES (?, ?, 'generation', ?, 1)"
      )
      .run(Number(job.institution_id), label ?? `Generated ${new Date().toLocaleString()}`, jobId);
    const versionId = Number(info.lastInsertRowid);

    d.prepare(
      `INSERT INTO timetable_entries (version_id, section_id, subject_id, teacher_id, classroom_id, time_slot_id)
       SELECT ?, section_id, subject_id, teacher_id, classroom_id, time_slot_id
       FROM generation_results_staging WHERE job_id = ?`
    ).run(versionId, jobId);

    d.prepare("DELETE FROM generation_results_staging WHERE job_id = ?").run(jobId);

    log(`Job ${jobId} accepted → timetable version ${versionId} (${stagedCount} entries)`, "scheduler");
    return { versionId, entries: stagedCount };
  });
}

export function discardStaged(jobId: number): { ok: boolean } {
  getDb().prepare("DELETE FROM generation_results_staging WHERE job_id = ?").run(jobId);
  log(`Job ${jobId} staged results discarded by user`, "scheduler");
  return { ok: true };
}

// ─── Versions, conflicts ───────────────────────────────────────────────────

export function getVersions(institutionId?: number): Record<string, unknown>[] {
  const db = getDb();
  const rows = (
    institutionId
      ? (db
          .prepare("SELECT * FROM timetable_versions WHERE institution_id = ? ORDER BY id DESC LIMIT 50")
          .all(institutionId) as Row[])
      : (db.prepare("SELECT * FROM timetable_versions ORDER BY id DESC LIMIT 50").all() as Row[])
  );
  const countStmt = db.prepare("SELECT COUNT(*) AS c FROM timetable_entries WHERE version_id = ?");
  return rows.map((r) => ({
    id: Number(r.id),
    label: r.label,
    source: r.source,
    isActive: Number(r.is_active) === 1,
    createdAt: r.created_at,
    generationJobId: r.generation_job_id,
    entries: (countStmt.get(Number(r.id)) as { c: number }).c,
  }));
}

export function activateVersion(versionId: number): { ok: boolean } {
  inTransaction((d) => {
    const version = d.prepare("SELECT * FROM timetable_versions WHERE id = ?").get(versionId) as Row | undefined;
    if (!version) throw new Error("Timetable version not found");
    d.prepare("UPDATE timetable_versions SET is_active = 0 WHERE institution_id = ?").run(
      Number(version.institution_id)
    );
    d.prepare("UPDATE timetable_versions SET is_active = 1 WHERE id = ?").run(versionId);
  });
  log(`Active timetable version switched to ${versionId}`, "scheduler");
  return { ok: true };
}

export function deleteVersion(versionId: number): { ok: boolean } {
  const db = getDb();
  const version = db.prepare("SELECT * FROM timetable_versions WHERE id = ?").get(versionId) as Row | undefined;
  if (!version) throw new Error("Timetable version not found");
  if (Number(version.is_active) === 1) throw new Error("The active timetable cannot be deleted. Activate another version first.");
  db.prepare("DELETE FROM timetable_versions WHERE id = ?").run(versionId);
  log(`Timetable version ${versionId} deleted`, "scheduler");
  return { ok: true };
}

export interface Conflict {
  type: "teacher" | "classroom" | "section";
  timeSlotId: number;
  day: string;
  period: string;
  label: string;
  entries: number[];
}

/** Detect double-booking in the active version (spec §9 conflict detection). */
export function getConflicts(institutionId?: number): Conflict[] {
  const db = getDb();
  const institution = institutionId ?? currentInstitutionId();
  const active = db
    .prepare("SELECT id FROM timetable_versions WHERE institution_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1")
    .get(institution) as { id: number } | undefined;
  if (!active) return [];

  const rows = db
    .prepare(
      `SELECT e.id, e.time_slot_id, e.section_id, e.teacher_id, e.classroom_id,
              ts.day_of_week, ts.label AS slot_label,
              sec.name AS section_name, t.name AS teacher_name, c.room_number
       FROM timetable_entries e
       JOIN time_slots ts ON ts.id = e.time_slot_id
       LEFT JOIN sections sec ON sec.id = e.section_id
       LEFT JOIN teachers t ON t.id = e.teacher_id
       LEFT JOIN classrooms c ON c.id = e.classroom_id
       WHERE e.version_id = ?`
    )
    .all(active.id) as Row[];

  const buckets = new Map<string, Row[]>();
  const add = (key: string, row: Row) => {
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  };
  for (const r of rows) {
    if (r.teacher_id !== null) add(`teacher:${r.teacher_id}:${r.time_slot_id}`, r);
    if (r.classroom_id !== null) add(`classroom:${r.classroom_id}:${r.time_slot_id}`, r);
    add(`section:${r.section_id}:${r.time_slot_id}`, r);
  }

  const conflicts: Conflict[] = [];
  for (const [key, list] of buckets) {
    if (list.length < 2) continue;
    const [type, , slotId] = key.split(":");
    const first = list[0];
    const name =
      type === "teacher" ? first.teacher_name : type === "classroom" ? first.room_number : first.section_name;
    conflicts.push({
      type: type as Conflict["type"],
      timeSlotId: Number(slotId),
      day: DAY_NAMES[Number(first.day_of_week)],
      period: String(first.slot_label),
      label: String(name ?? ""),
      entries: list.map((r) => Number(r.id)),
    });
  }
  return conflicts.sort((a, b) => a.day.localeCompare(b.day) || a.period.localeCompare(b.period));
}
