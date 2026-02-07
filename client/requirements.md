## Packages
recharts | Dashboard charts for stats
lucide-react | Icons for the interface (already in base but good to be explicit)
date-fns | Formatting dates/times if needed

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  display: ["var(--font-display)"],
  body: ["var(--font-body)"],
}
Timetable grid logic requires transforming flat list of entries into 2D array [TimeSlot][Day].
Auth logic should handle 401 redirects.
