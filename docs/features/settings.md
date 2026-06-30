# Settings

## Purpose

The Settings page consolidates all account, workspace, invitation, change request, and danger zone management into one tabbed interface.

## Where to find it

Sidebar → **Settings** (or navigate to `/settings`). Each tab is accessible via URL: `/settings?tab=profile`, `/settings?tab=workspace`, `/settings?tab=referrals`, `/settings?tab=requests`, `/settings?tab=danger`.

## Who can use it

All authenticated members with a workspace. Some tabs and actions are owner-only.

## Tabs Overview

### Profile Tab (`?tab=profile`)
- Displays the user's name, email, avatar initial, and role.
- **Edit Profile**: Owners and Viewers can both update their own name and email.
  - Click **Edit Profile**, update fields, click **Save Changes**.
  - Calls `PATCH /api/auth/profile`.
  - If the new email is already in use by another account, an error is returned.

### Workspace Tab (`?tab=workspace`)
- Shows workspace name, academic year, workspace ID (copyable), creation date, role badge.
- **Workspace Analytics**: Live counts of departments, faculty, subjects, sections, classrooms.
- **Workspace Health**: A 0–100 score based on whether faculty, subjects, classrooms, and time slots exist.
- **Edit** (Owner only): Update workspace name and academic year.
  - Click **Edit**, update fields, click **Save Changes**.
  - Calls `PATCH /api/workspaces/current`.

### Referrals & Invites Tab (`?tab=referrals`)
- **Observer Invite Link**: The viewer-role invite code. Members joining with this get read-only access.
- **Admin Invite Link**: The owner-role invite code. Members joining with this get full access.
- **Copy**: Copies the code to clipboard.
- **Regenerate Code** (Owner only): Generates a new random code. Old code immediately invalid.
- **Workspace Members**: Card grid of all current members showing name, email, role badge.
- **Remove Member** (Owner only): Hover over a non-self member card → remove button → confirmation dialog.

### Requests Tab (`?tab=requests`)
- Stats row: Pending / Approved / Rejected counts.
- Filterable request inbox (All / Pending / Approved / Rejected).
- Requests are sorted by status (pending first), then by date.
- Owner sees **Approve** and **Reject** buttons on pending requests.
- Edit requests show the proposed changes in a monospace preview.
- Auto-refreshes every 5 seconds.

### Advanced Settings Tab (`?tab=danger`)
- Collapsed by default — click the section to expand.
- **Owner**: Can delete the workspace. Must type the exact workspace name to enable the delete button.
- **Viewer**: Can leave the workspace.

## Buttons & Actions (Summary)

| Button | API Call | Who |
|---|---|---|
| Save Changes (profile) | `PATCH /api/auth/profile` | All |
| Save Changes (workspace) | `PATCH /api/workspaces/current` | Owner |
| Copy (invite code) | No API — clipboard | All |
| Regenerate Code (observer) | `POST /api/workspaces/regenerate-code { type: "viewer" }` | Owner |
| Regenerate Code (admin) | `POST /api/workspaces/regenerate-code { type: "admin" }` | Owner |
| Remove Member | `DELETE /api/workspaces/members/:id` | Owner |
| Approve request | `POST /api/change-requests/:id/approve` | Owner |
| Reject request | `POST /api/change-requests/:id/reject` | Owner |
| Delete Workspace | `DELETE /api/workspaces/current` | Owner |
| Leave Workspace | `POST /api/workspaces/leave` | Viewer |

## Validation Rules

- Profile name: min 1, max 100 characters.
- Profile email: valid email format.
- Workspace name: min 1, max 200 characters.
- Academic year: max 50 characters.
- Delete workspace confirmation: must exactly match the workspace name (trimmed).

## API

See individual feature docs:
- [Authentication](./authentication.md) for profile updates.
- [Workspaces](./workspaces.md) for workspace management.
- [Change Requests](./change-requests.md) for request management.

## Database

| Table | Operations |
|---|---|
| `users` | UPDATE (profile) |
| `workspaces` | SELECT, UPDATE (workspace tab) |
| `workspace_members` | SELECT (members list), DELETE (remove member) |
| `change_requests` | SELECT, UPDATE (approve/reject) |

## Success Flow

- Profile update: Toast "Profile updated", query cache for `/api/user` invalidated.
- Workspace update: Toast "Workspace updated successfully", caches for `/api/user` and `/api/workspaces/current` invalidated.
- Code regeneration: Toast "Invite link updated", workspace query cache invalidated.
- Member removal: Toast "Member removed", workspace query cache invalidated.
- Request approval: Toast "Request approved", change request list cache invalidated.
- Request rejection: Toast "Request rejected".
- Workspace deletion: Toast "Workspace deleted successfully", `/api/user` cache invalidated (user now has no workspace).
- Workspace leave: Toast "You have left the workspace", `/api/user` cache invalidated.

## Failure Cases

| Scenario | Result |
|---|---|
| Email already in use by another account | HTTP 400 "Email already in use" |
| Viewer tries to edit workspace | Edit button not rendered (hidden from Viewers) |
| Owner tries to leave | HTTP 400 "Owners cannot leave" |
| Delete confirm name mismatch | Delete button disabled |

## Related Features

- [Authentication](./authentication.md)
- [Workspaces](./workspaces.md)
- [Roles & Permissions](./roles-and-permissions.md)
- [Change Requests](./change-requests.md)
