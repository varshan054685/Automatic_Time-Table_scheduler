import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // 1. Users
  const existingUser = await storage.getUserByUsername("admin");
  if (!existingUser) {
    await storage.createUser({
      username: "admin",
      password: "password123", // In a real app, hash this!
      role: "admin",
      name: "Admin User",
    });
    console.log("Created admin user");
  }

  const existingStaff = await storage.getUserByUsername("staff");
  if (!existingStaff) {
    await storage.createUser({
      username: "staff",
      password: "password123",
      role: "staff",
      name: "Dr. Smith",
    });
    console.log("Created staff user");
  }

  // 2. Departments
  const depts = await storage.getDepartments();
  if (depts.length === 0) {
    const cs = await storage.createDepartment({ name: "Computer Science", code: "CS" });
    const me = await storage.createDepartment({ name: "Mechanical Engineering", code: "ME" });
    console.log("Created departments");
    
    // 3. Classrooms
    await storage.createClassroom({ roomNumber: "101", capacity: 60, type: "lecture" });
    await storage.createClassroom({ roomNumber: "LAB-1", capacity: 30, type: "lab" });
    console.log("Created classrooms");

    // 4. Subjects
    await storage.createSubject({ name: "Data Structures", code: "CS201", weeklyHours: 4, departmentId: cs.id, type: "lecture" });
    await storage.createSubject({ name: "Database Systems", code: "CS301", weeklyHours: 3, departmentId: cs.id, type: "lecture" });
    console.log("Created subjects");

    // 5. Faculty
    await storage.createFaculty({ name: "Alice Johnson", departmentId: cs.id, email: "alice@college.edu", availability: [] });
    await storage.createFaculty({ name: "Bob Wilson", departmentId: cs.id, email: "bob@college.edu", availability: [] });
    console.log("Created faculty");

    // 6. Sections
    await storage.createSection({ name: "CS-A", year: 2, semester: 3, departmentId: cs.id });
    console.log("Created sections");

    // 7. Time Slots
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periods = [
      { start: "09:00", end: "10:00", label: "Period 1" },
      { start: "10:00", end: "11:00", label: "Period 2" },
      { start: "11:15", end: "12:15", label: "Period 3" },
      { start: "12:15", end: "13:15", label: "Period 4" },
      { start: "14:00", end: "15:00", label: "Period 5" },
    ];

    for (const day of days) {
      for (const p of periods) {
        await storage.createTimeSlot({
          dayOfWeek: day,
          startTime: p.start,
          endTime: p.end,
          label: p.label,
        });
      }
    }
    console.log("Created time slots");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
