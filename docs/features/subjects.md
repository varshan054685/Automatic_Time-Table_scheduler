# Subjects

## Purpose

Subjects represent the courses to be scheduled. Each subject has a code, name, weekly hour count, a parent department, an optional default faculty, an optional target section, and a type (lecture or lab). The scheduler uses subjects to know how many periods to assign per section per week, and which faculty member teaches each subject.

## Where to find it

Sidebar → **Subjects** (or navigate to `/subjects`).

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| View list | ✅ | ✅ |
| Add | ✅ | ❌ |
| Edit | ✅ | Submits change request |
| Delete | ✅ | Submits change request |
| Import Excel | ✅ | ❌ |
| Export Excel template | ✅ | ✅ |

## User Workflow

### Add a Subject
1. Click **Add Subject**.
2. Fill in: Subject Name, Subject Code, Weekly Hours, Learning Mode (Lecture or Lab), Parent Department.
3. Optionally assign a Default Faculty and a Target Section.
4. Click **Add Subject**.

### Edit a Subject
1. Click the **pencil icon** on the subject's row.
2. Modify the fields.
3. Click **Save Changes**. (Viewers: creates a change request.)

### Delete a Subject
1. Click the **trash icon**.
2. Confirm the browser dialog.

### Import from Excel
1. Click **Import Dataset**.
2. Select an `.xlsx` / `.xls` file.
3. The importer reads: `Subject Name`, `Subject Code`, `Weekly Hours`, `Department`, `Default Faculty`, `Target Section`, `Subject Type`.
4. Column names are matched flexibly (case-insensitive, ignoring punctuation and spaces).
5. If a subject with the same code already exists, it is updated.
6. Faculty name mismatches: if a fuzzy match is found but the name differs, the faculty record's name is overwritten to match the spreadsheet.
7. A toast summarises created, updated, and failed rows.

### Export Template
1. Click **Export**.
2. Downloads `subjects_template.xlsx` with current data (or a sample row if no subjects exist).

### Search & Sort
- The search bar filters by subject name or code in real time (client-side).
- Clicking column headers sorts the table client-side.

## Buttons & Actions

- **Add Subject** → Opens subject dialog.
- **Import Dataset** → Opens file picker.
- **Export** → Downloads the Excel template.
- **Pencil icon** → Opens pre-filled edit dialog.
- **Trash icon** → `confirm()` → `DELETE /api/subjects/:id`.
- **Search input** → Client-side filter.
- **Column header** → Client-side sort toggle (asc/desc).

## Validation Rules

| Field | Rules |
|---|---|
| Name | Required, min 1, max 200 characters |
| Code | Required, min 1, max 50 characters |
| Weekly Hours | Required, integer, min 1, max 50 |
| Department | Required, valid department ID |
| Faculty | Optional, valid faculty ID or null/0 |
| Section | Optional, valid section ID or null/0 |
| Type | Optional, `"lecture"` or `"lab"`. Defaults to `"lecture"` |

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/subjects` | Any member |
| POST | `/api/subjects` | Owner |
| PATCH | `/api/subjects/:id` | Owner (Viewer → change request) |
| DELETE | `/api/subjects/:id` | Owner (Viewer → change request) |

## Database

| Table | Operation |
|---|---|
| `subjects` | INSERT, SELECT, UPDATE, DELETE |

Schema: `id`, `workspaceId`, `code`, `name`, `weeklyHours`, `departmentId`, `facultyId` (nullable), `sectionId` (nullable), `type`, `createdAt`.

## Success Flow

- Create: HTTP 201, subject object returned, list cache invalidated.
- Update: HTTP 200.
- Delete: HTTP 204.
- Import: Each row processed, summary toast shown.

## Failure Cases

| Scenario | Result |
|---|---|
| Missing name, code, or weeklyHours | HTTP 400 |
| weeklyHours < 1 or > 50 | HTTP 400 |
| Viewer tries to add | HTTP 403 |
| Viewer tries to edit/delete | HTTP 202 change request |
| Subject ID not in workspace | HTTP 404 |
| Excel row with unmatched department | Row skipped, error in toast |
| Weekly Hours is 0 in Excel | Defaults to 4 |

## Frequently Asked Questions

**Q: What does "Default Faculty" mean?**
A: It pre-assigns a faculty member to this subject. During timetable generation, the scheduler uses this `facultyId` to schedule the subject. If no faculty is assigned, the subject is skipped during generation.

**Q: What does "Target Section" mean?**
A: It restricts the subject to a specific section. The scheduler only places the subject in the timetable for that section. If left blank, the subject may be available to all sections in the department (I couldn't fully determine the exact matching logic for unassigned sections from the scheduler code).

**Q: What happens to lab subjects during scheduling?**
A: Lab subjects are scheduled as contiguous blocks of 2 or 3 periods. Blocks must be entirely within the morning session or entirely within the afternoon session — they cannot straddle the lunch break. Lab blocks must start at the first period of a session.

**Q: Can I import subjects without a faculty assigned?**
A: Yes. If no match is found for the `Default Faculty` column, `facultyId` is set to null. The scheduler will skip subjects with no faculty.

## Related Features

- [Faculty](./faculty.md)
- [Sections](./sections.md)
- [Departments](./departments.md)
- [Timetable Generation](./timetable-generation.md)
