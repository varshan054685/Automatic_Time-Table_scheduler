# Faculty

## Purpose

Faculty records represent teaching staff. Each faculty member belongs to a department, has a unique code, and optionally an email. Faculty members are assigned to subjects, and the scheduler uses faculty assignments to enforce the constraint that no teacher is double-booked.

## Where to find it

Sidebar → **Faculty** (or navigate to `/faculty`).

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

### Add a Faculty Member
1. Click **Add Faculty** (top-right).
2. Enter Full Name, Faculty Code, select a Department, and optionally an Email.
3. Click **Add Faculty Member**.

### Edit a Faculty Member
1. Click the **pencil icon** on the faculty card.
2. Update the fields.
3. Click **Save Changes**. (Viewers: creates a change request.)

### Delete a Faculty Member
1. Click the **trash icon** on the faculty card.
2. Confirm in the browser dialog.

### Import from Excel
1. Click **Import**.
2. Select an `.xlsx` or `.xls` file.
3. The importer reads the following columns (flexible naming): `Faculty Name` / `Name`, `Faculty Code` / `Code`, `Email`, `Department`.
4. If a faculty member with the same code or email already exists, it is updated rather than duplicated.
5. A toast shows the count of new imports, updates, and failures.

### Export Template
1. Click **Export**.
2. A file named `faculty_template.xlsx` is downloaded.
3. If faculty records exist, the exported file contains real data. If not, a sample row is included.

### Search
- Type in the search bar to filter by name, code, or email. This is a real-time client-side filter.

## Buttons & Actions

- **Add Faculty** → Opens the add dialog.
- **Import** → Opens file picker for `.xlsx`/`.xls`.
- **Export** → Downloads `faculty_template.xlsx`.
- **Pencil icon** → Opens edit dialog pre-filled with the faculty data.
- **Trash icon** → `confirm()` → `DELETE /api/faculty/:id`.
- **Search input** → Client-side filter, no API call.

## Validation Rules

| Field | Rules |
|---|---|
| Name | Required, min 1, max 200 characters |
| Code | Required, min 1, max 50 characters |
| Department | Required, must be a valid department ID (positive integer) |
| Email | Optional, valid email format, max 255 characters |
| Availability | Optional, array of strings (I couldn't determine the exact format used by the scheduler from the UI — the field exists in the schema but has no dedicated input in the add/edit form) |

If no code is provided during creation via the API, the server auto-generates one as `FAC{timestamp}`.

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/faculty` | Any member |
| POST | `/api/faculty` | Owner |
| PATCH | `/api/faculty/:id` | Owner (Viewer → change request) |
| DELETE | `/api/faculty/:id` | Owner (Viewer → change request) |

## Database

| Table | Operation |
|---|---|
| `faculty` | INSERT, SELECT, UPDATE, DELETE |

The `faculty` table stores: `id`, `workspaceId`, `name`, `code`, `departmentId`, `email`, `availability` (JSONB array of strings), `createdAt`.

## Success Flow

- Create: HTTP 201, faculty object returned, list re-fetched.
- Update: HTTP 200, updated object returned.
- Delete: HTTP 204.
- Import: Each row is processed sequentially. A summary toast is shown after all rows.

## Failure Cases

| Scenario | Result |
|---|---|
| Missing required field | HTTP 400 |
| Invalid department ID | HTTP 400 |
| Viewer tries to add | HTTP 403 |
| Viewer tries to edit/delete | HTTP 202 change request |
| Faculty ID not in workspace | HTTP 404 |
| Excel file with unmatched department | Row skipped with error logged in toast |

## Frequently Asked Questions

**Q: What is the "Availability" field?**
A: The `availability` column exists in the database as a JSONB array of strings. However, there is no UI input for it in the Add/Edit Faculty form — it defaults to an empty array. The scheduler reads this field from the data payload but the exact format expected (e.g. `["Monday", "Tuesday"]`) is not enforced through the current UI.

**Q: What happens to subjects if I delete a faculty member?**
A: The subject's `facultyId` will become an orphaned reference. The timetable generator skips subjects with no assigned faculty (`if fac_id is None: continue`). It is recommended to reassign subjects before deleting a faculty member.

**Q: My Excel import skipped rows. Why?**
A: The most common reason is that the `Department` column value did not match any department name or code in your workspace (case-insensitive). Check the toast message for row-level error details.

## Related Features

- [Departments](./departments.md)
- [Subjects](./subjects.md)
- [Timetable Generation](./timetable-generation.md)
- [Change Requests](./change-requests.md)
