# Roles & Permissions

## Purpose

Controls what each user can do within a workspace. There are two roles: **Owner** (full access) and **Viewer** (read-only, can submit change requests). The role is assigned when joining a workspace and cannot be changed after joining.

## Where to find it

Your role is displayed at `Settings → Workspace → Membership → Your Role`.

## Who can use it

All authenticated workspace members.

## User Workflow

Roles are assigned automatically:
- The user who **creates** a workspace gets the **Owner** role.
- A user who joins with the **Admin invite code** gets the **Owner** role.
- A user who joins with the **Observer invite code** gets the **Viewer** role.

There is no UI to promote or demote existing members after they have joined.

## Permissions Matrix

| Action | Owner | Viewer |
|---|---|---|
| View all data (departments, faculty, etc.) | ✅ | ✅ |
| Create departments, classrooms, faculty, sections, subjects, time slots | ✅ | ❌ |
| Edit / delete any of the above directly | ✅ | ❌ (submit change request instead) |
| Generate timetable | ✅ | ❌ |
| Regenerate all timetables | ✅ | ❌ |
| View timetable | ✅ | ✅ |
| Print timetable | ✅ | ✅ |
| Export Excel templates | ✅ | ✅ |
| Import Excel data | ✅ | ❌ |
| View change requests | ✅ | ✅ (own requests only in UI) |
| Approve / reject change requests | ✅ | ❌ |
| Manage workspace name / academic year | ✅ | ❌ |
| Regenerate invite codes | ✅ | ❌ |
| Remove workspace members | ✅ | ❌ |
| Delete workspace | ✅ | ❌ |
| Leave workspace | ❌ | ✅ |

## How Viewer Write Attempts Are Handled

When a **Viewer** attempts to edit or delete a resource (PATCH or DELETE on departments, classrooms, subjects, faculty, sections, or time slots), the server does **not** return a 403. Instead, it:

1. Intercepts the request via the `viewerCheck` middleware.
2. Creates a `change_request` record in the database with `status: "pending"`.
3. Returns HTTP 202 with the message `"Request sent to admin"`.
4. The Owner sees the pending request in `Settings → Requests` (also shown on the Dashboard).

This means Viewers do not directly modify data — their changes are queued for approval.

## API Enforcement

The server uses two middleware functions:

- `requireWorkspace` — attached to every protected route. Verifies the session, looks up `workspace_members`, and injects `workspaceId`, `workspaceRole`, and `wsUserId` into the request object.
- `requireOwner` — used on mutation routes (create, generate, approve/reject, workspace management). Returns HTTP 403 if role is not `owner`.

Resource isolation is also enforced via `requireResourceOwnership`, which verifies that the requested resource ID belongs to the authenticated user's workspace before allowing the operation to proceed. This prevents IDOR (Insecure Direct Object Reference) attacks.

## Database

| Table | Relevant Columns |
|---|---|
| `workspace_members` | `role` — `'owner'` or `'viewer'` |
| `change_requests` | `status` — `'pending'`, `'approved'`, `'rejected'` |

## Failure Cases

| Scenario | HTTP | Message |
|---|---|---|
| Not authenticated | 401 | (empty) |
| No workspace membership | 403 | "No workspace found. Create or join a workspace first." |
| Viewer attempts owner-only action (create, generate) | 403 | "Only workspace owners can perform this action." |
| Accessing resource belonging to a different workspace | 404 | "{Resource} not found" |

## Frequently Asked Questions

**Q: Can I change someone's role after they've joined?**
A: No. There is no UI or API endpoint to update a member's role. The only option is to remove them and have them re-join with a different code.

**Q: Can a Viewer see all data?**
A: Yes. All GET endpoints only require workspace membership, not the owner role. Viewers can browse all departments, faculty, subjects, sections, timetables, etc.

**Q: What happens to a Viewer's change request if the owner rejects it?**
A: The request is marked `rejected`. The original data is unchanged. The Viewer can see the rejected status in `Settings → Requests`.

**Q: Is there an "Admin" role separate from "Owner"?**
A: No. The code uses `owner` as the internal role name. The UI labels it "Admin" in some places (invite codes, member cards) and "Owner" in others. They refer to the same role.

## Related Features

- [Workspaces](./workspaces.md)
- [Change Requests](./change-requests.md)
- [Settings](./settings.md)
