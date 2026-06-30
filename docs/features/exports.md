# Timetable Grid & Exports

## Purpose

Displays the generated timetable as an interactive weekly grid, supports filtering by department, section, or faculty, and allows printing to PDF or paper in a formatted institutional document layout.

## Where to find it

Sidebar → **Timetable** (or navigate to `/timetable`).

## Who can use it

All workspace members (Owner and Viewer).

## User Workflow

### View a Section's Timetable
1. On the Timetable page, select a **Department** from the first dropdown.
2. Select a specific **Class/Cohort** (section) from the second dropdown, or select **"Whole Department"** to view all sections at once.
3. The timetable grid loads below, showing the weekly schedule.

### View a Faculty Member's Timetable
1. Select a **Department**.
2. In the **Faculty** dropdown (third column), select a faculty member.
3. The grid switches to faculty view, showing all classes taught by that person across the week.

### View Whole Department
1. Select a Department.
2. In the Class/Cohort dropdown, select **"Whole Department"**.
3. All section grids are rendered stacked, each with its header. Faculty grids are also rendered but hidden on screen (print-only).

### Clear Filters
- Press **Escape** key to clear all selections.
- Or select "None" in each dropdown.

### Print
1. Click the **Print** button (top-right).
2. The browser's print dialog opens.
3. The print layout uses a formal institutional document format including:
   - Institution logo and name
   - Academic year, department, semester, class/faculty name
   - The timetable grid with abbreviated subject codes
   - A course legend table with full subject names, codes, faculty/section, and weekly hours
4. Print settings default to landscape orientation with 0.5cm margins.

### Persist Filter Selection
The selected department, section, and faculty are saved to `localStorage`. When you return to the timetable page, your last selection is restored automatically.

## Timetable Grid Layout

- Rows = Days of the week (only days that have time slots defined).
- Columns = Time periods (derived from the time slots).
- Each filled cell shows:
  - Subject type badge (Lecture/Lab)
  - Room number
  - Subject name
  - Faculty name (section view) or Section name (faculty view)
- Break/Lunch cells are visually dimmed with the label text.
- Empty cells are invisible (a faint sparkle icon appears on row hover).

## Stats Bar

Three stats are displayed above the grid:
- **Potential Conflicts**: Count of cells where multiple entries share the same day+slot combination. Displayed in red if > 0.
- **Active Days**: Number of days that have at least one time slot.
- **Time Slots**: Number of unique period labels.

## Buttons & Actions

- **Department dropdown** → Filters sections and faculty dropdowns. Clears section and faculty selection.
- **Class/Cohort dropdown** → Loads section timetable. Requires department selected. Clears faculty selection.
- **Faculty dropdown** → Loads faculty timetable. Requires department selected. Clears section selection.
- **Print** → `window.print()`. No API call.
- **Regenerate All** (Owner only) → See [Timetable Generation](./timetable-generation.md).

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/timetable?sectionId=N` | Fetch timetable for a specific section |
| GET | `/api/timetable?facultyId=N` | Fetch timetable for a faculty member |
| GET | `/api/timetable` | Fetch all timetable entries for the workspace |

The API always scopes results to the authenticated user's workspace.

## Database

| Table | Read |
|---|---|
| `timetable` | SELECT (with joined section, subject, faculty, classroom, timeSlot data) |

## Print Format

The print view is controlled by CSS `@media print` rules. Key behaviours:
- All navigation and UI chrome is hidden.
- Each timetable grid becomes a full page (landscape, `page-break-after: always`).
- Subject codes are abbreviated to initials in the grid cells.
- A separate course legend table appears below the grid.
- Font size is reduced to 8–10pt for density.
- The workspace name is used as the institution name.
- Reference number format: `TT-{year}`.

## Failure Cases

| Scenario | Result |
|---|---|
| No timetable generated yet | Empty grid with "Pick a scope" placeholder |
| Section has no timetable entries | Grid renders with all empty cells |
| No time slots defined | Empty grid, `activeDays = 0`, `uniqueSlots = 0` |
| Invalid sectionId or facultyId in query | HTTP 400 |

## Frequently Asked Questions

**Q: How are subjects abbreviated in the print view?**
A: Each word's first letter is extracted and joined. For example, "Data Structures" → "DS".

**Q: Can I export the timetable to Excel?**
A: No. The only export method is browser print (which can be saved as PDF). Excel export is not implemented for the timetable grid. Excel export is available for master data only (faculty, subjects templates).

**Q: The "Potential Conflicts" counter shows a number. Does that mean the timetable is wrong?**
A: The conflict counter checks for multiple timetable entries in the same day+slot combination. If the scheduler worked correctly this should always be 0. A non-zero value may indicate stale data or a generation issue.

**Q: My print has the wrong institution name.**
A: The print header uses `user.workspace.workspaceName`. Update it at `Settings → Workspace → Edit`.

## Related Features

- [Timetable Generation](./timetable-generation.md)
- [Time Slots](./time-slots.md)
- [Sections](./sections.md)
- [Faculty](./faculty.md)
