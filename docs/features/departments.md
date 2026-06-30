# Departments

## Purpose

Departments are the top-level academic organisational units (e.g. "Computer Science", "Mechanical Engineering"). All other master data — faculty, sections, subjects — must belong to a department.

## Where to find it

Sidebar → **Departments** (or navigate to `/departments`).

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| View list | ✅ | ✅ |
| Add | ✅ | ❌ |
| Edit | ✅ | Submits change request |
| Delete | ✅ | Submits change request |

## User Workflow

### Add a Department
1. Click **Add Department** (top-right button, visible to owners).
2. Enter the department name and a short code.
3. Click **Save** / submit.
4. The new department appears in the list.

### Edit a Department
1. Find the department in the list.
2. Click the **pencil (edit)** icon on its row/card.
3. Update the name or code in the form.
4. Submit. (Viewers: this creates a change request instead of saving directly.)

### Delete a Department
1. Click the **trash** icon on the department row/card.
2. Confirm the browser confirmation dialog.
3. The department is removed. (Viewers: creates a delete change request.)

## Buttons & Actions

- **Add Department** → Opens a dialog form.
- **Edit (pencil icon)** → Inline edit form or dialog.
- **Delete (trash icon)** → Browser `confirm()` dialog → `DELETE /api/departments/:id`.
- **Search input** → Client-side filter, no API call.
- **Sort** → Client-side sort, no API call.

## Validation Rules

| Field | Rules |
|---|---|
| Name | Required, min 1, max 200 characters, trimmed |
| Code | Required, min 1, max 50 characters, trimmed |

Both fields are required. The server applies `.strict()` to the Zod schema, so no extra fields are accepted.

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/departments` | Any member |
| POST | `/api/departments` | Owner |
| PATCH | `/api/departments/:id` | Owner (Viewer → change request) |
| DELETE | `/api/departments/:id` | Owner (Viewer → change request) |

## Database

| Table | Operation |
|---|---|
| `departments` | INSERT, SELECT, UPDATE, DELETE |

The `workspaceId` is injected server-side from the authenticated session — it is never sent from the client.

## Success Flow

- Create: HTTP 201, new department object returned, list query cache invalidated.
- Update: HTTP 200, updated object returned.
- Delete: HTTP 204 (no content).

## Failure Cases

| Scenario | Result |
|---|---|
| Missing name or code | HTTP 400 "Invalid input: ..." |
| Viewer tries to add | HTTP 403 "Only workspace owners can perform this action." |
| Viewer tries to edit/delete | HTTP 202 "Request sent to admin" — change request created |
| Department ID not in this workspace | HTTP 404 "Department not found" |

## Frequently Asked Questions

**Q: Can I delete a department that has faculty or sections linked to it?**
A: The UI allows it and the API performs the delete. Cascading behaviour depends on the database — foreign key enforcement is not confirmed from the code. Deleting a department with linked data may cause orphaned records. It is safest to remove all linked faculty, sections, and subjects first.

**Q: Can two departments have the same code?**
A: The server does not enforce uniqueness on the code at the API level. It is the user's responsibility to keep codes unique within their workspace.

## Related Features

- [Faculty](./faculty.md)
- [Sections](./sections.md)
- [Subjects](./subjects.md)
- [Timetable Generation](./timetable-generation.md)
