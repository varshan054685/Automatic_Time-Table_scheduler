import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, generateTimetableSchema } from "@shared/routes";
import { generateWithPython } from "./python-scheduler";
import { generationLimiter } from "./rate-limit";
import { z } from "zod";
import { log } from "./index";

// ─── Middleware: require authenticated user with workspace ───
async function requireWorkspace(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.sendStatus(401);
  const user = req.user as any;
  try {
    const membership = await storage.getUserWorkspaceMembership(user.id);
    if (!membership) return res.status(403).json({ message: "No workspace found. Create or join a workspace first." });
    (req as any).workspaceId = membership.workspaceId;
    (req as any).workspaceRole = membership.role;
    (req as any).wsUserId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}

// ─── Middleware: require owner role ───
function requireOwner(req: Request, res: Response, next: NextFunction) {
  if ((req as any).workspaceRole !== "owner") {
    return res.status(403).json({ message: "Only workspace owners can perform this action." });
  }
  next();
}

// ─── Helper: safely parse and validate param ID ───
function paramId(req: Request, res: Response): number | null {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ message: "Invalid ID parameter" });
    return null;
  }
  return id;
}

// ─── SECURITY: Workspace ownership check for resources ───
// Verifies the resource with :id belongs to the requesting user's workspace
type ScopedLookup = (id: number, workspaceId: number) => Promise<any>;
function requireResourceOwnership(lookupFn: ScopedLookup, resourceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = paramId(req, res);
    if (id === null) return; // already sent 400
    const wsId = (req as any).workspaceId;
    const resource = await lookupFn(id, wsId);
    if (!resource) {
      return res.status(404).json({ message: `${resourceName} not found` });
    }
    (req as any).resource = resource;
    next();
  };
}

// ─── Validation schemas for CRUD input ───
const departmentSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(1).max(50).trim(),
}).strict();

const classroomSchema = z.object({
  roomNumber: z.string().min(1).max(100).trim(),
  capacity: z.number().int().min(1).max(10000),
  type: z.enum(["lecture", "lab"]).optional(),
}).strict();

const subjectSchema = z.object({
  code: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  weeklyHours: z.number().int().min(1).max(50),
  departmentId: z.number().int().positive(),
  facultyId: z.number().int().positive().nullable().optional(),
  sectionId: z.number().int().positive().nullable().optional(),
  type: z.enum(["lecture", "lab"]).optional(),
}).strict();

const facultySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  code: z.string().min(1).max(50).trim(),
  departmentId: z.number().int().positive(),
  email: z.string().email().max(255).nullable().optional(),
  availability: z.array(z.string()).optional(),
}).strict();

const sectionSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  year: z.number().int().min(1).max(10),
  semester: z.number().int().min(1).max(20),
  departmentId: z.number().int().positive(),
  classroomId: z.number().int().positive().nullable().optional(),
}).strict();

const timeSlotSchema = z.object({
  dayOfWeek: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  label: z.string().min(1).max(100).trim(),
}).strict();

const workspaceNameSchema = z.object({
  name: z.string().min(1).max(200).trim(),
}).strict();

const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  academicYear: z.string().max(50).trim().optional(),
}).strict();

const referralCodeSchema = z.object({
  referralCode: z.string().min(1).max(20).trim(),
}).strict();

// ─── Helper: validate request body ───
function validateBody<T>(schema: z.ZodSchema<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "Invalid input: " + result.error.issues.map(i => i.message).join(", ") });
    return null;
  }
  return result.data;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // ─── Workspace Routes ───
  app.post(api.workspaces.create.path, async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const data = validateBody(workspaceNameSchema, req, res);
      if (!data) return;
      
      const existing = await storage.getUserWorkspaceMembership(user.id);
      if (existing) return res.status(400).json({ message: "You already belong to a workspace" });

      const ws = await storage.createWorkspace(data.name, user.id);
      res.status(201).json(ws);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to create workspace" });
    }
  });

  app.post(api.workspaces.join.path, async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const data = validateBody(referralCodeSchema, req, res);
      if (!data) return;
      
      const existing = await storage.getUserWorkspaceMembership(user.id);
      if (existing) return res.status(400).json({ message: "You already belong to a workspace" });

      const wsData = await storage.getWorkspaceByReferralCode(data.referralCode);
      if (!wsData) return res.status(404).json({ message: "Invalid referral code" });

      const member = await storage.joinWorkspace(wsData.ws.id, user.id, wsData.type);
      res.json({ workspace: wsData.ws, member });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to join workspace" });
    }
  });

  app.get(api.workspaces.current.path, requireWorkspace, async (req: Request, res: Response) => {
    const wsId = (req as any).workspaceId;
    const ws = await storage.getWorkspace(wsId);
    const members = await storage.getWorkspaceMembers(wsId);
    res.json({ ...ws, members });
  });

  app.post(api.workspaces.regenerateCode.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const wsId = (req as any).workspaceId;
    const { type } = req.body;
    if (type !== 'admin' && type !== 'viewer') {
      return res.status(400).json({ message: "Type must be 'admin' or 'viewer'" });
    }
    const codeType = type === 'admin' ? 'owner' : 'viewer';
    const newCode = await storage.regenerateReferralCode(wsId, codeType);
    res.json({ referralCode: newCode, type: codeType === 'owner' ? 'admin' : 'viewer' });
  });

  app.patch("/api/workspaces/current", requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const wsId = (req as any).workspaceId;
    try {
      const data = validateBody(workspaceUpdateSchema, req, res);
      if (!data) return;
      const updated = await storage.updateWorkspace(wsId, data);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to update workspace" });
    }
  });

  app.delete(api.workspaces.delete.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const wsId = (req as any).workspaceId;
      await storage.deleteWorkspace(wsId);
      res.json({ message: "Workspace deleted" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete workspace" });
    }
  });

  app.post(api.workspaces.leave.path, requireWorkspace, async (req: Request, res: Response) => {
    try {
      if ((req as any).workspaceRole === "owner") {
        return res.status(400).json({ message: "Owners cannot leave the workspace, they must delete it." });
      }
      const wsId = (req as any).workspaceId;
      const userId = (req as any).wsUserId;
      await storage.leaveWorkspace(userId, wsId);
      res.json({ message: "Left workspace" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to leave workspace" });
    }
  });

  // ─── Change Request Routes ───
  app.get(api.changeRequests.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const wsId = (req as any).workspaceId;
    const requests = await storage.getChangeRequests(wsId);
    res.json(requests);
  });

  app.post(api.changeRequests.approve.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const id = paramId(req, res);
      if (id === null) return;
      const cr = await storage.getChangeRequest(id);
      if (!cr) return res.status(404).json({ message: "Change request not found" });
      // SECURITY: Verify change request belongs to this workspace
      if (cr.workspaceId !== (req as any).workspaceId) return res.status(403).json({ message: "Not your workspace" });
      if (cr.status !== "pending") return res.status(400).json({ message: "Request already processed" });

      const data = cr.data as any;
      if (cr.type === "edit" && data.table && data.id && data.changes) {
        const tableMap: Record<string, (rid: number, changes: any) => Promise<any>> = {
          departments: (rid, c) => storage.updateDepartment(rid, c),
          classrooms: (rid, c) => storage.updateClassroom(rid, c),
          subjects: (rid, c) => storage.updateSubject(rid, c),
          faculty: (rid, c) => storage.updateFaculty(rid, c),
          sections: (rid, c) => storage.updateSection(rid, c),
          timeSlots: (rid, c) => storage.updateTimeSlot(rid, c),
        };
        if (tableMap[data.table]) {
          await tableMap[data.table](data.id, data.changes);
        }
      } else if (cr.type === "delete" && data.table && data.id) {
        const deleteMap: Record<string, (rid: number) => Promise<void>> = {
          departments: (rid) => storage.deleteDepartment(rid),
          classrooms: (rid) => storage.deleteClassroom(rid),
          subjects: (rid) => storage.deleteSubject(rid),
          faculty: (rid) => storage.deleteFaculty(rid),
          sections: (rid) => storage.deleteSection(rid),
          timeSlots: (rid) => storage.deleteTimeSlot(rid),
        };
        if (deleteMap[data.table]) {
          await deleteMap[data.table](data.id);
        }
      }

      await storage.updateChangeRequestStatus(id, "approved");
      res.json({ message: "Change request approved and applied" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to approve change request" });
    }
  });

  app.post(api.changeRequests.reject.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const id = paramId(req, res);
      if (id === null) return;
      const cr = await storage.getChangeRequest(id);
      if (!cr) return res.status(404).json({ message: "Change request not found" });
      if (cr.workspaceId !== (req as any).workspaceId) return res.status(403).json({ message: "Not your workspace" });

      await storage.updateChangeRequestStatus(id, "rejected");
      res.json({ message: "Change request rejected" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to reject change request" });
    }
  });

  // ─── Helper: workspace-scoped timetable generation ───
  const generateAndPersistTimetable = async (departmentId: number, workspaceId: number, semester?: number) => {
    const allSections = await storage.getSections(workspaceId);
    const filteredSections = allSections.filter(
      (section: any) =>
        section.departmentId === departmentId &&
        (semester ? section.semester === semester : true),
    );

    if (filteredSections.length === 0) {
      throw new Error("No sections found for this department/semester");
    }

    const allSubjects = await storage.getSubjects(workspaceId);
    const subjectsForDept = allSubjects.filter(
      (subject) => subject.departmentId === departmentId &&
        (!subject.sectionId || filteredSections.some((section: any) => section.id === subject.sectionId)),
    );
    const allClassrooms = await storage.getClassrooms(workspaceId);
    const allTimeSlots = await storage.getTimeSlots(workspaceId);
    const allFaculty = await storage.getFaculty(workspaceId);
    const facultyForDept = allFaculty.filter((f) => f.departmentId === departmentId);

    if (allClassrooms.length === 0) throw new Error("No classrooms found");
    if (allTimeSlots.length === 0) throw new Error("No time slots found");
    
    if (subjectsForDept.length === 0) {
      return { received: 0, saved: 0, failed: 0 };
    }
    if (facultyForDept.length === 0) {
      return { received: 0, saved: 0, failed: 0 };
    }

    for (const section of filteredSections) {
      await storage.clearTimetable((section as any).id);
    }

    // Determine days from timeslots
    const daySet: Set<string> = new Set();
    allTimeSlots.forEach(s => daySet.add(s.dayOfWeek));
    const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const days = dayOrder.filter(d => daySet.has(d));

    const pythonResult = await generateWithPython({
      classrooms: allClassrooms.map((classroom) => ({ roomNumber: classroom.roomNumber })),
      subjects: subjectsForDept.map((subject) => ({
        id: subject.id, name: subject.name, departmentId: subject.departmentId,
        sectionId: subject.sectionId, facultyId: subject.facultyId,
        weeklyHours: subject.weeklyHours, type: subject.type,
      })),
      faculty: facultyForDept.map((f) => ({ id: f.id, name: f.name, departmentId: f.departmentId })),
      sections: filteredSections.map((section: any) => ({
        id: section.id, name: section.name, departmentId: section.departmentId,
      })),
      timeslots: allTimeSlots.map((slot) => ({
        id: slot.id, dayOfWeek: slot.dayOfWeek, label: slot.label,
        startTime: slot.startTime, endTime: slot.endTime,
      })),
      days,
    });

    const sectionById = new Map(filteredSections.map((s: any) => [s.id, s]));
    const facultyById = new Map(facultyForDept.map((f) => [f.id, f]));
    const subjectById = new Map(subjectsForDept.map((s) => [s.id, s]));
    const roomByNumber = new Map(allClassrooms.map((c) => [c.roomNumber.trim(), c]));
    const slotByKey = new Map(
      allTimeSlots.map((slot) => [`${slot.dayOfWeek.trim()}__${slot.label.trim()}`, slot] as const),
    );

    let saved = 0;
    let failed = 0;
    for (const row of pythonResult.timetable) {
      const section = sectionById.get(row.sectionId);
      const subject = subjectById.get(row.subjectId);
      const facultyMember = facultyById.get(row.facultyId);
      const room = roomByNumber.get(row.room.trim());
      const slot = slotByKey.get(`${row.day.trim()}__${row.period.trim()}`);

      if (!section || !subject || !facultyMember || !room || !slot) {
        failed += 1;
        continue;
      }

      await storage.createTimetableEntry({
        sectionId: (section as any).id,
        subjectId: subject.id,
        facultyId: facultyMember.id,
        classroomId: room.id,
        timeSlotId: slot.id,
        workspaceId,
      });
      saved += 1;
    }

    return { received: pythonResult.timetable.length, saved, failed };
  };

  const triggerRegenForDepartments = (departmentIds: number[], workspaceId: number) => {
    const unique = Array.from(new Set(departmentIds)).filter(Boolean);
    if (unique.length === 0) return;
    Promise.allSettled(unique.map(async (deptId) => {
      try {
        const count = await generateAndPersistTimetable(deptId, workspaceId);
        log(`[Auto-regen] Department ${deptId} → saved ${count.saved} entries`);
      } catch (err: any) {
        log(`[Auto-regen] Department ${deptId} → skipped: ${err.message}`);
      }
    }));
  };

  // ─── CRUD Routes (workspace-scoped) ───
  // SECURITY: viewerCheck creates a change request instead of directly modifying
  const viewerCheck = (tableName: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if ((req as any).workspaceRole !== "owner") {
        const id = paramId(req, res);
        if (id === null) return;
        const type = req.method === "DELETE" ? "delete" : "edit";
        const data: any = { table: tableName, id };
        if (type === "edit") data.changes = req.body;

        await storage.createChangeRequest({
          workspaceId: (req as any).workspaceId,
          requestedBy: (req as any).wsUserId,
          type,
          data,
        });
        return res.status(202).json({ message: "Request sent to admin" });
      }
      next();
    };
  };

  // Timetable generation (rate limited)
  app.post(api.timetable.generatePython.path, requireWorkspace, requireOwner, generationLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = generateTimetableSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
      const count = await generateAndPersistTimetable(parsed.data.departmentId, (req as any).workspaceId, parsed.data.semester);
      res.json({ message: "Timetable generated successfully", count });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate timetable" });
    }
  });

  app.post("/api/timetable/regenerate-all", requireWorkspace, requireOwner, generationLimiter, async (req: Request, res: Response) => {
    try {
      const wsId = (req as any).workspaceId;
      await storage.clearAllTimetable(wsId);
      const allDepts = await storage.getDepartments(wsId);
      const results = await Promise.allSettled(
        allDepts.map(dept => generateAndPersistTimetable(dept.id, wsId))
      );
      const summary = results.map((r, i) => ({
        deptId: allDepts[i].id, deptName: allDepts[i].name, status: r.status,
        result: r.status === "fulfilled" ? r.value : undefined,
        error: r.status === "rejected" ? "Generation failed" : undefined,
      }));
      const totalSaved = summary.reduce((acc, s) => acc + (s.result?.saved || 0), 0);
      res.json({ message: `Regenerated for ${allDepts.length} department(s). Total: ${totalSaved}.`, summary, totalSaved });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to regenerate timetables" });
    }
  });

  // ─── Departments (IDOR protected) ───
  app.get(api.departments.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const depts = await storage.getDepartments((req as any).workspaceId);
    res.json(depts);
  });

  app.post(api.departments.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = validateBody(departmentSchema, req, res);
    if (!data) return;
    const dept = await storage.createDepartment({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(dept);
    triggerRegenForDepartments([dept.id], (req as any).workspaceId);
  });

  app.patch(api.departments.update.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getDepartmentScoped(id, wsId), "Department"),
    viewerCheck("departments"),
    async (req: Request, res: Response) => {
      const data = validateBody(departmentSchema.partial(), req, res);
      if (!data) return;
      const id = paramId(req, res);
      if (id === null) return;
      const dept = await storage.updateDepartment(id, data);
      res.json(dept);
      triggerRegenForDepartments([dept.id], (req as any).workspaceId);
    }
  );

  app.delete(api.departments.delete.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getDepartmentScoped(id, wsId), "Department"),
    viewerCheck("departments"),
    async (req: Request, res: Response) => {
      const id = paramId(req, res);
      if (id === null) return;
      await storage.deleteDepartment(id);
      res.status(204).send();
    }
  );

  // ─── Classrooms (IDOR protected) ───
  app.get(api.classrooms.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const rooms = await storage.getClassrooms((req as any).workspaceId);
    res.json(rooms);
  });

  app.post(api.classrooms.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = validateBody(classroomSchema, req, res);
    if (!data) return;
    const room = await storage.createClassroom({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(room);
  });

  app.patch(api.classrooms.update.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getClassroomScoped(id, wsId), "Classroom"),
    viewerCheck("classrooms"),
    async (req: Request, res: Response) => {
      const data = validateBody(classroomSchema.partial(), req, res);
      if (!data) return;
      const id = paramId(req, res);
      if (id === null) return;
      const room = await storage.updateClassroom(id, data);
      res.json(room);
    }
  );

  app.delete(api.classrooms.delete.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getClassroomScoped(id, wsId), "Classroom"),
    viewerCheck("classrooms"),
    async (req: Request, res: Response) => {
      const id = paramId(req, res);
      if (id === null) return;
      await storage.deleteClassroom(id);
      res.status(204).send();
    }
  );

  // ─── Subjects (IDOR protected) ───
  app.get(api.subjects.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const subjs = await storage.getSubjects((req as any).workspaceId);
    res.json(subjs);
  });

  app.post(api.subjects.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = validateBody(subjectSchema, req, res);
    if (!data) return;
    const subj = await storage.createSubject({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(subj);
  });

  app.patch(api.subjects.update.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getSubjectScoped(id, wsId), "Subject"),
    viewerCheck("subjects"),
    async (req: Request, res: Response) => {
      const data = validateBody(subjectSchema.partial(), req, res);
      if (!data) return;
      const id = paramId(req, res);
      if (id === null) return;
      const subj = await storage.updateSubject(id, data);
      res.json(subj);
    }
  );

  app.delete(api.subjects.delete.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getSubjectScoped(id, wsId), "Subject"),
    viewerCheck("subjects"),
    async (req: Request, res: Response) => {
      const id = paramId(req, res);
      if (id === null) return;
      await storage.deleteSubject(id);
      res.status(204).send();
    }
  );

  // ─── Faculty (IDOR protected) ───
  app.get(api.faculty.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const facs = await storage.getFaculty((req as any).workspaceId);
    res.json(facs);
  });

  app.post(api.faculty.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = validateBody(facultySchema, req, res);
    if (!data) return;
    if (!data.code) (data as any).code = `FAC${Date.now()}`;
    const fac = await storage.createFaculty({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(fac);
  });

  app.patch(api.faculty.update.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getFacultyScoped(id, wsId), "Faculty"),
    viewerCheck("faculty"),
    async (req: Request, res: Response) => {
      const data = validateBody(facultySchema.partial(), req, res);
      if (!data) return;
      const id = paramId(req, res);
      if (id === null) return;
      const fac = await storage.updateFaculty(id, data);
      res.json(fac);
    }
  );

  app.delete(api.faculty.delete.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getFacultyScoped(id, wsId), "Faculty"),
    viewerCheck("faculty"),
    async (req: Request, res: Response) => {
      const id = paramId(req, res);
      if (id === null) return;
      await storage.deleteFaculty(id);
      res.status(204).send();
    }
  );

  // ─── Sections (IDOR protected) ───
  app.get(api.sections.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const secs = await storage.getSections((req as any).workspaceId);
    res.json(secs);
  });

  app.post(api.sections.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = validateBody(sectionSchema, req, res);
    if (!data) return;
    const sec = await storage.createSection({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(sec);
  });

  app.patch(api.sections.update.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getSectionScoped(id, wsId), "Section"),
    viewerCheck("sections"),
    async (req: Request, res: Response) => {
      const data = validateBody(sectionSchema.partial(), req, res);
      if (!data) return;
      const id = paramId(req, res);
      if (id === null) return;
      const sec = await storage.updateSection(id, data);
      res.json(sec);
    }
  );

  app.delete(api.sections.delete.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getSectionScoped(id, wsId), "Section"),
    viewerCheck("sections"),
    async (req: Request, res: Response) => {
      const id = paramId(req, res);
      if (id === null) return;
      await storage.deleteSection(id);
      res.status(204).send();
    }
  );

  // ─── TimeSlots (IDOR protected) ───
  app.get(api.timeSlots.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const slots = await storage.getTimeSlots((req as any).workspaceId);
    res.json(slots);
  });

  app.post(api.timeSlots.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = validateBody(timeSlotSchema, req, res);
    if (!data) return;
    const slot = await storage.createTimeSlot({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(slot);
  });

  app.patch(api.timeSlots.update.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getTimeSlotScoped(id, wsId), "Time slot"),
    viewerCheck("timeSlots"),
    async (req: Request, res: Response) => {
      const data = validateBody(timeSlotSchema.partial(), req, res);
      if (!data) return;
      const id = paramId(req, res);
      if (id === null) return;
      const slot = await storage.updateTimeSlot(id, data);
      res.json(slot);
    }
  );

  app.delete(api.timeSlots.delete.path, requireWorkspace,
    requireResourceOwnership((id, wsId) => storage.getTimeSlotScoped(id, wsId), "Time slot"),
    viewerCheck("timeSlots"),
    async (req: Request, res: Response) => {
      const id = paramId(req, res);
      if (id === null) return;
      await storage.deleteTimeSlot(id);
      res.status(204).send();
    }
  );

  // ─── Timetable (workspace-scoped queries) ───
  app.get(api.timetable.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const sectionId = req.query.sectionId ? parseInt(String(req.query.sectionId), 10) : undefined;
    const facultyId = req.query.facultyId ? parseInt(String(req.query.facultyId), 10) : undefined;
    
    // Validate query params
    if (req.query.sectionId && (isNaN(sectionId!) || sectionId! <= 0)) {
      return res.status(400).json({ message: "Invalid sectionId" });
    }
    if (req.query.facultyId && (isNaN(facultyId!) || facultyId! <= 0)) {
      return res.status(400).json({ message: "Invalid facultyId" });
    }

    const entries = await storage.getTimetable(sectionId, facultyId, (req as any).workspaceId);
    res.json(entries);
  });

  app.post(api.timetable.generate.path, requireWorkspace, requireOwner, generationLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = generateTimetableSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
      const count = await generateAndPersistTimetable(parsed.data.departmentId, (req as any).workspaceId, parsed.data.semester);
      res.json({ message: "Timetable generated successfully", count });
    } catch (error: any) {
      res.status(400).json({ message: "Failed to generate timetable" });
    }
  });

  return httpServer;
}
