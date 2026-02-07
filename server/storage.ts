import { db } from "./db";
import { 
  users, departments, classrooms, subjects, faculty, sections, timeSlots, timetable,
  type User, type InsertUser,
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
  createDepartment(dept: typeof departments.$inferInsert): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;

  // Classrooms
  getClassrooms(): Promise<Classroom[]>;
  createClassroom(room: typeof classrooms.$inferInsert): Promise<Classroom>;
  deleteClassroom(id: number): Promise<void>;

  // Subjects
  getSubjects(): Promise<Subject[]>;
  getSubjectsByDepartment(deptId: number): Promise<Subject[]>;
  createSubject(subject: typeof subjects.$inferInsert): Promise<Subject>;
  deleteSubject(id: number): Promise<void>;

  // Faculty
  getFaculty(): Promise<Faculty[]>;
  createFaculty(fac: typeof faculty.$inferInsert): Promise<Faculty>;
  deleteFaculty(id: number): Promise<void>;

  // Sections
  getSections(): Promise<Section[]>;
  createSection(section: typeof sections.$inferInsert): Promise<Section>;
  deleteSection(id: number): Promise<void>;

  // TimeSlots
  getTimeSlots(): Promise<TimeSlot[]>;
  createTimeSlot(slot: typeof timeSlots.$inferInsert): Promise<TimeSlot>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async createDepartment(dept: typeof departments.$inferInsert): Promise<Department> {
    const [d] = await db.insert(departments).values(dept).returning();
    return d;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getClassrooms(): Promise<Classroom[]> {
    return await db.select().from(classrooms);
  }

  async createClassroom(room: typeof classrooms.$inferInsert): Promise<Classroom> {
    const [c] = await db.insert(classrooms).values(room).returning();
    return c;
  }

  async deleteClassroom(id: number): Promise<void> {
    await db.delete(classrooms).where(eq(classrooms.id, id));
  }

  async getSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects);
  }

  async getSubjectsByDepartment(deptId: number): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.departmentId, deptId));
  }

  async createSubject(subject: typeof subjects.$inferInsert): Promise<Subject> {
    const [s] = await db.insert(subjects).values(subject).returning();
    return s;
  }

  async deleteSubject(id: number): Promise<void> {
    await db.delete(subjects).where(eq(subjects.id, id));
  }

  async getFaculty(): Promise<Faculty[]> {
    return await db.select().from(faculty);
  }

  async createFaculty(fac: typeof faculty.$inferInsert): Promise<Faculty> {
    const [f] = await db.insert(faculty).values(fac).returning();
    return f;
  }

  async deleteFaculty(id: number): Promise<void> {
    await db.delete(faculty).where(eq(faculty.id, id));
  }

  async getSections(): Promise<Section[]> {
    return await db.select().from(sections);
  }

  async createSection(section: typeof sections.$inferInsert): Promise<Section> {
    const [s] = await db.insert(sections).values(section).returning();
    return s;
  }

  async deleteSection(id: number): Promise<void> {
    await db.delete(sections).where(eq(sections.id, id));
  }

  async getTimeSlots(): Promise<TimeSlot[]> {
    return await db.select().from(timeSlots).orderBy(timeSlots.id);
  }

  async createTimeSlot(slot: typeof timeSlots.$inferInsert): Promise<TimeSlot> {
    const [t] = await db.insert(timeSlots).values(slot).returning();
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
