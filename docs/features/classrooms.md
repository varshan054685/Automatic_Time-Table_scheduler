# Classrooms

## Purpose

Classrooms define the physical rooms available for scheduling. Each room has a number/identifier, a seating capacity, and a type (lecture or lab). The scheduler assigns rooms to class periods, and the hard constraint ensures no two classes are assigned the same room at the same time.

## Where to find it

Sidebar → **Classrooms** (or navigate to `/classrooms`).

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| View list | ✅ | ✅ |
| Add | ✅ | ❌ |
| Edit | ✅ | Submits change request |
| Delete | ✅ | Submits change request |

## User Workflow

### Add a Classroom
1. Click **Add Classroom**.
2. Enter the room number (e.g. `LH-101`), seating capacity, and select the type (Lecture or Lab).
3. Submit the form.

### Edit a Classroom
1. Click the edit/pencil icon on the classroom card or row.
2. Update fields and save. (Viewers: creates a change request.)

### Delete a Classroom
1. Click the delete/trash icon.
2. Confirm in the browser dialog.

## Buttons & Actions

- **Add Classroom** → Opens the create dialog/form.
- **Edit icon** → Opens edit form pre-filled.
- **Trash icon** → `confirm()` → `DELETE /api/classrooms/:id`.

## Validation Rules

| Field | Rules |
|---|---|
| Room Number | Required, min 1, max 100 characters, trimmed |
| Capacity | Required, integer, min 1, max 10,000 |
| Type | Optional, one of `"lecture"` or `"lab"`. Defaults to `"lecture"` |

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/classrooms` | Any member |
| POST | `/api/classrooms` | Owner |
| PATCH | `/api/classrooms/:id` | Owner (Viewer → change request) |
| DELETE | `/api/classrooms/:id` | Owner (Viewer → change request) |

## Database

| Table | Operation |
|---|---|
| `classrooms` | INSERT, SELECT, UPDATE, DELETE |

Schema: `id`, `workspaceId`, `roomNumber`, `capacity`, `type` (default `"lecture"`), `createdAt`.

## Success Flow

- Create: HTTP 201, classroom object returned.
- Update: HTTP 200, updated classroom returned.
- Delete: HTTP 204.

## Failure Cases

| Scenario | Result |
|---|---|
| Missing room number | HTTP 400 |
| Capacity not an integer | HTTP 400 |
| Capacity out of range (0 or >10000) | HTTP 400 |
| Viewer tries to add | HTTP 403 |
| Viewer tries to edit/delete | HTTP 202 change request |
| Classroom ID not in workspace | HTTP 404 |

## Frequently Asked Questions

**Q: Does the scheduler match classrooms to subjects by type?**
A: The scheduler does not filter by room type when assigning rooms — it assigns any available room to any class period. Room type is metadata for your reference only.

**Q: What is the minimum number of classrooms needed to generate a timetable?**
A: At least one classroom must exist. The scheduler will fail with "No classrooms available" if the list is empty.

**Q: Can two sections share the same classroom at the same time?**
A: No. The scheduler enforces a hard constraint (`AddAtMostOne`) that prevents any room from being assigned to two different classes in the same time slot.

## Related Features

- [Sections](./sections.md)
- [Timetable Generation](./timetable-generation.md)
- [Change Requests](./change-requests.md)
