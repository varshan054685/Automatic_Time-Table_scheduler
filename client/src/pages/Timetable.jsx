import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Download, RefreshCw, User, Calendar, BookOpen, Clock } from "lucide-react";
import { useTimetable, useGenerateTimetable } from "@/hooks/use-timetable";
import { useDepartments, useSections, useTimeSlots, useFaculty, useSubjects } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";

export default function TimetablePage() {
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const { toast } = useToast();
  
  const { data: departments } = useDepartments();
  const { data: sections } = useSections();
  const { data: timeSlots } = useTimeSlots();
  const { data: faculty } = useFaculty();
  const { data: subjects } = useSubjects();
  
  const filteredSections = sections?.filter(s => 
    !selectedDept || s.departmentId.toString() === selectedDept
  );

  const filteredFaculty = useMemo(() => {
    if (!selectedDept) return faculty;
    // Faculty belonging to this dept
    const deptFacultyIds = new Set(faculty?.filter(f => f.departmentId.toString() === selectedDept).map(f => f.id));
    // Also include faculty who teach any subject in this department
    subjects?.filter(s => s.departmentId.toString() === selectedDept && s.facultyId).forEach(s => {
      deptFacultyIds.add(s.facultyId);
    });
    return faculty?.filter(f => deptFacultyIds.has(f.id));
  }, [faculty, subjects, selectedDept]);

  const normalizedSection = selectedSection && selectedSection !== "none" ? selectedSection : "";
  const normalizedFaculty = selectedFaculty && selectedFaculty !== "none" ? selectedFaculty : "";
  const isSectionView = Boolean(normalizedSection);
  const isFacultyView = Boolean(normalizedFaculty);

  const { data: timetable, isLoading: isLoadingTimetable } = useTimetable({
    sectionId: normalizedSection,
    facultyId: normalizedFaculty
  });

  const generateMutation = useGenerateTimetable();

  const handleGenerate = () => {
    if (!selectedDept) {
      toast({ title: "Error", description: "Please select a department first", variant: "destructive" });
      return;
    }

    let defaultSem = "1";
    if (selectedSection && selectedSection !== "none") {
      const sec = sections?.find(s => s.id.toString() === selectedSection);
      if (sec) defaultSem = sec.semester.toString();
    } else {
      const deptSections = sections?.filter(s => s.departmentId.toString() === selectedDept);
      if (deptSections && deptSections.length > 0) {
        defaultSem = deptSections[0].semester.toString();
      }
    }

    const semesterStr = prompt("Enter semester number (e.g. 1, 2, 3) or leave empty for all:", defaultSem);
    if (semesterStr === null) return;
    
    const semNum = parseInt(semesterStr);
    const payload = { departmentId: parseInt(selectedDept) };
    if (!isNaN(semNum)) {
       payload.semester = semNum;
    }

    generateMutation.mutate(payload, {
      onSuccess: (data) => {
        toast({ title: "Success", description: data.message });
      },
      onError: (err) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const getEntry = (day, slotId) => {
    return timetable?.find(t => 
      t.timeSlotId === slotId && 
      t.timeSlot.dayOfWeek === day
    );
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  const uniqueSlots = useMemo(() => {
    if (!timeSlots) return [];
    
    const slotsByTime = new Map();
    timeSlots.forEach(slot => {
      const key = `${slot.label}-${slot.startTime}-${slot.endTime}`;
      if (!slotsByTime.has(key)) {
        slotsByTime.set(key, {
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          idsByDay: {}
        });
      }
      slotsByTime.get(key).idsByDay[slot.dayOfWeek] = slot.id;
    });

    return Array.from(slotsByTime.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timeSlots]);

  const activeDays = days.filter(day => 
    timeSlots?.some(slot => slot.dayOfWeek === day)
  );

  const formatTime = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    const hNum = parseInt(h);
    const ampm = hNum >= 12 ? 'p.m' : 'a.m';
    const h12 = hNum % 12 || 12;
    return `${h12}.${m} ${ampm}`;
  };

  const selectedDeptData = departments?.find(d => d.id.toString() === selectedDept);
  const selectedSectionData = sections?.find(s => s.id.toString() === selectedSection);
  const selectedFacultyData = faculty?.find(f => f.id.toString() === selectedFaculty);

  const tableSubjects = useMemo(() => {
    if (!timetable) return [];
    const seen = new Set();
    const list = [];
    timetable.forEach(entry => {
      if (entry.subject && !seen.has(entry.subject.id)) {
        seen.add(entry.subject.id);
        const subj = subjects?.find(s => s.id === entry.subject.id);
        const fac = faculty?.find(f => f.id === entry.facultyId);
        list.push({
          ...entry.subject,
          facultyName: fac?.name || entry.faculty?.name || "Unknown Faculty",
          acronym: entry.subject.name?.split(' ').map(w => w[0]).join('').toUpperCase() || "N/A"
        });
      }
    });
    return list;
  }, [timetable, subjects, faculty]);

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 print:m-0 print:p-0">
        {/* Print Layout */}
        <div className="hidden print:block w-full text-[10pt] font-sans leading-tight">
          {/* Institution Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-4">
            <div className="w-24 h-24 bg-primary/10 flex items-center justify-center rounded-lg">
              <img src="/logo.svg" alt="Learn Beyond" className="w-16 h-16 opacity-50" />
            </div>
            <div className="text-center flex-1">
              <h2 className="text-xl font-bold uppercase">KPR College of Arts Science and Research</h2>
              <p className="text-xs italic">(Affiliated to Bharathiar University, Coimbatore)</p>
              <h3 className="text-lg font-semibold mt-1">Quality System Document</h3>
              <h4 className="text-md font-bold underline">Class Time Table</h4>
            </div>
            <div className="text-right flex flex-col justify-end h-24">
              <p className="text-sm">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Metadata Table */}
          <div className="grid grid-cols-2 border border-slate-900 mb-4 bg-slate-50/50">
            <div className="grid grid-cols-2 border-r border-slate-900">
              <div className="border-b border-r border-slate-900 p-1 font-bold">Academic Year</div>
              <div className="border-b border-slate-900 p-1">2025-2026</div>
              <div className="border-b border-r border-slate-900 p-1 font-bold">Department</div>
              <div className="border-b border-slate-900 p-1">{selectedDeptData?.name || "N/A"}</div>
              <div className="border-b border-r border-slate-900 p-1 font-bold">Batch</div>
              <div className="border-b border-slate-900 p-1">{selectedSectionData ? `${2023 + (4 - (selectedSectionData?.year || 0))}-2026` : "2023-2026"}</div>
              <div className="border-r border-slate-900 p-1 font-bold">Name of the Class Advisor</div>
              <div className="p-1">Dr.S.Kowsalye</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="border-b border-r border-slate-900 p-1 font-bold invisible opacity-0 h-0">.</div>
              <div className="border-b border-slate-900 p-1 invisible opacity-0 h-0">.</div>
              <div className="border-b border-r border-slate-900 p-1 font-bold">Class</div>
              <div className="border-b border-slate-900 p-1">{selectedSectionData?.name || "N/A"}</div>
              <div className="border-b border-r border-slate-900 p-1 font-bold">Semester</div>
              <div className="border-b border-slate-900 p-1">{selectedSectionData ? `VI` : "N/A"}</div>
            </div>
          </div>

          {/* Main Timetable Grid */}
          <div className="border-y border-x border-slate-900 mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100/80">
                  <th className="border border-slate-900 p-1 w-20 text-center uppercase font-bold">Day Order</th>
                  {uniqueSlots.map((slot, idx) => {
                     const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                     if (isBreak) return <th key={idx} className="border border-slate-900 p-1 w-12 bg-slate-200"></th>;
                     return (
                       <th key={idx} className="border border-slate-900 p-2 text-center text-[9pt]">
                         <div className="font-bold">{formatTime(slot.startTime)} -</div>
                         <div className="font-bold">{formatTime(slot.endTime)}</div>
                       </th>
                     );
                  })}
                </tr>
              </thead>
              <tbody>
                {activeDays.map((day, dIdx) => {
                  const dayRoman = ["I", "II", "III", "IV", "V", "VI", "VII"][dIdx];
                  return (
                    <tr key={day} className="h-16">
                      <td className="border border-slate-900 text-center font-bold text-lg">{dayRoman}</td>
                      {uniqueSlots.map((slot, sIdx) => {
                        const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                        const entry = getEntry(day, slot.idsByDay[day]);
                        
                        if (isBreak) {
                          if (dIdx === 0) {
                            return (
                              <td key={sIdx} rowSpan={activeDays.length} className="border border-slate-900 p-1 bg-slate-50 text-center text-[8pt] vertical-text">
                                <div className="font-bold uppercase transform -rotate-90 origin-center whitespace-nowrap">
                                  {slot.label} Break 
                                  <div className="mt-1">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</div>
                                </div>
                              </td>
                            );
                          }
                          return null;
                        }
                        
                        return (
                          <td key={sIdx} className="border border-slate-900 p-1 text-center font-bold text-[11pt]">
                            {entry?.subject?.name.split(' ').map(w => w[0]).join('').toUpperCase() || ""}
                            {entry?.subject?.type === 'lab' ? ' LAB' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Course Details Table */}
          <div className="border-y border-x border-slate-900 mb-8">
            <table className="w-full border-collapse text-[9pt]">
              <thead>
                <tr className="bg-slate-100/80 font-bold">
                  <td className="border border-slate-900 p-1 w-12 text-center">S. No.</td>
                  <td className="border border-slate-900 p-1 text-center">COURSE</td>
                  <td className="border border-slate-900 p-1 w-32 text-center">ACRONYM</td>
                  <td className="border border-slate-900 p-1 w-48 text-center">FACULTY NAME</td>
                  <td className="border border-slate-900 p-1 w-24 text-center">No. of HOURS</td>
                </tr>
              </thead>
              <tbody>
                {tableSubjects.map((subject, idx) => (
                  <tr key={subject.id}>
                    <td className="border border-slate-900 p-1 text-center font-bold">{idx + 1}.</td>
                    <td className="border border-slate-900 p-1 px-4">{subject.name}</td>
                    <td className="border border-slate-900 p-1 text-center font-bold">{subject.acronym}{subject.type === 'lab' ? ' LAB' : ''}</td>
                    <td className="border border-slate-900 p-1 text-center">{subject.facultyName}</td>
                    <td className="border border-slate-900 p-1 text-center font-bold">{subject.weeklyHours}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={4} className="border border-slate-900 p-1 text-right px-4 uppercase">Total</td>
                  <td className="border border-slate-900 p-1 text-center">{tableSubjects.reduce((acc, s) => acc + s.weeklyHours, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature Footer */}
          <div className="flex justify-between items-end mt-12 mb-8 px-4">
            <div className="text-center font-bold">
              <div className="h-0.5 w-32 bg-transparent border-t border-slate-400 mb-2"></div>
              <p>Class Advisor</p>
            </div>
            <div className="text-center font-bold">
               <div className="h-0.5 w-48 bg-transparent border-t border-slate-400 mb-2"></div>
               <p>Head of the Department</p>
            </div>
          </div>

          <div className="flex justify-between text-[8pt] text-slate-500 uppercase font-mono mt-8 border-t pt-2">
            <div>KPRCAS/IQAC/TT</div>
            <div>Version: 2</div>
            <div>Date: 18/02/2022</div>
          </div>
        </div>

        {/* Normal Dashboard View */}
        <div className="max-w-7xl mx-auto space-y-6 pt-12 lg:pt-0 print:hidden">
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900 text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">Timetable</h1>
              <p className="text-slate-500 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Generate and view weekly schedules.
              </p>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" className="gap-2 border-slate-200 hover:bg-slate-50 transition-colors" onClick={() => window.print()}>
                 <Download className="w-4 h-4" /> Export PDF
               </Button>
            </div>
          </div>

          <Card className="p-6 bg-white/80 backdrop-blur-sm shadow-xl shadow-slate-200/50 border-white/50 print:hidden">
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" /> Department
                  </label>
                  <Select value={selectedDept} onValueChange={(val) => {
                    setSelectedDept(val);
                    setSelectedSection("");
                    setSelectedFaculty("");
                  }}>
                    <SelectTrigger className="bg-white border-slate-200 focus:ring-primary/20">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => (
                        <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" /> Section/Class View
                  </label>
                  <Select disabled={!selectedDept} value={selectedSection} onValueChange={(val) => {
                    setSelectedSection(val);
                    setSelectedFaculty("");
                  }}>
                    <SelectTrigger className="bg-white border-slate-200 focus:ring-primary/20">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {filteredSections?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name} (Sem {s.semester})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Faculty View
                  </label>
                  <Select disabled={!selectedDept} value={selectedFaculty} onValueChange={(val) => {
                    setSelectedFaculty(val);
                    setSelectedSection("");
                  }}>
                    <SelectTrigger className="bg-white border-slate-200 focus:ring-primary/20">
                      <SelectValue placeholder="Select Faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {filteredFaculty?.map(f => (
                        <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleGenerate} 
                  disabled={!selectedDept || generateMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white min-w-[160px] shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Generate New</>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden print:hidden">
            {(!isSectionView && !isFacultyView) ? (
              <div className="p-24 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                   <Clock className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No View Selected</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2 italic">Select a Class or Faculty above to view the generated weekly schedule</p>
              </div>
            ) : isLoadingTimetable ? (
              <div className="p-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-slate-500 font-medium animate-pulse">Fetching timetable...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/50 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-2 text-left font-bold text-slate-900 w-24 border-r border-slate-200 bg-slate-100/30 text-[10px]">Day / Time</th>
                      {uniqueSlots.map((slot, idx) => (
                        <th key={idx} className="px-2 py-2 text-center font-bold text-slate-900 min-w-[100px] border-r border-slate-200 last:border-0">
                          <div className="text-[8px] text-primary/70 uppercase tracking-[0.1em] font-black">{slot.label}</div>
                          <div className="text-[9px] font-mono tracking-tight">{formatTime(slot.startTime).replace(' ', '')} - {formatTime(slot.endTime).replace(' ', '')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDays.map(day => (
                      <tr key={day} className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
                        <td className="px-2 py-2 font-bold text-slate-900 bg-slate-50/20 border-r border-slate-200 text-[10px]">
                          {day}
                        </td>
                        {uniqueSlots.map((slot, idx) => {
                          const slotIdForDay = slot.idsByDay[day];
                          const entry = slotIdForDay ? getEntry(day, slotIdForDay) : null;
                          const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                          
                          return (
                            <td key={idx} className={`px-2 py-2 border-r border-slate-200 last:border-0 relative h-full transition-all ${isBreak ? 'bg-slate-100/30' : ''}`}>
                              {isBreak ? (
                                <div className="flex flex-col items-center justify-center h-full gap-1 opacity-40">
                                  <div className="w-0.5 h-4 bg-slate-300 rounded-full"></div>
                                  <div className="text-[7px] text-slate-500 font-black tracking-[0.2em] uppercase rotate-0">{slot.label}</div>
                                  <div className="w-0.5 h-4 bg-slate-300 rounded-full"></div>
                                </div>
                              ) : entry ? (
                                <div className="text-center">
                                  <div className="font-bold text-slate-900 text-[10px] tracking-tight">{entry.subject?.name || "Unknown Subject"}</div>
                                  <div className="space-y-0.5">
                                    {isSectionView && (
                                      <div className="text-[8px] font-bold text-slate-600 bg-slate-100/50 py-0.5 px-1 rounded flex items-center justify-center gap-1 border border-slate-200/50">
                                        <div className="w-1 h-1 rounded-full bg-primary/60"></div> {entry.faculty?.name || "Unknown"}
                                      </div>
                                    )}
                                    {isFacultyView && (
                                      <div className="text-[8px] font-bold text-slate-600 bg-slate-100/50 py-0.5 px-1 rounded flex items-center justify-center gap-1 border border-slate-200/50">
                                        <div className="w-1 h-1 rounded-full bg-indigo-500/60"></div> {entry.section?.name || "Unknown"}
                                      </div>
                                    )}
                                    <div className="text-[7px] font-black text-slate-400 uppercase tracking-wide flex items-center justify-center gap-0.5 group">
                                      <div className="w-0.5 h-0.5 bg-slate-200 group-hover:bg-primary/40 rounded-full transition-colors"></div>
                                      R{entry.classroom?.roomNumber || "N/A"}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-slate-200 font-black tracking-widest text-[10px] uppercase flex items-center justify-center gap-2">
                                  <div className="w-4 h-px bg-slate-100"></div> Free <div className="w-4 h-px bg-slate-100"></div>
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
            )}
          </div>
        </div>
      </main>
      <style>{`
        @media print {
          @page { margin: 1cm; size: landscape; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          .vertical-text {
            writing-mode: vertical-rl;
            text-orientation: mixed;
          }
        }
      `}</style>
    </div>
  );
}
