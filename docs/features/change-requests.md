# Change Requests

## Purpose

The change request system allows **Viewer** role members to propose edits and deletions to master data (departments, classrooms, subjects, faculty, sections, time slots) without directly modifying the data. The Owner reviews and either approves (applying the change) or rejects the request.

## Where to find it

- **Owner**: `Settings → Requests` tab. Pending requests also appear on the Dashboard in the "Recent Activity" widget.
- **Viewer**: `Settings → Requests` tab shows the status of their submitted requests.
- **Polling**: The `Settings → Requests` section and the Dashboard both auto-refresh every 5 seconds to show new requests.

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| View all requests | ✅ | ✅ (own requests implied — all are visible) |
| Approve a request | ✅ | ❌ |
| Reject a request | ✅ | ❌ |
| Submit a request | Submits directly (no queue) | Automatically on edit/delete attempt |

## User Workflow

### How a Viewer Submits a Change Request
1. The Viewer navigates to any master data page (e.g. Departments, Faculty).
2. They click the edit or delete icon on a record.
3. Instead of a form being submitted to the database directly, the server intercepts the request.
4. A change request record is created with `status: "pending"`.
5. The Viewer sees HTTP 202 and the UI shows "Request sent to admin."
6. The Viewer can check `Settings → Requests` to track the status.

### How an Owner Reviews Requests
1. Go to `Settings → Requests`.
2. The list shows all pending, approved, and rejected requests.
3. Use the filter buttons (All / Pending / Approved / Rejected) to narrow the view.
4. For each pending request, two buttons appear: **Approve** and **Reject**.
5. Click **Approve** to apply the change immediately. The underlying data record is updated or deleted.
6. Click **Reject** to decline. The data is unchanged.

### Dashboard Quick Access
- Pending requests appear in the "Recent Activity" widget on the Dashboard.
- Clicking a request row navigates directly to `Settings?tab=requests`.

## Request Types

| Type | What it means |
|---|---|
| `edit` | The viewer wanted to update fields on a record. The `data` field stores `{ table, id, changes: {...} }` |
| `delete` | The viewer wanted to delete a record. The `data` field stores `{ table, id }` |

## Supported Tables

Change requests can target: `departments`, `classrooms`, `subjects`, `faculty`, `sections`, `timeSlots`.

## Buttons & Actions

- **Approve** → `POST /api/change-requests/:id/approve`
- **Reject** → `POST /api/change-requests/:id/reject`
- **Filter buttons** (All/Pending/Approved/Rejected) → Client-side filter, no API call.
- **Request row on Dashboard** → Navigates to `/settings?tab=requests`.

## API

| Method | Path | Role |
|---|---|---|
| GET | `/api/change-requests` | Any member |
| POST | `/api/change-requests/:id/approve` | Owner |
| POST | `/api/change-requests/:id/reject` | Owner |

Change requests are created **implicitly** by the `viewerCheck` middleware on any PATCH or DELETE to a scoped resource endpoint — there is no direct "create change request" endpoint.

## Database

| Table | Operation |
|---|---|
| `change_requests` | INSERT (viewerCheck), SELECT (list), UPDATE (status on approve/reject) |
| Target table (e.g. `departments`) | UPDATE or DELETE on approve |

Schema: `id`, `workspaceId`, `requestedBy`, `type` (`edit` or `delete`), `data` (JSONB), `status` (`pending`, `approved`, `rejected`), `createdAt`.

## Success Flow

- Approve: The change is applied to the target table, request status set to `approved`. Query cache for the affected resource is invalidated.
- Reject: Request status set to `rejected`. No data is changed.
- Both return HTTP 200 with a success message.

## Failure Cases

| Scenario | Result |
|---|---|
| Request ID not found | HTTP 404 "Change request not found" |
| Request belongs to different workspace | HTTP 403 "Not your workspace" |
| Request already processed (not pending) | HTTP 400 "Request already processed" |
| Viewer tries to approve/reject | HTTP 403 |
| Target table not in supported list | Change silently not applied (no error thrown) |

## Frequently Asked Questions

**Q: Can a Viewer see other Viewers' change requests?**
A: The GET endpoint returns all change requests for the workspace without filtering by `requestedBy`. So technically all members can see all requests. The UI does not filter by requester.

**Q: Can a Viewer submit a change request for creating new records?**
A: No. The `viewerCheck` middleware only applies to PATCH and DELETE endpoints. POST (create) endpoints use `requireOwner` directly — Viewers get a 403 with no change request fallback.

**Q: What happens if the same record is edited again before the request is approved?**
A: A new change request is created. If the first is then approved and the second is also approved, the second approval overwrites the first.

**Q: Is there a notification system for new requests?**
A: No push notifications. The Owner must check `Settings → Requests` or the Dashboard, both of which poll every 5 seconds automatically.

## Related Features

- [Roles & Permissions](./roles-and-permissions.md)
- [Departments](./departments.md)
- [Faculty](./faculty.md)
- [Settings](./settings.md)
