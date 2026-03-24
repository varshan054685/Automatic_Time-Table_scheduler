import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api, generateTimetableSchema } from "@shared/routes";
import { generateWithPython } from "./python-scheduler";

// Middleware: require authenticated user with workspace
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

// Middleware: require owner role
function requireOwner(req: Request, res: Response, next: NextFunction) {
  if ((req as any).workspaceRole !== "owner") {
    return res.status(403).json({ message: "Only workspace owners can perform this action." });
  }
  next();
}

// Helper to safely parse param id
function paramId(req: Request): number {
  return parseInt(String(req.params.id), 10);
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
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Workspace name is required" });
      
      const existing = await storage.getUserWorkspaceMembership(user.id);
      if (existing) return res.status(400).json({ message: "You already belong to a workspace" });

      const ws = await storage.createWorkspace(name, user.id);
      res.status(201).json(ws);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.workspaces.join.path, async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as any;
    try {
      const { referralCode } = req.body;
      if (!referralCode) return res.status(400).json({ message: "Referral code is required" });
      
      const existing = await storage.getUserWorkspaceMembership(user.id);
      if (existing) return res.status(400).json({ message: "You already belong to a workspace" });

      const ws = await storage.getWorkspaceByReferralCode(referralCode);
      if (!ws) return res.status(404).json({ message: "Invalid referral code" });

      const member = await storage.joinWorkspace(ws.id, user.id);
      res.json({ workspace: ws, member });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
    const newCode = await storage.regenerateReferralCode(wsId);
    res.json({ referralCode: newCode });
  });

  // ─── Change Request Routes ───
  app.get(api.changeRequests.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const wsId = (req as any).workspaceId;
    const requests = await storage.getChangeRequests(wsId);
    res.json(requests);
  });

  app.post(api.changeRequests.approve.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const cr = await storage.getChangeRequest(id);
      if (!cr) return res.status(404).json({ message: "Change request not found" });
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
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.changeRequests.reject.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const cr = await storage.getChangeRequest(id);
      if (!cr) return res.status(404).json({ message: "Change request not found" });
      if (cr.workspaceId !== (req as any).workspaceId) return res.status(403).json({ message: "Not your workspace" });

      await storage.updateChangeRequestStatus(id, "rejected");
      res.json({ message: "Change request rejected" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
        console.log(`[Auto-regen] Department ${deptId} → saved ${count.saved} entries`);
      } catch (err: any) {
        console.warn(`[Auto-regen] Department ${deptId} → skipped: ${err.message}`);
      }
    }));
  };

  // ─── CRUD Routes (workspace-scoped) ───
  const viewerCheck = (tableName: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      if ((req as any).workspaceRole !== "owner") {
        const type = req.method === "DELETE" ? "delete" : "edit";
        const data: any = { table: tableName, id: paramId(req) };
        if (type === "edit") data.changes = req.body;

        await storage.createChangeRequest({
          workspaceId: (req as any).workspaceId,
          requestedBy: (req as any).wsUserId,
          type,
          data,
        });
        return res.status(202).json({ message: "Your change request has been submitted for approval." });
      }
      next();
    };
  };

  // Timetable generation
  app.post(api.timetable.generatePython.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const parsed = generateTimetableSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
      const count = await generateAndPersistTimetable(parsed.data.departmentId, (req as any).workspaceId, parsed.data.semester);
      res.json({ message: "Timetable generated successfully", count });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to generate timetable: " + error.message });
    }
  });

  app.post("/api/timetable/regenerate-all", requireWorkspace, requireOwner, async (req: Request, res: Response) => {
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
        error: r.status === "rejected" ? (r.reason?.message || String(r.reason)) : undefined,
      }));
      const totalSaved = summary.reduce((acc, s) => acc + (s.result?.saved || 0), 0);
      res.json({ message: `Regenerated for ${allDepts.length} department(s). Total: ${totalSaved}.`, summary, totalSaved });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to regenerate: " + error.message });
    }
  });

  // Departments
  app.get(api.departments.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const depts = await storage.getDepartments((req as any).workspaceId);
    res.json(depts);
  });
  app.post(api.departments.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const dept = await storage.createDepartment({ ...req.body, workspaceId: (req as any).workspaceId });
    res.status(201).json(dept);
    triggerRegenForDepartments([dept.id], (req as any).workspaceId);
  });
  app.patch(api.departments.update.path, requireWorkspace, viewerCheck("departments"), async (req: Request, res: Response) => {
    const dept = await storage.updateDepartment(paramId(req), req.body);
    res.json(dept);
    triggerRegenForDepartments([dept.id], (req as any).workspaceId);
  });
  app.delete(api.departments.delete.path, requireWorkspace, viewerCheck("departments"), async (req: Request, res: Response) => {
    await storage.deleteDepartment(paramId(req));
    res.status(204).send();
  });

  // Classrooms
  app.get(api.classrooms.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const rooms = await storage.getClassrooms((req as any).workspaceId);
    res.json(rooms);
  });
  app.post(api.classrooms.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const room = await storage.createClassroom({ ...req.body, workspaceId: (req as any).workspaceId });
    res.status(201).json(room);
  });
  app.patch(api.classrooms.update.path, requireWorkspace, viewerCheck("classrooms"), async (req: Request, res: Response) => {
    const room = await storage.updateClassroom(paramId(req), req.body);
    res.json(room);
  });
  app.delete(api.classrooms.delete.path, requireWorkspace, viewerCheck("classrooms"), async (req: Request, res: Response) => {
    await storage.deleteClassroom(paramId(req));
    res.status(204).send();
  });

  // Subjects
  app.get(api.subjects.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const subjs = await storage.getSubjects((req as any).workspaceId);
    res.json(subjs);
  });
  app.post(api.subjects.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const subj = await storage.createSubject({ ...req.body, workspaceId: (req as any).workspaceId });
    res.status(201).json(subj);
  });
  app.patch(api.subjects.update.path, requireWorkspace, viewerCheck("subjects"), async (req: Request, res: Response) => {
    const subj = await storage.updateSubject(paramId(req), req.body);
    res.json(subj);
  });
  app.delete(api.subjects.delete.path, requireWorkspace, viewerCheck("subjects"), async (req: Request, res: Response) => {
    await storage.deleteSubject(paramId(req));
    res.status(204).send();
  });

  // Faculty
  app.get(api.faculty.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const facs = await storage.getFaculty((req as any).workspaceId);
    res.json(facs);
  });
  app.post(api.faculty.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const data = req.body;
    if (!data.code) data.code = `FAC${Date.now()}`;
    const fac = await storage.createFaculty({ ...data, workspaceId: (req as any).workspaceId });
    res.status(201).json(fac);
  });
  app.patch(api.faculty.update.path, requireWorkspace, viewerCheck("faculty"), async (req: Request, res: Response) => {
    const fac = await storage.updateFaculty(paramId(req), req.body);
    res.json(fac);
  });
  app.delete(api.faculty.delete.path, requireWorkspace, viewerCheck("faculty"), async (req: Request, res: Response) => {
    await storage.deleteFaculty(paramId(req));
    res.status(204).send();
  });

  // Sections
  app.get(api.sections.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const secs = await storage.getSections((req as any).workspaceId);
    res.json(secs);
  });
  app.post(api.sections.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const sec = await storage.createSection({ ...req.body, workspaceId: (req as any).workspaceId });
    res.status(201).json(sec);
  });
  app.patch(api.sections.update.path, requireWorkspace, viewerCheck("sections"), async (req: Request, res: Response) => {
    const sec = await storage.updateSection(paramId(req), req.body);
    res.json(sec);
  });
  app.delete(api.sections.delete.path, requireWorkspace, viewerCheck("sections"), async (req: Request, res: Response) => {
    await storage.deleteSection(paramId(req));
    res.status(204).send();
  });

  // TimeSlots
  app.get(api.timeSlots.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const slots = await storage.getTimeSlots((req as any).workspaceId);
    res.json(slots);
  });
  app.post(api.timeSlots.create.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    const slot = await storage.createTimeSlot({ ...req.body, workspaceId: (req as any).workspaceId });
    res.status(201).json(slot);
  });
  app.patch(api.timeSlots.update.path, requireWorkspace, viewerCheck("timeSlots"), async (req: Request, res: Response) => {
    const slot = await storage.updateTimeSlot(paramId(req), req.body);
    res.json(slot);
  });
  app.delete(api.timeSlots.delete.path, requireWorkspace, viewerCheck("timeSlots"), async (req: Request, res: Response) => {
    await storage.deleteTimeSlot(paramId(req));
    res.status(204).send();
  });

  // Timetable
  app.get(api.timetable.list.path, requireWorkspace, async (req: Request, res: Response) => {
    const sectionId = req.query.sectionId ? parseInt(String(req.query.sectionId), 10) : undefined;
    const facultyId = req.query.facultyId ? parseInt(String(req.query.facultyId), 10) : undefined;
    const entries = await storage.getTimetable(sectionId, facultyId, (req as any).workspaceId);
    res.json(entries);
  });

  app.post(api.timetable.generate.path, requireWorkspace, requireOwner, async (req: Request, res: Response) => {
    try {
      const parsed = generateTimetableSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
      const count = await generateAndPersistTimetable(parsed.data.departmentId, (req as any).workspaceId, parsed.data.semester);
      res.json({ message: "Timetable generated successfully", count });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  return httpServer;
}
