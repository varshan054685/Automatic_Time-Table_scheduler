import { db } from "./db";
import { 
  users, departments, classrooms, subjects, faculty, sections, timeSlots, timetable,
  workspaces, workspaceMembers, changeRequests, generationJobs, generationResults, otpVerifications,
  type User, type Workspace, type WorkspaceMember, type ChangeRequest,
  type Department, type Classroom, type Subject, type Faculty, type Section, type TimeSlot, type TimetableEntry,
  type GenerationJob, type GenerationResult, type OtpVerification
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
  // SECURITY: Always require workspaceId — no unscoped queries
  async getDepartments(workspaceId: number): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.workspaceId, workspaceId));
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
    await db.delete(departments).where(eq(departments.id, id));
  }

  // ─── Classrooms (workspace-scoped) ───
  async getClassrooms(workspaceId: number): Promise<Classroom[]> {
    return await db.select().from(classrooms).where(eq(classrooms.workspaceId, workspaceId));
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
    await db.delete(timetable).where(eq(timetable.classroomId, id));
    await db.delete(classrooms).where(eq(classrooms.id, id));
  }

  // ─── Subjects (workspace-scoped) ───
  async getSubjects(workspaceId: number): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.workspaceId, workspaceId));
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
    await db.delete(timetable).where(eq(timetable.subjectId, id));
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  // ─── Faculty (workspace-scoped) ───
  async getFaculty(workspaceId: number): Promise<Faculty[]> {
    return await db.select().from(faculty).where(eq(faculty.workspaceId, workspaceId));
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
    await db.delete(timetable).where(eq(timetable.facultyId, id));
    await db.delete(faculty).where(eq(faculty.id, id));
  }

  // ─── Sections (workspace-scoped) ───
  async getSections(workspaceId: number): Promise<Section[]> {
    return await db.query.sections.findMany({
      where: eq(sections.workspaceId, workspaceId),
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
    await db.delete(sections).where(eq(sections.id, id));
  }

  // ─── TimeSlots (workspace-scoped) ───
  async getTimeSlots(workspaceId: number): Promise<TimeSlot[]> {
    return await db.select().from(timeSlots).where(eq(timeSlots.workspaceId, workspaceId)).orderBy(timeSlots.id);
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
    await db.delete(timetable).where(eq(timetable.timeSlotId, id));
    await db.delete(timeSlots).where(eq(timeSlots.id, id));
  }

  // ─── Timetable (workspace-scoped) ───
  // SECURITY: workspaceId is now required — never query without workspace scope
  async getTimetable(sectionId: number | undefined, facultyId: number | undefined, workspaceId: number): Promise<any[]> {
    const conditions = [eq(timetable.workspaceId, workspaceId)];
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
    await db.delete(timetable).where(eq(timetable.sectionId, sectionId));
  }

  async clearAllTimetable(workspaceId: number): Promise<void> {
    await db.delete(timetable).where(eq(timetable.workspaceId, workspaceId));
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

    // 2. Delete old timetable entries for these sections
    for (const secId of sectionIds) {
      await db.delete(timetable).where(
        and(eq(timetable.sectionId, secId), eq(timetable.workspaceId, workspaceId))
      );
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
    for (const entry of entries) {
      await db.insert(timetable).values(entry);
    }

    // 4. Clean up staging
    await this.cleanupStagedEntries(jobId);

    return entries.length;
  }

  async cleanupStagedEntries(jobId: number): Promise<void> {
    await db.delete(generationResults).where(eq(generationResults.jobId, jobId));
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
      .orderBy(otpVerifications.createdAt)
      .limit(1);
    return otp;
  }

  async getLatestOtpForPhone(phoneNumber: string): Promise<OtpVerification | undefined> {
    const [otp] = await db.select()
      .from(otpVerifications)
      .where(and(eq(otpVerifications.phoneNumber, phoneNumber), eq(otpVerifications.type, 'phone')))
      .orderBy(otpVerifications.createdAt)
      .limit(1);
    return otp;
  }

  async deleteExpiredOtps(): Promise<void> {
    const now = new Date();
    await db.delete(otpVerifications).where(lt(otpVerifications.expiresAt, now));
  }
}

export const storage = new DatabaseStorage();
