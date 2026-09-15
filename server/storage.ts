import { db } from "./db";
import { 
  users, departments, classrooms, subjects, faculty, sections, timeSlots, timetable,
  workspaces, workspaceMembers, changeRequests, generationJobs, generationResults, otpVerifications,
  type User, type Workspace, type WorkspaceMember, type ChangeRequest,
  type Department, type Classroom, type Subject, type Faculty, type Section, type TimeSlot, type TimetableEntry,
  type GenerationJob, type GenerationResult, type OtpVerification
} from "@shared/schema";
import { eq, and, lt, desc, isNull, isNotNull, gt, or, sql } from "drizzle-orm";
import crypto from "crypto";

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// Entity table mapping used by the sync push endpoint.
const SYNC_TABLE_MAP: Record<string, { table: any }> = {
  department: { table: departments },
  classroom: { table: classrooms },
  faculty: { table: faculty },
  section: { table: sections },
  subject: { table: subjects },
  time_slot: { table: timeSlots },
  timetable_entry: { table: timetable },
  change_request: { table: changeRequests },
};

// Fields that a client is allowed to write for each entity (server-owned fields excluded).
const SYNC_FIELDS: Record<string, string[]> = {
  department: ["name", "code"],
  classroom: ["roomNumber", "capacity", "type"],
  faculty: ["name", "code", "departmentId", "email", "availability"],
  section: ["name", "year", "semester", "departmentId", "classroomId"],
  subject: ["code", "name", "weeklyHours", "departmentId", "facultyId", "sectionId", "type"],
  time_slot: ["dayOfWeek", "startTime", "endTime", "label"],
  timetable_entry: ["sectionId", "subjectId", "facultyId", "classroomId", "timeSlotId"],
  // requestedBy is server-injected from the authenticated user in the push route.
  change_request: ["type", "data", "status", "requestedBy"],
};

/** Picks only allowed writable fields from a payload (drops server-owned/unknown keys). */
function pickSyncFields(payload: any, fields: string[]): any {
  const out: any = {};
  for (const f of fields) {
    if (payload[f] !== undefined) out[f] = payload[f];
  }
  return out;
}

export class DatabaseStorage {
  // ─── Auth ───
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    return user;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber.trim()));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    // Strip sensitive fields that should never be updated via this method
    const { password: _, id: __, ...safeData } = data as any;
    const [u] = await db.update(users).set(safeData).where(eq(users.id, id)).returning();
    return u;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<User> {
    const [u] = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return u;
  }

  // ─── Workspaces ───
  async createWorkspace(name: string, ownerId: number): Promise<Workspace> {
    const referralCode = generateReferralCode();
    const adminReferralCode = generateReferralCode();
    const [ws] = await db.insert(workspaces).values({
      name,
      ownerId,
      referralCode,
      adminReferralCode,
    }).returning();

    // Add owner as member
    await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerId,
      role: "owner",
    });

    return ws;
  }

  async getWorkspaceByReferralCode(code: string): Promise<{ ws: Workspace; type: 'viewer' | 'owner' } | undefined> {
    let [ws] = await db.select().from(workspaces).where(eq(workspaces.referralCode, code));
    if (ws) return { ws, type: 'viewer' };
    [ws] = await db.select().from(workspaces).where(eq(workspaces.adminReferralCode, code));
    if (ws) return { ws, type: 'owner' };
    return undefined;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return ws;
  }

  async joinWorkspace(workspaceId: number, userId: number, role: 'viewer' | 'owner'): Promise<WorkspaceMember> {
    // Check if already a member
    const existing = await db.select().from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
    if (existing.length > 0) return existing[0];

    const [member] = await db.insert(workspaceMembers).values({
      workspaceId,
      userId,
      role,
    }).returning();
    return member;
  }

  async getUserWorkspaceMembership(userId: number): Promise<{workspaceId: number, role: string, workspaceName: string, referralCode: string, adminReferralCode: string, academicYear: string | null} | null> {
    const rows = await db.select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      workspaceName: workspaces.name,
      referralCode: workspaces.referralCode,
      adminReferralCode: workspaces.adminReferralCode,
      academicYear: workspaces.academicYear,
    }).from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .limit(1);
    return rows[0] || null;
  }

  async regenerateReferralCode(workspaceId: number, type: 'viewer' | 'owner'): Promise<string> {
    const newCode = generateReferralCode();
    if (type === 'owner') {
      await db.update(workspaces).set({ adminReferralCode: newCode }).where(eq(workspaces.id, workspaceId));
    } else {
      await db.update(workspaces).set({ referralCode: newCode }).where(eq(workspaces.id, workspaceId));
    }
    return newCode;
  }

  async getWorkspaceMembers(workspaceId: number): Promise<any[]> {
    return await db.select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      email: users.email,
      name: users.name,
      clientId: workspaceMembers.clientId,
      version: workspaceMembers.version,
      updatedAt: workspaceMembers.updatedAt,
      createdAt: workspaceMembers.createdAt,
    }).from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), isNull(workspaceMembers.deletedAt)));
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

  async removeMember(membershipId: number, workspaceId: number): Promise<void> {
    await db.delete(workspaceMembers).where(and(eq(workspaceMembers.id, membershipId), eq(workspaceMembers.workspaceId, workspaceId)));
  }

  async updateWorkspace(id: number, data: Partial<Workspace>): Promise<Workspace> {
    const [ws] = await db.update(workspaces).set(data).where(eq(workspaces.id, id)).returning();
    return ws;
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
      clientId: changeRequests.clientId,
      version: changeRequests.version,
      createdAt: changeRequests.createdAt,
      updatedAt: changeRequests.updatedAt,
      requesterEmail: users.email,
      requesterName: users.name,
    }).from(changeRequests)
      .innerJoin(users, eq(changeRequests.requestedBy, users.id))
      .where(and(eq(changeRequests.workspaceId, workspaceId), isNull(changeRequests.deletedAt)));
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
  // SECURITY: Always require workspaceId — no unscoped queries
  async getDepartments(workspaceId: number): Promise<Department[]> {
    return await db.select().from(departments)
      .where(and(eq(departments.workspaceId, workspaceId), isNull(departments.deletedAt)));
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [d] = await db.select().from(departments).where(eq(departments.id, id));
    return d;
  }

  /** SECURITY: Workspace-scoped single lookup for ownership verification */
  async getDepartmentScoped(id: number, workspaceId: number): Promise<Department | undefined> {
    const [d] = await db.select().from(departments).where(and(eq(departments.id, id), eq(departments.workspaceId, workspaceId)));
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
    // Soft delete so offline clients can learn about the removal via sync.
    await db.update(departments)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${departments.version} + 1` })
      .where(eq(departments.id, id));
  }

  // ─── Classrooms (workspace-scoped) ───
  async getClassrooms(workspaceId: number): Promise<Classroom[]> {
    return await db.select().from(classrooms)
      .where(and(eq(classrooms.workspaceId, workspaceId), isNull(classrooms.deletedAt)));
  }

  async getClassroom(id: number): Promise<Classroom | undefined> {
    const [c] = await db.select().from(classrooms).where(eq(classrooms.id, id));
    return c;
  }

  async getClassroomScoped(id: number, workspaceId: number): Promise<Classroom | undefined> {
    const [c] = await db.select().from(classrooms).where(and(eq(classrooms.id, id), eq(classrooms.workspaceId, workspaceId)));
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
    // Soft-delete dependent timetable entries (so offline clients learn of the
    // removal via sync), then soft delete the room.
    await db.update(timetable)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
      .where(eq(timetable.classroomId, id));
    await db.update(classrooms)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${classrooms.version} + 1` })
      .where(eq(classrooms.id, id));
  }

  // ─── Subjects (workspace-scoped) ───
  async getSubjects(workspaceId: number): Promise<Subject[]> {
    return await db.select().from(subjects)
      .where(and(eq(subjects.workspaceId, workspaceId), isNull(subjects.deletedAt)));
  }

  async getSubject(id: number): Promise<Subject | undefined> {
    const [s] = await db.select().from(subjects).where(eq(subjects.id, id));
    return s;
  }

  async getSubjectScoped(id: number, workspaceId: number): Promise<Subject | undefined> {
    const [s] = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.workspaceId, workspaceId)));
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
    await db.update(timetable)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
      .where(eq(timetable.subjectId, id));
    await db.update(subjects)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${subjects.version} + 1` })
      .where(eq(subjects.id, id));
  }

  // ─── Faculty (workspace-scoped) ───
  async getFaculty(workspaceId: number): Promise<Faculty[]> {
    return await db.select().from(faculty)
      .where(and(eq(faculty.workspaceId, workspaceId), isNull(faculty.deletedAt)));
  }

  async getFacultyById(id: number): Promise<Faculty | undefined> {
    const [f] = await db.select().from(faculty).where(eq(faculty.id, id));
    return f;
  }

  async getFacultyScoped(id: number, workspaceId: number): Promise<Faculty | undefined> {
    const [f] = await db.select().from(faculty).where(and(eq(faculty.id, id), eq(faculty.workspaceId, workspaceId)));
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
    await db.update(timetable)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
      .where(eq(timetable.facultyId, id));
    await db.update(faculty)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${faculty.version} + 1` })
      .where(eq(faculty.id, id));
  }

  // ─── Sections (workspace-scoped) ───
  async getSections(workspaceId: number): Promise<Section[]> {
    return await db.query.sections.findMany({
      where: and(eq(sections.workspaceId, workspaceId), isNull(sections.deletedAt)),
      with: { department: true, classroom: true },
    }) as any;
  }

  async getSection(id: number): Promise<Section | undefined> {
    const [s] = await db.select().from(sections).where(eq(sections.id, id));
    return s;
  }

  async getSectionScoped(id: number, workspaceId: number): Promise<Section | undefined> {
    const [s] = await db.select().from(sections).where(and(eq(sections.id, id), eq(sections.workspaceId, workspaceId)));
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
    await db.update(sections)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${sections.version} + 1` })
      .where(eq(sections.id, id));
  }

  // ─── TimeSlots (workspace-scoped) ───
  async getTimeSlots(workspaceId: number): Promise<TimeSlot[]> {
    return await db.select().from(timeSlots)
      .where(and(eq(timeSlots.workspaceId, workspaceId), isNull(timeSlots.deletedAt)))
      .orderBy(timeSlots.id);
  }

  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    const [t] = await db.select().from(timeSlots).where(eq(timeSlots.id, id));
    return t;
  }

  async getTimeSlotScoped(id: number, workspaceId: number): Promise<TimeSlot | undefined> {
    const [t] = await db.select().from(timeSlots).where(and(eq(timeSlots.id, id), eq(timeSlots.workspaceId, workspaceId)));
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
    await db.update(timetable)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
      .where(eq(timetable.timeSlotId, id));
    await db.update(timeSlots)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timeSlots.version} + 1` })
      .where(eq(timeSlots.id, id));
  }

  // ─── Timetable (workspace-scoped) ───
  // SECURITY: workspaceId is now required — never query without workspace scope
  async getTimetable(sectionId: number | undefined, facultyId: number | undefined, workspaceId: number): Promise<any[]> {
    const conditions = [eq(timetable.workspaceId, workspaceId), isNull(timetable.deletedAt)];
    if (sectionId) conditions.push(eq(timetable.sectionId, sectionId));
    if (facultyId) conditions.push(eq(timetable.facultyId, facultyId));
    
    return await db.query.timetable.findMany({
      where: and(...conditions),
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
    // Soft delete so offline clients learn about the removal via sync.
    await db.update(timetable)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
      .where(eq(timetable.sectionId, sectionId));
  }

  async clearAllTimetable(workspaceId: number): Promise<void> {
    await db.update(timetable)
      .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
      .where(eq(timetable.workspaceId, workspaceId));
  }

  // ─── Generation Jobs ───
  async createGenerationJob(workspaceId: number, totalSections: number): Promise<GenerationJob> {
    const [job] = await db.insert(generationJobs).values({
      workspaceId,
      totalSections,
      completedSections: 0,
      failedSections: 0,
      status: "processing",
    }).returning();
    return job;
  }

  async getJobStatus(jobId: number): Promise<GenerationJob | undefined> {
    const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, jobId));
    return job;
  }

  async updateJobProgress(jobId: number, completedSections: number, failedSections?: number): Promise<void> {
    const updates: any = { completedSections, updatedAt: new Date() };
    if (failedSections !== undefined) updates.failedSections = failedSections;
    await db.update(generationJobs)
      .set(updates)
      .where(eq(generationJobs.id, jobId));
  }

  async updateJobStatus(jobId: number, status: string, error?: string): Promise<void> {
    await db.update(generationJobs)
      .set({ status, error, updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  }

  // ─── Staging (generation_results) ───
  async createStagedEntry(entry: {
    jobId: number; workspaceId: number; sectionId: number;
    subjectId: number; facultyId: number; classroomId: number; timeSlotId: number;
  }): Promise<GenerationResult> {
    const [r] = await db.insert(generationResults).values(entry).returning();
    return r;
  }

  async getStagedEntries(jobId: number): Promise<GenerationResult[]> {
    return await db.select().from(generationResults).where(eq(generationResults.jobId, jobId));
  }

  async getStagedEntriesForConflictCheck(jobId: number, workspaceId: number): Promise<any[]> {
    // Join with timeSlots and classrooms to get day/period/room/faculty info for occupiedSlots
    return await db.select({
      sectionId: generationResults.sectionId,
      facultyId: generationResults.facultyId,
      classroomId: generationResults.classroomId,
      timeSlotId: generationResults.timeSlotId,
      dayOfWeek: timeSlots.dayOfWeek,
      label: timeSlots.label,
      roomNumber: classrooms.roomNumber,
    }).from(generationResults)
      .innerJoin(timeSlots, eq(generationResults.timeSlotId, timeSlots.id))
      .innerJoin(classrooms, eq(generationResults.classroomId, classrooms.id))
      .where(and(eq(generationResults.jobId, jobId), eq(generationResults.workspaceId, workspaceId)));
  }

  /** Atomic swap: move staged results into live timetable, replacing old entries for the given sections */
  async promoteStagedEntries(jobId: number, workspaceId: number, sectionIds: number[]): Promise<number> {
    // 1. Fetch all staged entries for this job
    const staged = await this.getStagedEntries(jobId);
    if (staged.length === 0) return 0;

    // 2. Soft-delete old timetable entries for these sections so offline
    //    clients can learn about the removal via sync (hard deletes would
    //    leave stale entries on devices forever).
    for (const secId of sectionIds) {
      await db.update(timetable)
        .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${timetable.version} + 1` })
        .where(and(eq(timetable.sectionId, secId), eq(timetable.workspaceId, workspaceId)));
    }

    // 3. Insert staged results into live timetable
    const entries = staged.map(s => ({
      workspaceId: s.workspaceId,
      sectionId: s.sectionId,
      subjectId: s.subjectId,
      facultyId: s.facultyId,
      classroomId: s.classroomId,
      timeSlotId: s.timeSlotId,
    }));
    
    // Batch insert
    if (entries.length > 0) {
      await db.insert(timetable).values(entries);
    }

    // 4. Clean up staging
    await this.cleanupStagedEntries(jobId);

    return entries.length;
  }

  async cleanupStagedEntries(jobId: number): Promise<void> {
    await db.delete(generationResults).where(eq(generationResults.jobId, jobId));
  }

  // ─── Sync (Phase 6: incremental download + versioned push) ───

  async getSyncBootstrap(workspaceId: number): Promise<any> {
    const [departmentsList, classroomsList, facultyList, sectionsList, subjectsList, timeSlotsList, timetableEntries, changeRequestsList, members] = await Promise.all([
      this.getDepartments(workspaceId),
      this.getClassrooms(workspaceId),
      this.getFaculty(workspaceId),
      this.getSections(workspaceId),
      this.getSubjects(workspaceId),
      this.getTimeSlots(workspaceId),
      this.getTimetable(undefined, undefined, workspaceId),
      this.getChangeRequests(workspaceId),
      this.getWorkspaceMembers(workspaceId),
    ]);
    return {
      departments: departmentsList,
      classrooms: classroomsList,
      faculty: facultyList,
      sections: sectionsList,
      subjects: subjectsList,
      timeSlots: timeSlotsList,
      timetableEntries,
      changeRequests: changeRequestsList,
      members,
    };
  }

  /** Rows created/updated/deleted after `since` for incremental download. */
  async getChangesSince(workspaceId: number, since: Date): Promise<any[]> {
    const changes: any[] = [];
    const entries: Array<{ entity: string; table: any; workspaceCol: any }> = [
      { entity: "department", table: departments, workspaceCol: departments.workspaceId },
      { entity: "classroom", table: classrooms, workspaceCol: classrooms.workspaceId },
      { entity: "faculty", table: faculty, workspaceCol: faculty.workspaceId },
      { entity: "section", table: sections, workspaceCol: sections.workspaceId },
      { entity: "subject", table: subjects, workspaceCol: subjects.workspaceId },
      { entity: "time_slot", table: timeSlots, workspaceCol: timeSlots.workspaceId },
      { entity: "timetable_entry", table: timetable, workspaceCol: timetable.workspaceId },
      { entity: "change_request", table: changeRequests, workspaceCol: changeRequests.workspaceId },
    ];

    for (const { entity, table, workspaceCol } of entries) {
      const rows = (await db.select().from(table).where(
        and(
          eq(workspaceCol, workspaceId),
          or(
            and(isNotNull(table.updatedAt), gt(table.updatedAt, since)),
            and(isNull(table.updatedAt), isNotNull(table.createdAt), gt(table.createdAt, since)),
            and(isNotNull(table.deletedAt), gt(table.deletedAt, since)),
          ),
        ),
      )) as any[];
      for (const row of rows) {
        const created = row.createdAt ? new Date(row.createdAt) : null;
        const deleted = row.deletedAt ? new Date(row.deletedAt) : null;
        const operation = deleted ? "DELETE" : created && created.getTime() >= since.getTime() ? "CREATE" : "UPDATE";
        changes.push({ entity, id: row.id, operation, row });
      }
    }
    return changes;
  }

  /** Applies one client operation with optimistic-concurrency checks. */
  async applySyncOperation(op: {
    entityType: string;
    clientId?: string | null;
    serverId?: number | null;
    operation: "CREATE" | "UPDATE" | "DELETE";
    payload?: any;
    baseVersion?: number | null;
    workspaceId: number;
  }): Promise<{ status: string; serverId?: number | null; version?: number; row?: any; error?: string }> {
    const def = SYNC_TABLE_MAP[op.entityType as keyof typeof SYNC_TABLE_MAP];
    if (!def) return { status: "error", error: `Unknown entity type: ${op.entityType}` };
    const { table } = def;
    const fields = SYNC_FIELDS[op.entityType as keyof typeof SYNC_FIELDS] ?? [];

    const findRow = async (): Promise<any | undefined> => {
      // Always scope by workspace — a clientId must never resolve to a row in
      // another workspace, even on UUID collision.
      if (op.serverId) {
        const [row] = await db.select().from(table)
          .where(and(eq(table.id, op.serverId), eq(table.workspaceId, op.workspaceId)))
          .limit(1);
        if (row) return row;
      }
      if (op.clientId) {
        const [row] = await db.select().from(table)
          .where(and(eq(table.clientId, op.clientId), eq(table.workspaceId, op.workspaceId)))
          .limit(1);
        if (row) return row;
      }
      return undefined;
    };

    if (op.operation === "DELETE") {
      const row = await findRow();
      if (!row) return { status: "ok", serverId: op.serverId ?? null };
      if (row.workspaceId !== op.workspaceId) return { status: "error", error: "Cross-workspace operation rejected" };
      await db.update(table)
        .set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${table.version} + 1` })
        .where(eq(table.id, row.id));
      return { status: "ok", serverId: row.id, version: Number(row.version) + 1 };
    }

    if (op.operation === "CREATE") {
      const existing = op.clientId ? await findRow() : undefined;
      if (existing) return { status: "ok", serverId: existing.id, version: Number(existing.version) };
      const values: any = {
        ...pickSyncFields(op.payload ?? {}, fields),
        workspaceId: op.workspaceId,
        clientId: op.clientId || null,
        version: 1,
      };
      const [inserted] = (await db.insert(table).values(values).returning()) as any[];
      return { status: "ok", serverId: inserted.id, version: 1 };
    }

    // UPDATE
    const row = await findRow();
    if (!row) return { status: "error", error: "Record not found" };
    if (row.workspaceId !== op.workspaceId) return { status: "error", error: "Cross-workspace operation rejected" };
    if (op.baseVersion != null && Number(row.version) !== Number(op.baseVersion)) {
      return { status: "conflict", serverId: row.id, version: Number(row.version), row };
    }
    await db.update(table)
      .set({ ...pickSyncFields(op.payload ?? {}, fields), updatedAt: new Date(), version: sql`${table.version} + 1` })
      .where(eq(table.id, row.id));
    const [after] = await db.select().from(table).where(eq(table.id, row.id)).limit(1);
    return { status: "ok", serverId: after.id, version: Number(after.version) };
  }

  // ─── OTP Verifications ───
  async createOtpVerification(data: { email?: string; phoneNumber?: string; otp: string; type: string; expiresAt: Date }): Promise<OtpVerification> {
    const [otp] = await db.insert(otpVerifications).values(data).returning();
    return otp;
  }

  async getLatestOtpForEmail(email: string): Promise<OtpVerification | undefined> {
    const [otp] = await db.select()
      .from(otpVerifications)
      .where(and(eq(otpVerifications.email, email), eq(otpVerifications.type, 'email')))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    return otp;
  }

  async getLatestOtpForPhone(phoneNumber: string): Promise<OtpVerification | undefined> {
    const [otp] = await db.select()
      .from(otpVerifications)
      .where(and(eq(otpVerifications.phoneNumber, phoneNumber), eq(otpVerifications.type, 'phone')))
      .orderBy(desc(otpVerifications.createdAt))
      .limit(1);
    return otp;
  }

  async deleteExpiredOtps(): Promise<void> {
    const now = new Date();
    await db.delete(otpVerifications).where(lt(otpVerifications.expiresAt, now));
  }

  async deleteOtpById(id: number): Promise<void> {
    await db.delete(otpVerifications).where(eq(otpVerifications.id, id));
  }
}

export const storage = new DatabaseStorage();
