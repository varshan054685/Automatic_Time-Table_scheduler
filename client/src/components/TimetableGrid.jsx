import { useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Sparkles } from "lucide-react";

export function TimetableGrid({ 
  user, 
  entityData, 
  entityType, 
  departmentData, 
  timetableData, 
  uniqueSlots, 
  activeDays, 
  subjects, 
  facultyList, 
  sectionsList,
  isWebVisible = true
}) {
  const isSectionView = entityType === "section";
  
  const getEntry = (day, slotId) => {
    if (!slotId) return null;
    return timetableData?.find(t =>
      t.timeSlotId === slotId &&
      (t.timeSlot ? t.timeSlot.dayOfWeek === day : true)
    ) ?? null;
  };

  const formatTime = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    const hNum = parseInt(h);
    const ampm = hNum >= 12 ? 'p.m' : 'a.m';
    const h12 = hNum % 12 || 12;
    return `${h12}.${m} ${ampm}`;
  };

  const tableSubjects = useMemo(() => {
    if (!timetableData) return [];
    const seen = new Set();
    const list = [];
    timetableData.forEach(entry => {
      if (entry.subject && !seen.has(entry.subject.id)) {
        seen.add(entry.subject.id);
        const subj = subjects?.find(s => s.id === entry.subject.id);
        const fac = facultyList?.find(f => f.id === entry.facultyId);
        list.push({
          ...entry.subject,
          facultyName: fac?.name || entry.faculty?.name || "Unknown Faculty",
          sectionName: entry.section?.name || "Unknown Section",
          acronym: entry.subject.name?.split(' ').map(w => w[0]).join('').toUpperCase() || "N/A"
        });
      }
    });
    return list;
  }, [timetableData, subjects, facultyList]);

  return (
    <div className={`timetable-container ${isWebVisible ? '' : 'hidden print:block'}`} style={{ pageBreakAfter: 'always' }}>
      {/* ─── Print View ─── */}
      <div className="hidden print:block w-full text-[10pt] font-sans leading-tight">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-4">
          <div className="w-24 h-24 bg-primary/10 flex items-center justify-center rounded-lg">
            <img src="/logo.svg" alt="Learn Beyond" className="w-16 h-16 opacity-50" />
          </div>
          <div className="text-center flex-1">
            <h2 className="text-xl font-bold uppercase">{user?.workspace?.workspaceName || 'Your Institution'}</h2>
            <p className="text-xs italic">(Official Timetable Document)</p>
            <h3 className="text-lg font-semibold mt-1">Academic Management System</h3>
            <h4 className="text-md font-bold underline">
                {isSectionView ? 'Class Time Table' : 'Faculty Time Table'}
            </h4>
          </div>
          <div className="text-right flex flex-col justify-end h-24">
            <p className="text-sm font-bold">Ref: TT-{new Date().getFullYear()}</p>
            <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 border border-slate-900 mb-4 bg-slate-50/50">
          <div className="grid grid-cols-2 border-r border-slate-900">
            <div className="border-b border-r border-slate-900 p-1 font-bold">Academic Year</div>
            <div className="border-b border-slate-900 p-1">{user?.workspace?.academicYear || '2025-2026'}</div>
            <div className="border-b border-r border-slate-900 p-1 font-bold">Department</div>
            <div className="border-b border-slate-900 p-1">{departmentData?.name || "N/A"}</div>
            <div className="border-b border-r border-slate-900 p-1 font-bold">Focus</div>
            <div className="border-b border-slate-900 p-1">{isSectionView ? (entityData ? `Semester ${entityData.semester}` : "N/A") : "Faculty Load"}</div>
          </div>
          <div className="grid grid-cols-2">
            <div className="border-b border-r border-slate-900 p-1 font-bold">Entity View</div>
            <div className="border-b border-slate-900 p-1">{isSectionView ? 'Class Schedule' : 'Faculty Load'}</div>
            <div className="border-b border-r border-slate-900 p-1 font-bold">{isSectionView ? 'Class' : 'Faculty'}</div>
            <div className="border-b border-slate-900 p-1">{entityData?.name || "N/A"}</div>
          </div>
        </div>

        <div className="border-y border-x border-slate-900 mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100/80">
                <th className="border border-slate-900 p-1 w-20 text-center uppercase font-bold">Day</th>
                {uniqueSlots.map((slot, idx) => {
                   const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                   if (isBreak) return <th key={idx} className="border border-slate-900 p-1 w-12 bg-slate-200"></th>;
                   return (
                     <th key={idx} className="border border-slate-900 p-2 text-center text-[9pt]">
                       <div className="font-bold">{formatTime(slot.startTime)}</div>
                       <div className="text-[7pt] text-slate-500">to</div>
                       <div className="font-bold">{formatTime(slot.endTime)}</div>
                     </th>
                   );
                })}
              </tr>
            </thead>
            <tbody>
              {activeDays.map((day, dIdx) => (
                  <tr key={day} className="h-16">
                    <td className="border border-slate-900 text-center font-bold text-sm bg-slate-50">{day.substring(0, 3).toUpperCase()}</td>
                    {uniqueSlots.map((slot, sIdx) => {
                      const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                      const entry = getEntry(day, slot.idsByDay[day]);
                      
                      if (isBreak) {
                        if (dIdx === 0) {
                          return (
                            <td key={sIdx} rowSpan={activeDays.length} className="border border-slate-900 p-1 bg-slate-50 text-center text-[7pt] vertical-text">
                              <div className="font-bold uppercase tracking-widest">{slot.label}</div>
                            </td>
                          );
                        }
                        return null;
                      }
                      
                      return (
                        <td key={sIdx} className="border border-slate-900 p-1 text-center font-bold text-[10pt]">
                          {entry?.subject && (
                              <div className="flex flex-col gap-0.5">
                                  <span>{entry.subject.name.split(' ').map(w => w[0]).join('').toUpperCase()}</span>
                                  <span className="text-[7pt] font-normal italic">
                                      {isSectionView ? entry.faculty?.name : entry.section?.name}
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
                <td className="border border-slate-900 p-1 w-12 text-center">S.No</td>
                <td className="border border-slate-900 p-1 text-center">COURSE NAME</td>
                <td className="border border-slate-900 p-1 w-32 text-center">CODE</td>
                <td className="border border-slate-900 p-1 w-48 text-center">{isSectionView ? 'FACULTY' : 'SECTION'}</td>
                <td className="border border-slate-900 p-1 w-20 text-center">HOURS</td>
              </tr>
            </thead>
            <tbody>
              {tableSubjects.map((subject, idx) => (
                <tr key={subject.id}>
                  <td className="border border-slate-900 p-1 text-center font-bold">{idx + 1}</td>
                  <td className="border border-slate-900 p-1 px-4">{subject.name}</td>
                  <td className="border border-slate-900 p-1 text-center font-bold">{subject.code}</td>
                  <td className="border border-slate-900 p-1 text-center">{isSectionView ? subject.facultyName : subject.sectionName}</td>
                  <td className="border border-slate-900 p-1 text-center font-bold">{subject.weeklyHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* ─── Web View ─── */}
      {isWebVisible && (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl lg:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mb-4 print:hidden"
        >
            {/* Entity Header for Web View if multiple are shown */}
            <div className="px-4 py-3 lg:p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center print:hidden">
              <div>
                <h3 className="text-base lg:text-xl font-bold text-slate-900">{entityData?.name}</h3>
                <p className="text-[10px] lg:text-sm text-slate-500 uppercase tracking-widest font-black">{isSectionView ? 'Class Schedule' : 'Faculty Load'}</p>
              </div>
            </div>

            <div className="print:hidden">
                <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="p-2 lg:p-4 text-left border-r border-slate-100 bg-slate-100/30 sticky left-0 z-10" style={{ width: '80px' }}>
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Day</span>
                                </div>
                            </th>
                            {uniqueSlots.map((slot, idx) => (
                                <th key={idx} className="p-1 lg:p-2 text-center border-r border-slate-100 last:border-0">
                                    <div className="flex flex-col items-center gap-0.5 px-1 py-1 lg:px-2 lg:py-1.5 rounded-lg lg:rounded-xl bg-white shadow-sm border border-slate-100/50">
                                        <span className={`text-[7px] lg:text-[9px] font-black uppercase tracking-wider ${slot.label.toLowerCase().includes('break') ? 'text-rose-500' : 'text-indigo-600'}`}>
                                            {slot.label}
                                        </span>
                                        <div className="hidden sm:flex items-center gap-1 text-[8px] lg:text-[10px] font-mono font-bold text-slate-500">
                                            <span>{formatTime(slot.startTime)}</span>
                                            <span className="w-2 h-px bg-slate-300"></span>
                                            <span>{formatTime(slot.endTime)}</span>
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white relative">
                        {activeDays.map((day) => (
                            <motion.tr 
                                key={day}
                                className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all"
                            >
                                <td className="p-2 lg:p-3 bg-slate-50/20 border-r border-slate-100 sticky left-0 z-10 font-black text-slate-900 text-xs lg:text-sm group-hover:bg-white transition-all">
                                    <div className="flex items-center gap-1.5 lg:gap-2">
                                        <div className="w-1 h-5 lg:h-6 bg-indigo-500 rounded-full scale-y-50 group-hover:scale-y-100 transition-transform duration-500"></div>
                                        <span className="hidden lg:inline">{day}</span>
                                        <span className="lg:hidden">{day.substring(0, 3)}</span>
                                    </div>
                                </td>
                                {uniqueSlots.map((slot, sIdx) => {
                                    const slotIdForDay = slot.idsByDay[day];
                                    const entry = slotIdForDay ? getEntry(day, slotIdForDay) : null;
                                    const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                                    
                                    return (
                                        <td key={sIdx} className={`p-1 lg:p-2 border-r border-slate-100 last:border-0 relative transition-all ${isBreak ? 'bg-slate-50/50' : ''}`} style={{ height: '72px' }}>
                                            {isBreak ? (
                                                <div className="flex flex-col items-center justify-center h-full opacity-20 group-hover:opacity-40 transition-opacity">
                                                    <div className="text-[7px] lg:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{slot.label}</div>
                                                </div>
                                            ) : entry ? (
                                                <motion.div 
                                                    layoutId={`entry-${entry.id}`}
                                                    className="flex flex-col justify-between h-full bg-white p-1.5 lg:p-2.5 rounded-lg lg:rounded-xl shadow-sm border border-slate-100 group-hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 transition-all overflow-hidden"
                                                >
                                                    <div className="space-y-0.5 min-w-0">
                                                        <div className="flex items-center justify-between gap-0.5">
                                                            <span className={`px-1 lg:px-1.5 py-px rounded text-[7px] lg:text-[8px] font-black uppercase tracking-tighter truncate ${entry.subject?.type === 'lab' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                                {entry.subject?.type || 'Lecture'}
                                                            </span>
                                                            <div className="flex items-center gap-0.5 text-[7px] lg:text-[8px] font-bold text-slate-400 shrink-0">
                                                                <MapPin className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                                                                <span className="hidden sm:inline">{entry.classroom?.roomNumber || "R??"}</span>
                                                            </div>
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 text-[10px] lg:text-xs leading-tight line-clamp-2">
                                                            {entry.subject?.name}
                                                        </h4>
                                                    </div>
                                                    
                                                    <div className="pt-1 border-t border-slate-50 flex items-center gap-1 mt-auto">
                                                        <div className="w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-slate-200 flex items-center justify-center text-[7px] lg:text-[8px] font-black text-slate-600 shrink-0">
                                                            {(isSectionView ? entry.faculty?.name : entry.section?.name)?.charAt(0) || '?'}
                                                        </div>
                                                        <span className="text-[8px] lg:text-[10px] font-bold text-slate-500 truncate">
                                                            {isSectionView ? entry.faculty?.name : entry.section?.name}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ) : (
                                                <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-5 transition-opacity">
                                                    <Sparkles className="w-6 h-6 lg:w-8 lg:h-8 text-slate-600" />
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
      )}
    </div>
  );
}
