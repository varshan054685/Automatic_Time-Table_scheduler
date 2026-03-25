import { db } from "./db";
import { 
  users, departments, classrooms, subjects, faculty, sections, timeSlots, timetable,
  workspaces, workspaceMembers, changeRequests,
  type User, type Workspace, type WorkspaceMember, type ChangeRequest,
  type Department, type Classroom, type Subject, type Faculty, type Section, type TimeSlot, type TimetableEntry
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export class DatabaseStorage {
  // ─── Auth ───
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // ─── Workspaces ───
  async createWorkspace(name: string, ownerId: number): Promise<Workspace> {
    const referralCode = generateReferralCode();
    const [ws] = await db.insert(workspaces).values({
      name,
      ownerId,
      referralCode,
    }).returning();

    // Add owner as member
    await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerId,
      role: "owner",
    });

    return ws;
  }

  async getWorkspaceByReferralCode(code: string): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.referralCode, code));
    return ws;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return ws;
  }

  async joinWorkspace(workspaceId: number, userId: number): Promise<WorkspaceMember> {
    // Check if already a member
    const existing = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
    if (existing.length > 0) return existing[0];

    const [member] = await db.insert(workspaceMembers).values({
      workspaceId,
      userId,
      role: "viewer",
    }).returning();
    return member;
  }

  async getUserWorkspaceMembership(userId: number): Promise<{workspaceId: number, role: string, workspaceName: string, referralCode: string} | null> {
    const rows = await db.select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      workspaceName: workspaces.name,
      referralCode: workspaces.referralCode,
    }).from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);
    return rows[0] || null;
  }

  async regenerateReferralCode(workspaceId: number): Promise<string> {
    const newCode = generateReferralCode();
    await db.update(workspaces).set({ referralCode: newCode }).where(eq(workspaces.id, workspaceId));
    return newCode;
  }

  async getWorkspaceMembers(workspaceId: number): Promise<any[]> {
    return await db.select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      email: users.email,
      name: users.name,
    }).from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async deleteWorkspace(workspaceId: number): Promise<void> {
    await db.delete(timetable).where(eq(timetable.workspaceId, workspaceId));
    await db.delete(timeSlots).where(eq(timeSlots.workspaceId, workspaceId));
    await db.delete(sections).where(eq(sections.workspaceId, workspaceId));
    await db.delete(subjects).where(eq(subjects.workspaceId, workspaceId));
    await db.delete(classrooms).where(eq(classrooms.workspaceId, workspaceId));
    await db.delete(faculty).where(eq(faculty.workspaceId, workspaceId));
    await db.delete(departments).where(eq(departments.workspaceId, workspaceId));
    await db.delete(changeRequests).where(eq(changeRequests.workspaceId, workspaceId));
    await db.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  }

  async leaveWorkspace(userId: number, workspaceId: number): Promise<void> {
    await db.delete(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)));
  }

  // ─── Change Requests ───
  async createChangeRequest(data: { workspaceId: number; requestedBy: number; type: string; data: any }): Promise<ChangeRequest> {
    const [cr] = await db.insert(changeRequests).values(data).returning();
    return cr;
  }

  async getChangeRequests(workspaceId: number): Promise<any[]> {
    return await db.select({
      id: changeRequests.id,
      workspaceId: changeRequests.workspaceId,
      requestedBy: changeRequests.requestedBy,
      type: changeRequests.type,
      data: changeRequests.data,
      status: changeRequests.status,
      createdAt: changeRequests.createdAt,
      requesterEmail: users.email,
      requesterName: users.name,
    }).from(changeRequests)
      .innerJoin(users, eq(changeRequests.requestedBy, users.id))
      .where(eq(changeRequests.workspaceId, workspaceId));
  }

  async getChangeRequest(id: number): Promise<ChangeRequest | undefined> {
    const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, id));
    return cr;
  }

  async updateChangeRequestStatus(id: number, status: string): Promise<ChangeRequest> {
    const [cr] = await db.update(changeRequests).set({ status }).where(eq(changeRequests.id, id)).returning();
    return cr;
  }

  // ─── Departments (workspace-scoped) ───
  async getDepartments(workspaceId?: number): Promise<Department[]> {
    if (workspaceId) {
      return await db.select().from(departments).where(eq(departments.workspaceId, workspaceId));
    }
    return await db.select().from(departments);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [d] = await db.select().from(departments).where(eq(departments.id, id));
    return d;
  }

  async createDepartment(dept: any): Promise<Department> {
    const [d] = await db.insert(departments).values(dept).returning();
    return d;
  }

  async updateDepartment(id: number, dept: any): Promise<Department> {
    const [d] = await db.update(departments).set(dept).where(eq(departments.id, id)).returning();
    if (!d) throw new Error("Department not found");
    return d;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  // ─── Classrooms (workspace-scoped) ───
  async getClassrooms(workspaceId?: number): Promise<Classroom[]> {
    if (workspaceId) {
      return await db.select().from(classrooms).where(eq(classrooms.workspaceId, workspaceId));
    }
    return await db.select().from(classrooms);
  }

  async getClassroom(id: number): Promise<Classroom | undefined> {
    const [c] = await db.select().from(classrooms).where(eq(classrooms.id, id));
    return c;
  }

  async createClassroom(room: any): Promise<Classroom> {
    const [c] = await db.insert(classrooms).values(room).returning();
    return c;
  }

  async updateClassroom(id: number, room: any): Promise<Classroom> {
    const [c] = await db.update(classrooms).set(room).where(eq(classrooms.id, id)).returning();
    if (!c) throw new Error("Classroom not found");
    return c;
  }

  async deleteClassroom(id: number): Promise<void> {
    await db.delete(classrooms).where(eq(classrooms.id, id));
  }

  // ─── Subjects (workspace-scoped) ───
  async getSubjects(workspaceId?: number): Promise<Subject[]> {
    if (workspaceId) {
      return await db.select().from(subjects).where(eq(subjects.workspaceId, workspaceId));
    }
    return await db.select().from(subjects);
  }

  async getSubject(id: number): Promise<Subject | undefined> {
    const [s] = await db.select().from(subjects).where(eq(subjects.id, id));
    return s;
  }

  async getSubjectsByDepartment(deptId: number): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.departmentId, deptId));
  }

  async createSubject(subject: any): Promise<Subject> {
    const [s] = await db.insert(subjects).values(subject).returning();
    return s;
  }

  async updateSubject(id: number, subject: any): Promise<Subject> {
    const [s] = await db.update(subjects).set(subject).where(eq(subjects.id, id)).returning();
    if (!s) throw new Error("Subject not found");
    return s;
  }

  async deleteSubject(id: number): Promise<void> {
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  // ─── Faculty (workspace-scoped) ───
  async getFaculty(workspaceId?: number): Promise<Faculty[]> {
    if (workspaceId) {
      return await db.select().from(faculty).where(eq(faculty.workspaceId, workspaceId));
    }
    return await db.select().from(faculty);
  }

  async getFacultyById(id: number): Promise<Faculty | undefined> {
    const [f] = await db.select().from(faculty).where(eq(faculty.id, id));
    return f;
  }

  async createFaculty(fac: any): Promise<Faculty> {
    const [f] = await db.insert(faculty).values(fac).returning();
    return f;
  }

  async updateFaculty(id: number, fac: any): Promise<Faculty> {
    const [f] = await db.update(faculty).set(fac).where(eq(faculty.id, id)).returning();
    if (!f) throw new Error("Faculty not found");
    return f;
  }

  async deleteFaculty(id: number): Promise<void> {
    await db.delete(faculty).where(eq(faculty.id, id));
  }

  // ─── Sections (workspace-scoped) ───
  async getSections(workspaceId?: number): Promise<Section[]> {
    if (workspaceId) {
      return await db.query.sections.findMany({
        where: eq(sections.workspaceId, workspaceId),
        with: { department: true, classroom: true },
      }) as any;
    }
    return await db.query.sections.findMany({
      with: { department: true, classroom: true },
    }) as any;
  }

  async getSection(id: number): Promise<Section | undefined> {
    const [s] = await db.select().from(sections).where(eq(sections.id, id));
    return s;
  }

  async createSection(section: any): Promise<Section> {
    const [s] = await db.insert(sections).values(section).returning();
    return s;
  }

  async updateSection(id: number, section: any): Promise<Section> {
    const [s] = await db.update(sections).set(section).where(eq(sections.id, id)).returning();
    if (!s) throw new Error("Section not found");
    return s;
  }

  async deleteSection(id: number): Promise<void> {
    await db.delete(sections).where(eq(sections.id, id));
  }

  // ─── TimeSlots (workspace-scoped) ───
  async getTimeSlots(workspaceId?: number): Promise<TimeSlot[]> {
    if (workspaceId) {
      return await db.select().from(timeSlots).where(eq(timeSlots.workspaceId, workspaceId)).orderBy(timeSlots.id);
    }
    return await db.select().from(timeSlots).orderBy(timeSlots.id);
  }

  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    const [t] = await db.select().from(timeSlots).where(eq(timeSlots.id, id));
    return t;
  }

  async createTimeSlot(slot: any): Promise<TimeSlot> {
    const [t] = await db.insert(timeSlots).values(slot).returning();
    return t;
  }

  async updateTimeSlot(id: number, slot: any): Promise<TimeSlot> {
    const [t] = await db.update(timeSlots).set(slot).where(eq(timeSlots.id, id)).returning();
    if (!t) throw new Error("Time slot not found");
    return t;
  }

  async deleteTimeSlot(id: number): Promise<void> {
    await db.delete(timeSlots).where(eq(timeSlots.id, id));
  }

  // ─── Timetable (workspace-scoped) ───
  async getTimetable(sectionId?: number, facultyId?: number, workspaceId?: number): Promise<any[]> {
    const conditions = [];
    if (sectionId) conditions.push(eq(timetable.sectionId, sectionId));
    if (facultyId) conditions.push(eq(timetable.facultyId, facultyId));
    if (workspaceId) conditions.push(eq(timetable.workspaceId, workspaceId));
    
    return await db.query.timetable.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      with: {
        subject: true,
        faculty: true,
        classroom: true,
        timeSlot: true,
        section: true,
      },
    });
  }

  async createTimetableEntry(entry: any): Promise<TimetableEntry> {
    const [t] = await db.insert(timetable).values(entry).returning();
    return t;
  }

  async clearTimetable(sectionId: number): Promise<void> {
    await db.delete(timetable).where(eq(timetable.sectionId, sectionId));
  }

  async clearAllTimetable(workspaceId?: number): Promise<void> {
    if (workspaceId) {
      await db.delete(timetable).where(eq(timetable.workspaceId, workspaceId));
    } else {
      await db.delete(timetable);
    }
  }

  async getAllAllocatedSlots(departmentId: number): Promise<TimetableEntry[]> {
    return await db.select().from(timetable);
  }
}

export const storage = new DatabaseStorage();
