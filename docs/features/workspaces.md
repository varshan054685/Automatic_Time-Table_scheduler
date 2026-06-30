# Workspaces

## Purpose

A workspace is the top-level container for all scheduling data (departments, faculty, sections, subjects, classrooms, time slots, timetables). Every user must belong to exactly one workspace. A user who creates a workspace becomes its **Owner**. Others join via invite codes with either an **Admin (Owner)** or **Viewer** role.

## Where to find it

- **Create / Join prompt**: Shown automatically after login if the user has no workspace membership.
- **Workspace settings**: `Settings → Workspace` tab.
- **Invite management**: `Settings → Referrals & Invites` tab.
- **Danger zone**: `Settings → Advanced Settings` (collapsible section).

## Who can use it

| Action | Owner | Viewer |
|---|---|---|
| Create workspace | ✅ (before joining any) | ✅ (before joining any) |
| Join workspace | ✅ | ✅ |
| View workspace info | ✅ | ✅ |
| Edit name / academic year | ✅ | ❌ |
| Regenerate invite codes | ✅ | ❌ |
| Remove members | ✅ | ❌ |
| Delete workspace | ✅ | ❌ |
| Leave workspace | ❌ (must delete instead) | ✅ |

## User Workflow

### Create a Workspace
1. After registering and logging in, if you have no workspace, a setup prompt appears.
2. Enter a workspace name and click **Create Workspace**.
3. You are automatically assigned the **Owner** role.

### Join a Workspace
1. Obtain an invite code from the workspace owner (either the Admin code or the Viewer/Observer code).
2. On the join prompt, enter the code and click **Join Workspace**.
3. Your role is determined by which code you used.

### Edit Workspace Details
1. Go to `Settings → Workspace`.
2. Click **Edit** (only visible to Owners).
3. Update the workspace name and/or academic year.
4. Click **Save Changes**.

### Invite Team Members
1. Go to `Settings → Referrals & Invites`.
2. Copy the **Observer Invite Link** (viewer) or **Admin Invite Link** (admin/owner) and share it.
3. The recipient uses the code on the join screen.

### Remove a Member
1. Go to `Settings → Referrals & Invites → Workspace Members`.
2. Hover over a member card — a remove button (user-minus icon) appears.
3. Click it, confirm in the dialog.

### Regenerate an Invite Code
1. Go to `Settings → Referrals & Invites`.
2. Click **Regenerate Code** under either the Observer or Admin invite card.
3. The old code is immediately invalidated. Share the new code.

### Delete Workspace
1. Go to `Settings → Advanced Settings`. Click to expand.
2. Type the exact workspace name in the confirmation input.
3. Click **Delete Workspace**. All associated data is permanently deleted.

### Leave Workspace
1. Non-owner members go to `Settings → Advanced Settings`.
2. Click **Leave Workspace** and confirm.

## Buttons & Actions

- **Create Workspace** → `POST /api/workspaces`
- **Join Workspace** → `POST /api/workspaces/join`
- **Edit** (toggle) → No API call, just reveals the inline form.
- **Save Changes** → `PATCH /api/workspaces/current`
- **Copy** (invite code) → Copies code to clipboard, no API call.
- **Regenerate Code** → `POST /api/workspaces/regenerate-code` with `{ type: "admin" | "viewer" }`
- **Remove Member** → `DELETE /api/workspaces/members/:id`
- **Delete Workspace** → `DELETE /api/workspaces/current`
- **Leave Workspace** → `POST /api/workspaces/leave`

## Validation Rules

- Workspace name: min 1, max 200 characters, trimmed.
- Academic year: max 50 characters, trimmed (free text, e.g. `2024-2025`).
- You can only belong to **one workspace** at a time.
- Owners cannot leave — they must delete the workspace.
- Owners cannot remove themselves via the member list.
- Confirm-name input for delete must match the workspace name exactly (case-sensitive, trimmed).

## API

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/workspaces` | Required | Any (no workspace yet) |
| POST | `/api/workspaces/join` | Required | Any (no workspace yet) |
| GET | `/api/workspaces/current` | Required | Any member |
| PATCH | `/api/workspaces/current` | Required | Owner |
| POST | `/api/workspaces/regenerate-code` | Required | Owner |
| DELETE | `/api/workspaces/current` | Required | Owner |
| POST | `/api/workspaces/leave` | Required | Viewer |
| DELETE | `/api/workspaces/members/:id` | Required | Owner |

## Database

| Table | Operation |
|---|---|
| `workspaces` | INSERT (create), SELECT (read), UPDATE (edit name/year), DELETE (delete) |
| `workspace_members` | INSERT (create/join), SELECT (list), DELETE (leave/remove) |

The `workspaces` table has two invite code columns: `referralCode` (viewer) and `adminReferralCode` (owner/admin).

## Success Flow

- Create: Workspace row inserted, membership row inserted with role=`owner`. User's session is refreshed.
- Join: Workspace looked up by code, role determined from which code was used, membership row inserted.
- Edit: Workspace row updated, query cache invalidated for `GET /api/user` and `GET /api/workspaces/current`.
- Regenerate code: New random code written, old code no longer valid.
- Delete: All cascaded data deleted. User session still valid but workspace membership is gone, prompting workspace setup again.

## Failure Cases

| Scenario | Error |
|---|---|
| User already in a workspace tries to create/join | "You already belong to a workspace" |
| Invalid invite code | "Invalid referral code" |
| Viewer tries owner-only action | HTTP 403 "Only workspace owners can perform this action." |
| Owner tries to leave | "Owners cannot leave the workspace, they must delete it." |
| Confirm name mismatch on delete | Delete button remains disabled |

## Frequently Asked Questions

**Q: Can I be in two workspaces at once?**
A: No. Each user belongs to exactly one workspace. To switch, you must leave or the owner must delete the current workspace.

**Q: What happens to all data when a workspace is deleted?**
A: All records scoped to that workspace — departments, faculty, classrooms, sections, subjects, time slots, timetables, generation jobs, and change requests — are permanently deleted. This cannot be undone.

**Q: What's the difference between the Admin and Observer invite codes?**
A: Admin code grants the `owner` role (full write access). Observer code grants the `viewer` role (read-only, must submit change requests for edits).

**Q: I shared the wrong code. How do I revoke it?**
A: Click **Regenerate Code** for that code type. The old code stops working immediately.

## Related Features

- [Roles & Permissions](./roles-and-permissions.md)
- [Change Requests](./change-requests.md)
- [Settings](./settings.md)
