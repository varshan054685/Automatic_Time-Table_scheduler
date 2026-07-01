export const KNOWLEDGE = {
  workflow: {
    auth: `To get started, head to the login page and sign in using your Email, Phone, or Google account. If you're registering for the first time, click "Create Account" and we'll send you a 6-digit OTP to verify your email.\n\nAre you having any trouble logging in?`,
    workspace: `You can manage your workspace from the **Settings** page. There, you'll find your workspace details along with referral codes to invite your team. Share the Admin code for full access, or the Observer code for read-only access.\n\nDo you need to know how to delete or leave a workspace?`,
    roles: `You don't need to manually assign roles. Your role is determined automatically by the invite code you used to join. The person who creates the workspace, or joins with the Admin code, becomes an Owner. Those using the Observer code become Viewers.\n\nDo you want to know what Viewers are allowed to do?`,
    change_requests: `As an Owner, you can review change requests by going to **Settings → Requests**. You'll see a list of pending edits or deletions suggested by Viewers. Just click **Approve** to apply the change, or **Reject** to discard it.\n\nAre you a Viewer wondering how to submit a request?`,
    departments: `To add a department, go to **Departments** in the sidebar and click **Add Department**. You'll just need to provide a name (like "Computer Science") and a short code. \n\nAre you ready to add your faculty and subjects to this department?`,
    classrooms: `To add a classroom, open the **Classrooms** page and click **Add Classroom**. Enter the room number and its seating capacity. You can also specify if it's a Lecture hall or a Lab.\n\nDo you need help understanding how the scheduler uses these rooms?`,
    faculty: `You can add teachers one by one on the **Faculty** page, or use the **Import** button to upload them all at once via an Excel file. Just make sure each faculty member has a unique code and is assigned to a department.\n\nAre you trying to resolve a faculty scheduling conflict?`,
    sections: `To create a student group, go to the **Sections** page. Click **Add Section**, give it a name (like "CS-A"), and specify the academic year and semester. You can also assign a default classroom if you want.\n\nDo you need to generate a timetable for a specific section?`,
    subjects: `You can add subjects manually on the **Subjects** page, or use the **Import Dataset** button to upload an Excel file. The most important step is assigning a **Default Faculty** to the subject—if a subject doesn't have a teacher, the scheduler will skip it.\n\nAre you trying to configure a practical lab subject?`,
    time_slots: `To build your weekly grid, go to the **Time Slots** page. You'll need to create a separate slot for every period on every day. For example, Monday Period 1 and Tuesday Period 1 are two different records.\n\nDo you need to know how to add Breaks or Lunch periods?`,
    timetable_generation: `To generate a timetable, make sure all your data (subjects, faculty, time slots) is set up. Then open the **Timetable** page and click **Regenerate All**. A progress screen will appear while the AI solver works on each section. \n\nDo you need help fixing a generation error?`,
    exports: `To print your timetable or save it as a PDF, open the **Timetable** page, select your department and section, and click the **Print** button. This will format the schedule into a clean, institutional document layout.\n\nWere you looking to export master data like Faculty or Subjects instead?`
  },
  concept: {
    auth: `Our authentication system uses secure sessions and bcrypt password hashing. It supports Email/Password with OTP verification, Phone login, and Google OAuth 2.0. OTPs expire exactly 5 minutes after they are requested.\n\nDo you need help recovering your password?`,
    workspace: `Think of workspaces as isolated environments for different schools or departments. You can only belong to one workspace at a time. Owners have full control to edit data, while Viewers can only suggest changes for the Owner to approve.\n\nDo you need to invite someone to your workspace?`,
    roles: `There are two roles: **Owner** (full write access) and **Viewer** (read-only). Viewers can browse all data and timetables, but if they try to edit or delete a record, the system intercepts it and creates a "Change Request" instead.\n\nWould you like to know how Owners approve these requests?`,
    change_requests: `The change request system protects your data. When a Viewer tries to edit or delete something, the system automatically creates a pending request. The original data stays exactly as it is until the Owner explicitly approves the change.\n\nDo you want to know where to find these requests?`,
    departments: `Departments are the top-level organisational units in the system. Almost everything else—faculty, sections, and subjects—must be linked to a department to keep your data organised.\n\nDo you need help creating one?`,
    classrooms: `Classrooms are the physical spaces where classes happen. The scheduler uses them to ensure no room is double-booked. While you can tag them as "lecture" or "lab", the scheduler doesn't currently restrict assignments based on the room type.\n\nDo you need to know how to add one?`,
    faculty: `Faculty records represent your teaching staff. The scheduler relies heavily on these records to enforce its most important rule: no teacher can be in two places at once, and no teacher can teach more than 7 hours a day.\n\nDo you need help importing a list of faculty?`,
    sections: `A section represents a specific class cohort, like first-year computer science students (CS-A). The system generates a completely separate, conflict-free timetable for every individual section in your workspace.\n\nDo you need to know how to assign subjects to a section?`,
    subjects: `Subjects are the courses being taught. The "Weekly Hours" field tells the scheduler exactly how many time slots this subject needs per week. If it's a lab subject, the scheduler handles it differently by grouping the hours together.\n\nDo you want to know more about how labs are scheduled?`,
    time_slots: `Time slots define the grid of your weekly schedule. To add a break or lunch, simply include the word "Break" or "Lunch" in the slot's label. The scheduler knows to skip these periods automatically.\n\nDo you need to know how the Lunch slot affects lab sessions?`,
    timetable_generation: `Timetable generation is an automated process that takes your academic constraints—like teacher availability and room capacities—and builds a conflict-free schedule for you.\n\nWould you like me to walk you through how to generate one, or do you want to dive into the technical details of the algorithm?`,
    exports: `The system provides two types of exports. You can print the generated timetable to a formatted PDF using the Print button, or you can download Excel templates from the Faculty and Subjects pages to bulk-import your master data.\n\nWhich type of export are you trying to do?`,
    lab: `Labs are treated as special practical sessions. The system automatically schedules them as continuous blocks (usually 2-3 periods). It also ensures that a lab block happens entirely in the morning or entirely in the afternoon—it will never cross your Lunch break.\n\nAre you trying to configure a lab right now?`
  },
  technical: {
    architecture: `The application uses a modern 3-tier architecture. The frontend is built with React and Vite. The backend runs on Node.js with Express and uses Drizzle ORM to connect to a PostgreSQL database. Finally, the heavy lifting for scheduling is handled by a separate Python FastAPI microservice.\n\nDo you want to know more about the database schema or the solver API?`,
    database: `We use PostgreSQL managed by Drizzle ORM. The core tables handle workspaces, academic departments, faculty profiles, subjects, and the final timetable entries. We also have tables for tracking async generation jobs and staging the results.\n\nAre you looking for details on a specific table?`,
    api: `The backend provides a REST API. All CRUD endpoints are secured by middlewares that verify your workspace membership to prevent IDOR attacks. The timetable generation is triggered via a POST request that pushes jobs to an in-memory queue.\n\nDo you need to know how the Python microservice is called?`,
    timetable_generation: `Under the hood, we use Google's OR-Tools CP-SAT solver in a Python microservice. It strictly prevents overlaps for faculty and rooms, and enforces a 7-hour daily limit for teachers. It also applies soft constraints to keep schedules compact and minimize back-to-back classes for the same subject.\n\nAre you running into an issue with the solver constraints?`,
    queue: `Timetable generation is completely asynchronous. When triggered, section jobs are pushed to an in-memory queue. They are processed sequentially, and the results are written to a staging table. Once all sections succeed, an atomic swap promotes the staging data to the live timetable.\n\nAre you curious about what happens if only some sections fail?`
  },
  troubleshooting: {
    generation_failed: `If the timetable fails to generate or says the constraints are too strict, it usually means the solver couldn't find a valid combination. \n\nI recommend checking that you have enough time slots for your subjects' weekly hours, and that every subject has a faculty member assigned. Also, verify that your teachers aren't exceeding their daily 7-hour limits.\n\nDo you want to review your subject hours first?`,
    login_failed: `I can help with that. If your login isn't working, double-check that your OTP hasn't expired (they're valid for 5 minutes). If you forgot your password, you can use the "Forgot Password" link to reset it.\n\nAre you seeing a specific error message?`,
    import_failed: `If your Excel import skipped some rows, the most common reason is a mismatch in the Department column. The department name or code in your spreadsheet must match an existing department in your workspace exactly. \n\nDid you check the error summary toast that appeared after importing?`,
    viewer_edit: `If you are trying to edit or delete a record but it's not changing, it's likely because you have the Viewer role. Your edits don't apply immediately; instead, they are sent as "Change Requests" to the Owner for approval.\n\nWould you like to know how the Owner approves them?`
  }
};

export const TOPIC_KEYWORDS = {
  auth: ["login", "register", "password", "otp", "auth", "account", "sign in", "google", "oauth"],
  workspace: ["workspace", "team", "invite", "referral", "delete workspace", "leave workspace", "settings", "profile"],
  roles: ["role", "owner", "viewer", "admin", "observer", "permission", "access"],
  change_requests: ["change request", "approve", "reject", "pending request", "suggest"],
  departments: ["department", "departments", "dept"],
  classrooms: ["classroom", "classrooms", "room", "capacity"],
  faculty: ["faculty", "teacher", "professor", "staff", "instructor"],
  sections: ["section", "sections", "student group", "cohort", "semester", "year"],
  subjects: ["subject", "subjects", "course", "courses", "weekly hours"],
  time_slots: ["timeslot", "time slot", "timeslots", "period", "break", "lunch"],
  timetable_generation: ["timetable", "schedule", "generate", "generation", "algorithm", "solver", "or-tools", "cp-sat"],
  exports: ["export", "import", "excel", "print", "pdf", "template"],
  lab: ["lab", "practical", "contiguous", "block", "morning session", "afternoon session"],
  architecture: ["tech", "stack", "architecture", "built", "react", "node", "python", "fastapi"],
  database: ["database", "schema", "sql", "postgres", "drizzle", "table"],
  api: ["api", "endpoint", "rest", "middleware", "route"],
  queue: ["queue", "async", "staging", "atomic", "background job"]
};
