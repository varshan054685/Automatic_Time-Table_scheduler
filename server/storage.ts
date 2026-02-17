import { db } from "./db";
import { 
  users, departments, classrooms, subjects, faculty, sections, timeSlots, timetable,
  type User,
  type Department, type Classroom, type Subject, type Faculty, type Section, type TimeSlot, type TimetableEntry
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: number): Promise<Department | undefined>;
  createDepartment(dept: typeof departments.$inferInsert): Promise<Department>;
  updateDepartment(id: number, dept: Partial<typeof departments.$inferInsert>): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;

  // Classrooms
  getClassrooms(): Promise<Classroom[]>;
  getClassroom(id: number): Promise<Classroom | undefined>;
  createClassroom(room: typeof classrooms.$inferInsert): Promise<Classroom>;
  updateClassroom(id: number, room: Partial<typeof classrooms.$inferInsert>): Promise<Classroom>;
  deleteClassroom(id: number): Promise<void>;

  // Subjects
  getSubjects(): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  getSubjectsByDepartment(deptId: number): Promise<Subject[]>;
  createSubject(subject: typeof subjects.$inferInsert): Promise<Subject>;
  updateSubject(id: number, subject: Partial<typeof subjects.$inferInsert>): Promise<Subject>;
  deleteSubject(id: number): Promise<void>;

  // Faculty
  getFaculty(): Promise<Faculty[]>;
  getFacultyById(id: number): Promise<Faculty | undefined>;
  createFaculty(fac: typeof faculty.$inferInsert): Promise<Faculty>;
  updateFaculty(id: number, fac: Partial<typeof faculty.$inferInsert>): Promise<Faculty>;
  deleteFaculty(id: number): Promise<void>;

  // Sections
  getSections(): Promise<Section[]>;
  getSection(id: number): Promise<Section | undefined>;
  createSection(section: typeof sections.$inferInsert): Promise<Section>;
  updateSection(id: number, section: Partial<typeof sections.$inferInsert>): Promise<Section>;
  deleteSection(id: number): Promise<void>;

  // TimeSlots
  getTimeSlots(): Promise<TimeSlot[]>;
  getTimeSlot(id: number): Promise<TimeSlot | undefined>;
  createTimeSlot(slot: typeof timeSlots.$inferInsert): Promise<TimeSlot>;
  updateTimeSlot(id: number, slot: Partial<typeof timeSlots.$inferInsert>): Promise<TimeSlot>;
  deleteTimeSlot(id: number): Promise<void>;

  // Timetable
  getTimetable(sectionId?: number, facultyId?: number): Promise<any[]>; // Returns enriched data
  createTimetableEntry(entry: typeof timetable.$inferInsert): Promise<TimetableEntry>;
  clearTimetable(sectionId: number): Promise<void>;
  
  // For scheduler
  getAllAllocatedSlots(departmentId: number): Promise<TimetableEntry[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: any): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getDepartment(id: number): Promise<Department | undefined> {
    const [d] = await db.select().from(departments).where(eq(departments.id, id));
    return d;
  }

  async createDepartment(dept: typeof departments.$inferInsert): Promise<Department> {
    const [d] = await db.insert(departments).values(dept).returning();
    return d;
  }

  async updateDepartment(id: number, dept: Partial<typeof departments.$inferInsert>): Promise<Department> {
    const [d] = await db.update(departments).set(dept).where(eq(departments.id, id)).returning();
    if (!d) throw new Error("Department not found");
    return d;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getClassrooms(): Promise<Classroom[]> {
    return await db.select().from(classrooms);
  }

  async getClassroom(id: number): Promise<Classroom | undefined> {
    const [c] = await db.select().from(classrooms).where(eq(classrooms.id, id));
    return c;
  }

  async createClassroom(room: typeof classrooms.$inferInsert): Promise<Classroom> {
    const [c] = await db.insert(classrooms).values(room).returning();
    return c;
  }

  async updateClassroom(id: number, room: Partial<typeof classrooms.$inferInsert>): Promise<Classroom> {
    const [c] = await db.update(classrooms).set(room).where(eq(classrooms.id, id)).returning();
    if (!c) throw new Error("Classroom not found");
    return c;
  }

  async deleteClassroom(id: number): Promise<void> {
    await db.delete(classrooms).where(eq(classrooms.id, id));
  }

  async getSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects);
  }

  async getSubject(id: number): Promise<Subject | undefined> {
    const [s] = await db.select().from(subjects).where(eq(subjects.id, id));
    return s;
  }

  async getSubjectsByDepartment(deptId: number): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.departmentId, deptId));
  }

  async createSubject(subject: typeof subjects.$inferInsert): Promise<Subject> {
    const [s] = await db.insert(subjects).values(subject).returning();
    return s;
  }

  async updateSubject(id: number, subject: Partial<typeof subjects.$inferInsert>): Promise<Subject> {
    const [s] = await db.update(subjects).set(subject).where(eq(subjects.id, id)).returning();
    if (!s) throw new Error("Subject not found");
    return s;
  }

  async deleteSubject(id: number): Promise<void> {
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  async getFaculty(): Promise<Faculty[]> {
    return await db.select().from(faculty);
  }

  async getFacultyById(id: number): Promise<Faculty | undefined> {
    const [f] = await db.select().from(faculty).where(eq(faculty.id, id));
    return f;
  }

  async createFaculty(fac: typeof faculty.$inferInsert): Promise<Faculty> {
    const [f] = await db.insert(faculty).values(fac).returning();
    return f;
  }

  async updateFaculty(id: number, fac: Partial<typeof faculty.$inferInsert>): Promise<Faculty> {
    const [f] = await db.update(faculty).set(fac).where(eq(faculty.id, id)).returning();
    if (!f) throw new Error("Faculty not found");
    return f;
  }

  async deleteFaculty(id: number): Promise<void> {
    await db.delete(faculty).where(eq(faculty.id, id));
  }

  async getSections(): Promise<Section[]> {
    return await db.select().from(sections);
  }

  async getSection(id: number): Promise<Section | undefined> {
    const [s] = await db.select().from(sections).where(eq(sections.id, id));
    return s;
  }

  async createSection(section: typeof sections.$inferInsert): Promise<Section> {
    const [s] = await db.insert(sections).values(section).returning();
    return s;
  }

  async updateSection(id: number, section: Partial<typeof sections.$inferInsert>): Promise<Section> {
    const [s] = await db.update(sections).set(section).where(eq(sections.id, id)).returning();
    if (!s) throw new Error("Section not found");
    return s;
  }

  async deleteSection(id: number): Promise<void> {
    await db.delete(sections).where(eq(sections.id, id));
  }

  async getTimeSlots(): Promise<TimeSlot[]> {
    return await db.select().from(timeSlots).orderBy(timeSlots.id);
  }

  async getTimeSlot(id: number): Promise<TimeSlot | undefined> {
    const [t] = await db.select().from(timeSlots).where(eq(timeSlots.id, id));
    return t;
  }

  async createTimeSlot(slot: typeof timeSlots.$inferInsert): Promise<TimeSlot> {
    const [t] = await db.insert(timeSlots).values(slot).returning();
    return t;
  }

  async updateTimeSlot(id: number, slot: Partial<typeof timeSlots.$inferInsert>): Promise<TimeSlot> {
    const [t] = await db.update(timeSlots).set(slot).where(eq(timeSlots.id, id)).returning();
    if (!t) throw new Error("Time slot not found");
    return t;
  }

  async deleteTimeSlot(id: number): Promise<void> {
    await db.delete(timeSlots).where(eq(timeSlots.id, id));
  }

  async getTimetable(sectionId?: number, facultyId?: number): Promise<any[]> {
    let query = db.query.timetable.findMany({
      with: {
        subject: true,
        faculty: true,
        classroom: true,
        timeSlot: true,
        section: true,
      },
    });
    
    // Note: Drizzle query builder filtering is a bit different, sticking to basic select for filtering if needed
    // But since we need relations, using query builder is better. 
    // Implementing client-side filtering or simple where clauses would be ideal.
    // For now, let's fetch all and filter in memory if volume is low, or use specific queries.
    
    // Better approach with query builder:
    const conditions = [];
    if (sectionId) conditions.push(eq(timetable.sectionId, sectionId));
    if (facultyId) conditions.push(eq(timetable.facultyId, facultyId));
    
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

  async createTimetableEntry(entry: typeof timetable.$inferInsert): Promise<TimetableEntry> {
    const [t] = await db.insert(timetable).values(entry).returning();
    return t;
  }

  async clearTimetable(sectionId: number): Promise<void> {
    await db.delete(timetable).where(eq(timetable.sectionId, sectionId));
  }

  async getAllAllocatedSlots(departmentId: number): Promise<TimetableEntry[]> {
    // Return all slots to check for global conflicts (room, faculty)
    // In a real app we'd filter by semester/year too
    return await db.select().from(timetable);
  }
}

export const storage = new DatabaseStorage();
