import { useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, CheckCircle2, AlertTriangle } from "lucide-react";

export function TimetableGrid({
  user,
  entityData,
  entityType,
  departmentData,
  timetableData,
  uniqueSlots = [],
  activeDays = [],
  subjects = [],
  facultyList = [],
  sectionsList = [],
  isWebVisible = true,
  conflicts = [],
}) {
  const isSectionView = entityType === "section";

  const getEntry = (day, slotId) => {
    if (!slotId || !Array.isArray(timetableData)) return null;
    return (
      timetableData.find(
        (t) =>
          t &&
          t.timeSlotId === slotId &&
          (t.timeSlot ? t.timeSlot.dayOfWeek === day : true),
      ) ?? null
    );
  };

  const formatTime = (time24) => {
    if (!time24 || typeof time24 !== "string") return "";
    const parts = time24.split(":");
    const h = parts[0] || "0";
    const m = parts[1] || "00";
    const hNum = parseInt(h, 10) || 0;
    const ampm = hNum >= 12 ? "p.m" : "a.m";
    const h12 = hNum % 12 || 12;
    return `${h12}.${m.padStart(2, "0")} ${ampm}`;
  };

  const formatTimeRange = (start24, end24) => {
    if (!start24 && !end24) return "";
    const clean = (t) => {
      if (!t) return "";
      const parts = t.split(":");
      const h = parseInt(parts[0], 10) || 0;
      const m = (parts[1] || "00").padStart(2, "0");
      return `${String(h).padStart(2, "0")}:${m}`;
    };
    return `${clean(start24)} – ${clean(end24)}`;
  };

  const teachingPeriodsCount = useMemo(() => {
    return (uniqueSlots || []).filter((s) => {
      const l = (s?.label || "").toLowerCase();
      return !l.includes("break") && !l.includes("lunch");
    }).length;
  }, [uniqueSlots]);

  const breakCount = useMemo(() => {
    return (uniqueSlots || []).filter((s) => {
      const l = (s?.label || "").toLowerCase();
      return l.includes("break") || l.includes("lunch");
    }).length;
  }, [uniqueSlots]);

  const entityConflictsCount = useMemo(() => {
    if (!Array.isArray(conflicts)) return 0;
    if (!entityData?.name) return conflicts.length;
    if (isSectionView) {
      return conflicts.filter((c) => c.type === "section" && c.label === entityData.name).length;
    }
    return conflicts.filter((c) => c.type === "teacher" && c.label === entityData.name).length;
  }, [conflicts, entityData, isSectionView]);

  const tableSubjects = useMemo(() => {
    if (!Array.isArray(timetableData)) return [];
    const seen = new Set();
    const list = [];
    timetableData.forEach((entry) => {
      if (entry && entry.subject && !seen.has(entry.subject.id)) {
        seen.add(entry.subject.id);
        const subj = subjects?.find((s) => s.id === entry.subject.id);
        const fac = facultyList?.find((f) => f.id === entry.facultyId);
        list.push({
          ...entry.subject,
          facultyName: fac?.name || entry.faculty?.name || "Unknown Faculty",
          sectionName: entry.section?.name || "Unknown Section",
          acronym:
            (entry.subject.name || "")
              .split(" ")
              .filter(Boolean)
              .map((w) => w[0] || "")
              .join("")
              .toUpperCase() || "N/A",
        });
      }
    });
    return list;
  }, [timetableData, subjects, facultyList]);

  const minTableWidth = useMemo(() => {
    let width = 110; // Day column
    (uniqueSlots || []).forEach((slot) => {
      const l = (slot?.label || "").toLowerCase();
      if (l.includes("break") || l.includes("lunch")) {
        width += 68;
      } else {
        width += 155;
      }
    });
    return Math.max(width, 920);
  }, [uniqueSlots]);

  return (
    <div
      className={`timetable-container ${isWebVisible ? "" : "hidden print:block"}`}
      style={{ pageBreakAfter: "always" }}
    >
      {/* ─── Print View (Official Document Layout) ─── */}
      <div className="hidden print:block w-full text-[10pt] font-sans leading-tight">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-4">
          <div className="w-24 h-24 bg-primary/10 flex items-center justify-center rounded-lg">
            <img
              src="/logo.svg"
              alt="Logo"
              className="w-16 h-16 opacity-50"
            />
          </div>
          <div className="text-center flex-1">
            <h2 className="text-xl font-bold uppercase">
              {user?.workspace?.workspaceName || "Your Institution"}
            </h2>
            <p className="text-xs italic">(Official Timetable Document)</p>
            <h3 className="text-lg font-semibold mt-1">
              Academic Management System
            </h3>
            <h4 className="text-md font-bold underline">
              {isSectionView ? "Class Time Table" : "Faculty Time Table"}
            </h4>
          </div>
          <div className="text-right flex flex-col justify-end h-24">
            <p className="text-sm font-bold">
              Ref: TT-{new Date().getFullYear()}
            </p>
            <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 border border-slate-900 mb-4 bg-slate-50/50">
          <div className="grid grid-cols-2 border-r border-slate-900">
            <div className="border-b border-r border-slate-900 p-1 font-bold">
              Academic Year
            </div>
            <div className="border-b border-slate-900 p-1">
              {user?.workspace?.academicYear || "2025-2026"}
            </div>
            <div className="border-b border-r border-slate-900 p-1 font-bold">
              Department
            </div>
            <div className="border-b border-slate-900 p-1">
              {departmentData?.name || "N/A"}
            </div>
            <div className="border-b border-r border-slate-900 p-1 font-bold">
              Focus
            </div>
            <div className="border-b border-slate-900 p-1">
              {isSectionView
                ? entityData
                  ? `Semester ${entityData.semester || 1}`
                  : "N/A"
                : "Faculty Load"}
            </div>
          </div>
          <div className="grid grid-cols-2">
            <div className="border-b border-r border-slate-900 p-1 font-bold">
              Entity View
            </div>
            <div className="border-b border-slate-900 p-1">
              {isSectionView ? "Class Schedule" : "Faculty Load"}
            </div>
            <div className="border-b border-slate-900 p-1 font-bold">
              {isSectionView ? "Class" : "Faculty"}
            </div>
            <div className="border-b border-slate-900 p-1">
              {entityData?.name || "N/A"}
            </div>
          </div>
        </div>

        <div className="border-y border-x border-slate-900 mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100/80">
                <th className="border border-slate-900 p-1 w-20 text-center uppercase font-bold">
                  Day
                </th>
                {(uniqueSlots || []).map((slot, idx) => {
                  const label = slot?.label || "";
                  const isBreak =
                    label.toLowerCase().includes("break") ||
                    label.toLowerCase().includes("lunch");
                  if (isBreak) {
                    return (
                      <th
                        key={idx}
                        className="border border-slate-900 p-1 w-12 bg-slate-200"
                      />
                    );
                  }
                  return (
                    <th
                      key={idx}
                      className="border border-slate-900 p-2 text-center text-[9pt]"
                    >
                      <div className="font-bold">
                        {formatTime(slot?.startTime)}
                      </div>
                      <div className="text-[7pt] text-slate-500">to</div>
                      <div className="font-bold">
                        {formatTime(slot?.endTime)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(activeDays || []).map((day, dIdx) => (
                <tr key={day} className="h-16">
                  <td className="border border-slate-900 text-center font-bold text-sm bg-slate-50">
                    {String(day || "").substring(0, 3).toUpperCase()}
                  </td>
                  {(uniqueSlots || []).map((slot, sIdx) => {
                    const label = slot?.label || "";
                    const isBreak =
                      label.toLowerCase().includes("break") ||
                      label.toLowerCase().includes("lunch");
                    const slotId = slot?.idsByDay?.[day];
                    const entry = slotId ? getEntry(day, slotId) : null;

                    if (isBreak) {
                      if (dIdx === 0) {
                        return (
                          <td
                            key={sIdx}
                            rowSpan={activeDays.length}
                            className="border border-slate-900 p-1 bg-slate-50 text-center text-[7pt] vertical-text"
                          >
                            <div className="font-bold uppercase tracking-widest">
                              {label}
                            </div>
                          </td>
                        );
                      }
                      return null;
                    }

                    return (
                      <td
                        key={sIdx}
                        className="border border-slate-900 p-1 text-center font-bold text-[10pt]"
                      >
                        {entry?.subject && (
                          <div className="flex flex-col gap-0.5">
                            <span>
                              {(entry.subject.name || "")
                                .split(" ")
                                .filter(Boolean)
                                .map((w) => w[0] || "")
                                .join("")
                                .toUpperCase()}
                            </span>
                            <span className="text-[7pt] font-normal italic">
                              {isSectionView
                                ? entry.faculty?.name
                                : entry.section?.name}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-y border-x border-slate-900 mb-4 course-table">
          <table className="w-full border-collapse text-[8pt]">
            <thead>
              <tr className="bg-slate-100/80 font-bold">
                <td className="border border-slate-900 p-1 w-12 text-center">
                  S.No
                </td>
                <td className="border border-slate-900 p-1 text-center">
                  COURSE NAME
                </td>
                <td className="border border-slate-900 p-1 w-32 text-center">
                  CODE
                </td>
                <td className="border border-slate-900 p-1 w-48 text-center">
                  {isSectionView ? "FACULTY" : "SECTION"}
                </td>
                <td className="border border-slate-900 p-1 w-20 text-center">
                  HOURS
                </td>
              </tr>
            </thead>
            <tbody>
              {tableSubjects.map((subject, idx) => (
                <tr key={subject.id}>
                  <td className="border border-slate-900 p-1 text-center font-bold">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-900 p-1 px-4">
                    {subject.name}
                  </td>
                  <td className="border border-slate-900 p-1 text-center font-bold">
                    {subject.code}
                  </td>
                  <td className="border border-slate-900 p-1 text-center">
                    {isSectionView ? subject.facultyName : subject.sectionName}
                  </td>
                  <td className="border border-slate-900 p-1 text-center font-bold">
                    {subject.weeklyHours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Web Interactive View ─── */}
      {isWebVisible && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 print:hidden"
        >
          {/* 1. Timetable Header with title, summary, and conflict health */}
          <div className="px-5 py-4 lg:px-6 lg:py-5 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[11px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                  {isSectionView
                    ? departmentData?.name
                      ? `${departmentData.name} / Class Schedule`
                      : "Class Schedule"
                    : "Faculty Schedule"}
                </span>
                {entityConflictsCount === 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    No conflicts
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                    {entityConflictsCount} conflict{entityConflictsCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <h3 className="text-xl lg:text-2xl font-black font-display text-slate-900 tracking-tight">
                {entityData?.name || "Schedule"}
              </h3>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span>{activeDays.length} Days</span>
                <span className="text-slate-300">·</span>
                <span>{teachingPeriodsCount} Teaching Periods</span>
                {breakCount > 0 && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{breakCount} {breakCount === 1 ? "Break" : "Breaks"}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2. Structured Scheduling Grid */}
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse"
              style={{ minWidth: `${minTableWidth}px` }}
            >
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/80">
                  {/* Day Header */}
                  <th
                    className="py-3 px-3.5 text-left border-r border-slate-200/80 bg-slate-100/50 sticky left-0 z-20 w-28 min-w-[100px]"
                  >
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
                      Day
                    </span>
                  </th>

                  {/* Period Headers */}
                  {(uniqueSlots || []).map((slot, idx) => {
                    const label = slot?.label || "";
                    const isBreak =
                      label.toLowerCase().includes("break") ||
                      label.toLowerCase().includes("lunch");

                    if (isBreak) {
                      return (
                        <th
                          key={idx}
                          className="py-3 px-2 text-center border-r border-slate-200/70 bg-slate-100/60 w-16 min-w-[64px] max-w-[72px]"
                        >
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                              {label}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 font-medium mt-0.5">
                              {formatTimeRange(slot?.startTime, slot?.endTime)}
                            </span>
                          </div>
                        </th>
                      );
                    }

                    return (
                      <th
                        key={idx}
                        className="py-3 px-3 text-center border-r border-slate-200/70 last:border-0 min-w-[150px]"
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                            {label}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 font-mono mt-0.5">
                            {formatTimeRange(slot?.startTime, slot?.endTime)}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-slate-100">
                {(activeDays || []).map((day) => (
                  <tr
                    key={day}
                    className="group hover:bg-slate-50/40 transition-colors"
                  >
                    {/* Day label cell */}
                    <td className="p-3 border-r border-slate-200/80 bg-slate-50/70 sticky left-0 z-10 font-bold text-slate-800 text-sm align-middle">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                        <span>{day}</span>
                      </div>
                    </td>

                    {/* Periods for this day */}
                    {(uniqueSlots || []).map((slot, sIdx) => {
                      const slotIdForDay = slot?.idsByDay?.[day];
                      const entry = slotIdForDay
                        ? getEntry(day, slotIdForDay)
                        : null;
                      const label = slot?.label || "";
                      const isBreak =
                        label.toLowerCase().includes("break") ||
                        label.toLowerCase().includes("lunch");
                      const isLab = entry?.subject?.type === "lab";

                      if (isBreak) {
                        return (
                          <td
                            key={sIdx}
                            className="p-0 border-r border-slate-200/60 bg-slate-50/80 w-16 min-w-[64px] max-w-[72px] text-center select-none align-middle"
                          >
                            <div className="flex flex-col items-center justify-center h-full min-h-[92px] py-2">
                              <span className="text-[10px] font-black tracking-[0.2em] text-slate-300 uppercase">
                                {label}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={sIdx}
                          className="p-1.5 border-r border-slate-200/60 last:border-0 align-top min-w-[150px]"
                        >
                          {entry ? (
                            <div
                              className={`flex flex-col justify-between h-full min-h-[92px] p-2.5 rounded-lg border transition-all duration-150 group/card ${
                                isLab
                                  ? "bg-amber-50/30 border-amber-200/80 hover:border-amber-300 hover:bg-amber-50/60 hover:shadow-sm"
                                  : "bg-white border-slate-200/80 hover:border-indigo-300 hover:bg-slate-50/40 hover:shadow-sm"
                              }`}
                            >
                              <div>
                                {/* Class type badge */}
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      isLab
                                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                                        : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                    }`}
                                  >
                                    {isLab ? "LAB" : "LECTURE"}
                                  </span>
                                </div>

                                {/* Subject name */}
                                <h4
                                  className="font-bold text-slate-900 text-[13px] leading-snug line-clamp-2"
                                  title={entry.subject?.name}
                                >
                                  {entry.subject?.name}
                                </h4>
                              </div>

                              {/* Teacher · Room metadata */}
                              <div className="pt-2 mt-2 border-t border-slate-100/90 flex items-center justify-between gap-1 text-[11px] text-slate-500">
                                <span
                                  className="truncate font-medium text-slate-600 max-w-[95px]"
                                  title={
                                    isSectionView
                                      ? entry.faculty?.name
                                      : entry.section?.name
                                  }
                                >
                                  {isSectionView
                                    ? entry.faculty?.name || "—"
                                    : entry.section?.name || "—"}
                                </span>
                                {entry.classroom?.roomNumber && (
                                  <span className="inline-flex items-center gap-0.5 text-slate-700 font-semibold shrink-0">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {entry.classroom.roomNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="h-full min-h-[92px] rounded-lg border border-dashed border-slate-200/70 flex items-center justify-center text-slate-300">
                              <span className="text-xs font-medium text-slate-300">—</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
