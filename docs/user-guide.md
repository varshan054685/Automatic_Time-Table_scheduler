# User Guide

A complete beginner's guide to using the AI Timetable Scheduler.

---

## What is this application?

The AI Timetable Scheduler is a web application that automatically generates conflict-free weekly academic timetables for educational institutions. You feed it your departments, faculty, classrooms, sections, subjects, and time periods — and it uses an AI solver (Google OR-Tools CP-SAT) to produce schedules that ensure no teacher is in two places at once, no room is double-booked, and lab sessions are scheduled in contiguous blocks.

---

## Getting Started

### Step 1 — Create an Account

1. Open the application in your browser.
2. Click **Create Account** on the login page.
3. Enter your name and email address.
4. Click **Send Verification OTP** — a 6-digit code will be emailed to you.
5. Enter the code in the boxes, then click **Verify OTP**.
6. Set your password and click **Create Account**.

> Alternatively, click **Continue with Google** if Google login is enabled.

### Step 2 — Create a Workspace

After your first login, you will be prompted to set up a workspace.

1. Enter a workspace name (e.g. your institution's name).
2. Click **Create Workspace**.

You are now the **Owner** — you have full control over all data and scheduling.

### Step 3 — Invite Team Members (Optional)

If other coordinators or staff need access:

1. Go to **Settings → Referrals & Invites**.
2. Copy the **Observer Invite Link** (read-only access) or **Admin Invite Link** (full access).
3. Share the code. Recipients paste it on the join screen after registering.

---

## Setting Up Your Data

Before generating a timetable, you need to fill in all six types of master data. The Dashboard's **Setup Progress** checklist shows which ones are still missing.

### The recommended setup order:

```
1. Departments  →  2. Classrooms  →  3. Faculty  →  4. Sections  →  5. Subjects  →  6. Time Slots
```

---

### 1. Add Departments

Departments are the root of everything else.

1. Sidebar → **Departments**.
2. Click **Add Department**.
3. Enter a name (e.g. `Computer Science`) and a short code (e.g. `CS`).
4. Click Save.

Repeat for every department in your institution.

---

### 2. Add Classrooms

Classrooms are the rooms where classes will be held.

1. Sidebar → **Classrooms**.
2. Click **Add Classroom**.
3. Enter a room number (e.g. `LH-101`), seating capacity, and type (Lecture or Lab).
4. Save.

You need at least one classroom for generation to work.

---

### 3. Add Faculty

Faculty are your teaching staff.

1. Sidebar → **Faculty**.
2. Click **Add Faculty**.
3. Enter the faculty member's full name, a code (e.g. `FAC001`), select their department, and optionally their email.
4. Save.

**Tip**: If you have many faculty members, use the **Import** button to upload an Excel file.  
The required columns are: `Faculty Name`, `Faculty Code`, `Email`, `Department`.

---

### 4. Add Sections

Sections are class cohorts (groups of students).

1. Sidebar → **Sections**.
2. Click **Add Section**.
3. Enter a name (e.g. `CS-A`), year (e.g. `1`), semester (e.g. `1`), department, and optionally a default classroom.
4. Save.

---

### 5. Add Subjects

Subjects are the courses to be taught.

1. Sidebar → **Subjects**.
2. Click **Add Subject**.
3. Fill in: Subject Name, Subject Code, Weekly Hours, Learning Mode (Lecture or Lab), and Parent Department.
4. Assign a **Default Faculty** — this is the teacher who will teach this subject. **This is required for the scheduler to include the subject.**
5. Optionally assign a **Target Section** to restrict the subject to one cohort.
6. Save.

**Tip**: Use **Import Dataset** to upload subjects from Excel.  
Required columns: `Subject Name`, `Subject Code`, `Weekly Hours`, `Department`, `Default Faculty`, `Subject Type`.

> ⚠️ Subjects with no faculty assigned are skipped during timetable generation.

---

### 6. Add Time Slots

Time slots define the weekly schedule structure.

1. Sidebar → **Time Slots**.
2. Click **Add Time Slot**.
3. Select a day, enter start time (HH:MM), end time (HH:MM), and a label (e.g. `Period 1`).
4. Save and repeat for each period on each day.

**Important rules:**
- Create separate records for each day. E.g. Monday Period 1 and Tuesday Period 1 are two separate records.
- For breaks: create a slot with a label containing the word `Break` (e.g. `Morning Break`).
- For lunch: create a slot with `Lunch` in the label (e.g. `Lunch Break`). This is what splits your day into morning and afternoon sessions.

**Example setup for one day (Monday):**

| Label | Start | End |
|---|---|---|
| Period 1 | 09:00 | 10:00 |
| Period 2 | 10:00 | 11:00 |
| Morning Break | 11:00 | 11:15 |
| Period 3 | 11:15 | 12:15 |
| Period 4 | 12:15 | 13:15 |
| Lunch Break | 13:15 | 14:00 |
| Period 5 | 14:00 | 15:00 |
| Period 6 | 15:00 | 16:00 |

Duplicate this pattern for each working day.

---

## Generating the Timetable

Once all six setup steps are complete:

1. Go to **Timetable** in the sidebar.
2. Click **Regenerate All** (top-right corner).
3. Confirm the dialog.
4. A full-screen progress overlay appears showing real-time generation progress.
5. Wait for completion — each section is solved in up to 20 seconds.
6. On success, the grid becomes viewable.

---

## Viewing the Timetable

1. On the Timetable page, select a **Department**.
2. Then select either:
   - A specific **Class/Cohort** (section) to see that class's schedule.
   - **"Whole Department"** to see all sections at once.
   - A **Faculty** member to see all classes they teach.
3. The weekly grid renders with subjects, rooms, and faculty names in each cell.

**Keyboard shortcut**: Press **Escape** to clear all filters.

---

## Printing the Timetable

1. With a timetable visible, click the **Print** button.
2. The browser print dialog opens.
3. Choose landscape orientation (the page is preset for this).
4. Print or save as PDF.

The printed document includes your institution name, academic year, semester, department, and a course legend table.

---

## Exporting & Importing Master Data

Each master data page (Faculty, Subjects) has **Import** and **Export** buttons.

- **Export** downloads an Excel template with your current data (or a sample if empty).
- **Import** reads an Excel file and creates or updates records based on code/email matching.

This is the fastest way to bulk-load data at the start of a new academic year.

---

## Understanding Roles

| Role | Can do |
|---|---|
| **Owner** | Everything — create, edit, delete, generate, manage workspace |
| **Viewer / Observer** | View all data and timetables, submit change requests for edits/deletions |

When a Viewer tries to edit or delete a record, the system automatically creates a **change request** that the Owner can approve or reject.

---

## Managing Change Requests (Owner)

1. Go to **Settings → Requests**.
2. Pending requests show Approve and Reject buttons.
3. Click **Approve** to apply the change.
4. Click **Reject** to discard it.
5. You can also see a summary of recent pending requests on the **Dashboard**.

---

## Managing Your Workspace

### Update workspace name or academic year
`Settings → Workspace → Edit`

### Share invite links
`Settings → Referrals & Invites` — copy and share the Observer or Admin code.

### Remove a member
`Settings → Referrals & Invites → Workspace Members` — hover over a member card and click the remove icon.

### Regenerate invite codes
If you shared an invite code by mistake, click **Regenerate Code** to invalidate the old one.

### Delete workspace (destructive, irreversible)
`Settings → Advanced Settings → Delete Workspace` — type the exact workspace name to confirm.

---

## Troubleshooting Common Problems

### "Constraints might be too strict"
The solver could not find a valid schedule. Check:
- Every subject has a faculty assigned.
- You have enough time slots to cover all weekly hours.
- No faculty member has more than 7 hours of subjects per day.
- At least one classroom exists.

### "No sections found for this selection"
You triggered generation for a department/semester that has no sections. Add sections first.

### OTP email not received
Check your spam folder. In development, the OTP is printed to the server console.

### Timetable is empty after generation
Ensure subjects have a faculty assigned. Subjects with `facultyId = null` are skipped entirely by the scheduler.

### Generation takes very long
Each section gets 20 seconds. Workspaces with many sections may take several minutes. Wait for the progress overlay to complete.

---

## Quick Reference Checklist

Before clicking "Regenerate All", confirm:

- [ ] At least one Department exists
- [ ] At least one Classroom exists
- [ ] All Faculty members are added
- [ ] All Sections are added with correct year/semester
- [ ] All Subjects are added with `weeklyHours > 0` and a `Default Faculty` assigned
- [ ] Time Slots are created for every working day with a Lunch Break slot defined

---

## Navigation Overview

| Page | Path | Purpose |
|---|---|---|
| Dashboard | `/` | Overview, stats, setup checklist, pending requests |
| Departments | `/departments` | Manage academic departments |
| Classrooms | `/classrooms` | Manage physical rooms |
| Faculty | `/faculty` | Manage teaching staff |
| Sections | `/sections` | Manage class cohorts |
| Subjects | `/subjects` | Manage course catalogue |
| Time Slots | `/timeslots` | Manage weekly period structure |
| Timetable | `/timetable` | View, generate, and print schedules |
| Settings | `/settings` | Account, workspace, invites, requests |
