# Time Slots

## Purpose

Time slots define the weekly period structure — the days, start times, end times, and labels (e.g. "Period 1", "Break", "Lunch") that the scheduler works with. You must create time slots for every day you want to include in the timetable. Slots with "Break" or "Lunch" in the label are treated as non-teaching slots by the scheduler.

## Where to find it

Sidebar → **Time Slots** (or navigate to `/timeslots`).

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| View list | ✅ | ✅ |
| Add | ✅ | ❌ |
| Edit | ✅ | Submits change request |
| Delete | ✅ | Submits change request |

## User Workflow

### Add a Time Slot
1. Click **Add Time Slot**.
2. Select a Day of Week, enter a Start Time (HH:MM), End Time (HH:MM), and a Label.
3. Submit.

To build a full week, repeat for each period on each day. For example, to have Monday with 6 periods, create 6 slots all with `dayOfWeek: "Monday"` and different start/end times and labels.

### Add a Break or Lunch
Create a time slot with a label containing the word "Break" or "Lunch" (e.g. "Morning Break", "Lunch Break"). The scheduler automatically identifies these as non-teaching periods.

### Edit a Time Slot
1. Click the edit icon on the slot row.
2. Update and save.

### Delete a Time Slot
1. Click the trash icon, confirm.

## Buttons & Actions

- **Add Time Slot** → Opens create dialog.
- **Edit icon** → Opens edit form.
- **Trash icon** → `confirm()` → `DELETE /api/timeslots/:id`.

## Validation Rules

| Field | Rules |
|---|---|
| Day of Week | Required, one of: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` |
| Start Time | Required, must match `HH:MM` format (24-hour) |
| End Time | Required, must match `HH:MM` format (24-hour) |
| Label | Required, min 1, max 100 characters, trimmed |

The server does not validate that end time is after start time — that is the user's responsibility. The scheduler sorts periods by `startTime` to determine order.

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/timeslots` | Any member |
| POST | `/api/timeslots` | Owner |
| PATCH | `/api/timeslots/:id` | Owner (Viewer → change request) |
| DELETE | `/api/timeslots/:id` | Owner (Viewer → change request) |

## Database

| Table | Operation |
|---|---|
| `time_slots` | INSERT, SELECT, UPDATE, DELETE |

Schema: `id`, `workspaceId`, `dayOfWeek`, `startTime`, `endTime`, `label`. Note: this table has no `createdAt` column.

## Success Flow

- Create: HTTP 201.
- Update: HTTP 200.
- Delete: HTTP 204.

## Failure Cases

| Scenario | Result |
|---|---|
| Invalid day name | HTTP 400 |
| Time not in HH:MM format | HTTP 400 "Must be HH:MM format" |
| Missing label | HTTP 400 |
| Viewer tries to add | HTTP 403 |
| Viewer tries to edit/delete | HTTP 202 change request |
| Slot ID not in workspace | HTTP 404 |

## Frequently Asked Questions

**Q: Do I need to create time slots for every day individually?**
A: Yes. Each time slot record is tied to a specific day. If you want the same 6 periods on Monday through Friday, you need to create 30 separate records (6 × 5 days).

**Q: How does the scheduler know what constitutes "morning" vs "afternoon"?**
A: The scheduler looks for slots with "Lunch" in the label and uses the lunch start time as the dividing line. Slots before the lunch start time are "morning"; slots after are "afternoon". If no lunch slot exists, it splits periods at the midpoint.

**Q: Can I use Saturday or Sunday?**
A: Yes. The day validator accepts all seven days. If you create slots for Saturday, they will appear as active days in the timetable grid.

**Q: What is the difference between "Break" and "Lunch" label-wise?**
A: Both are treated as non-teaching slots — the scheduler skips them when assigning subjects. "Lunch" additionally serves as the morning/afternoon boundary. "Break" is treated as a mid-session break but does not split morning/afternoon.

## Related Features

- [Timetable Generation](./timetable-generation.md)
- [Timetable Grid](./timetable-generation.md)
