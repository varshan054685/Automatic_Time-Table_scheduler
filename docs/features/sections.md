# Sections

## Purpose

A section represents a class cohort — a specific group of students (e.g. `CS-A`, `ME-B`). Sections belong to a department, have a year and semester number, and optionally a default classroom. The scheduler generates one timetable per section.

## Where to find it

Sidebar → **Sections** (or navigate to `/sections`).

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| View list | ✅ | ✅ |
| Add | ✅ | ❌ |
| Edit | ✅ | Submits change request |
| Delete | ✅ | Submits change request |

## User Workflow

### Add a Section
1. Click **Add Section**.
2. Enter the section name (e.g. `CS-A`), year, semester, department, and optionally a default classroom.
3. Submit.

### Edit a Section
1. Click the edit icon on the section row/card.
2. Update and save. (Viewers: creates a change request.)

### Delete a Section
1. Click the delete icon, confirm in the browser dialog.

## Buttons & Actions

- **Add Section** → Opens create form/dialog.
- **Edit icon** → Opens edit form.
- **Trash icon** → `confirm()` → `DELETE /api/sections/:id`.

## Validation Rules

| Field | Rules |
|---|---|
| Name | Required, min 1, max 100 characters, trimmed |
| Year | Required, integer, min 1, max 10 |
| Semester | Required, integer, min 1, max 20 |
| Department | Required, valid department ID |
| Classroom | Optional, valid classroom ID or null |

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/sections` | Any member |
| POST | `/api/sections` | Owner |
| PATCH | `/api/sections/:id` | Owner (Viewer → change request) |
| DELETE | `/api/sections/:id` | Owner (Viewer → change request) |

## Database

| Table | Operation |
|---|---|
| `sections` | INSERT, SELECT, UPDATE, DELETE |

Schema: `id`, `workspaceId`, `name`, `year`, `semester`, `departmentId`, `classroomId` (nullable), `createdAt`.

## Success Flow

- Create: HTTP 201.
- Update: HTTP 200.
- Delete: HTTP 204.

## Failure Cases

| Scenario | Result |
|---|---|
| Missing required field | HTTP 400 |
| Year/semester out of range | HTTP 400 |
| Viewer tries to add | HTTP 403 |
| Viewer tries to edit/delete | HTTP 202 change request |
| Section ID not in workspace | HTTP 404 |

## Frequently Asked Questions

**Q: What is the difference between year and semester?**
A: Year represents the academic year of the cohort (1st year, 2nd year, etc.). Semester is the specific term within that year. The timetable generation can be filtered by semester.

**Q: Can I generate a timetable for just one semester?**
A: Yes. When triggering generation, you can optionally specify a `semester` value. Only sections matching that semester will be included.

**Q: What happens if I delete a section that already has a timetable?**
A: I couldn't determine the cascade behaviour from the current code. The `sections` table does not define explicit ON DELETE CASCADE for timetable rows in the schema definition. Timetable entries referencing that section may become orphaned.

## Related Features

- [Departments](./departments.md)
- [Classrooms](./classrooms.md)
- [Subjects](./subjects.md)
- [Timetable Generation](./timetable-generation.md)
