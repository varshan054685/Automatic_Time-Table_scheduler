import { useState, useMemo, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Download, RefreshCw, User, Calendar, BookOpen, Clock, Building2, LayoutGrid, GraduationCap, MapPin, Sparkles, Wand2, FileText, Printer, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useTimetable, useGenerateTimetable, useRegenerateAll, useGenerationStatus } from "@/hooks/use-timetable";
import { useDepartments, useSections, useTimeSlots, useFaculty, useSubjects } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";

export default function TimetablePage() {
  const [selectedDept, setSelectedDept] = useState(() => localStorage.getItem("tt_selectedDept") || "");
  const [selectedSection, setSelectedSection] = useState(() => localStorage.getItem("tt_selectedSection") || "");
  const [selectedFaculty, setSelectedFaculty] = useState(() => localStorage.getItem("tt_selectedFaculty") || "");

  const { user } = useUser();
  const isOwner = user?.workspace?.role === "owner";

  const updateDept = (val) => {
    setSelectedDept(val);
    localStorage.setItem("tt_selectedDept", val);
    setSelectedSection("");
    localStorage.removeItem("tt_selectedSection");
    setSelectedFaculty("");
    localStorage.removeItem("tt_selectedFaculty");
  };

  const updateSection = (val) => {
    setSelectedSection(val);
    localStorage.setItem("tt_selectedSection", val);
    setSelectedFaculty("");
    localStorage.removeItem("tt_selectedFaculty");
  };

  const updateFaculty = (val) => {
    setSelectedFaculty(val);
    localStorage.setItem("tt_selectedFaculty", val);
    setSelectedSection("");
    localStorage.removeItem("tt_selectedSection");
  };
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
  const regenerateAllMutation = useRegenerateAll();
  const generationStatus = useGenerationStatus();

  const isGenerating = generationStatus.isPolling || regenerateAllMutation.isPending;

  const handleGenerate = () => {
    if (!confirm("This will regenerate timetables for all sections. The current timetable will only be replaced after the new one is fully ready. Continue?")) return;
    
    regenerateAllMutation.mutate(null, {
      onSuccess: (data) => {
        // API returned instantly with jobId — start polling
        generationStatus.startPolling(data.jobId);
      },
      onError: (err) => {
        toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      }
    });
  };

  // React to generation completion/failure
  useEffect(() => {
    if (!generationStatus.data) return;
    const { status, completedSections, totalSections, failedSections, error } = generationStatus.data;

    if (status === "completed") {
      toast({ 
        title: "✅ Generation Complete!", 
        description: `Successfully generated timetables for ${totalSections} section(s).` 
      });
      // Reset after a short delay so the user sees the success state
      setTimeout(() => generationStatus.reset(), 2000);
    } else if (status === "partial") {
      toast({ 
        title: "⚠️ Partial Success", 
        description: `${completedSections - failedSections} of ${totalSections} sections succeeded. ${failedSections} failed.`,
        variant: "destructive" 
      });
      setTimeout(() => generationStatus.reset(), 3000);
    } else if (status === "failed") {
      toast({ 
        title: "❌ Generation Failed", 
        description: error || "All sections failed to generate.",
        variant: "destructive" 
      });
      setTimeout(() => generationStatus.reset(), 3000);
    }
  }, [generationStatus.data]);

  const getEntry = (day, slotId) => {
    if (!slotId) return null;
    return timetable?.find(t =>
      t.timeSlotId === slotId &&
      (t.timeSlot ? t.timeSlot.dayOfWeek === day : true)
    ) ?? null;
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
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AnimatePresence>
        {(isGenerating || (generationStatus.data && ["completed", "partial", "failed"].includes(generationStatus.data.status))) && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl flex flex-col items-center justify-center text-white p-6"
          >
            {(() => {
              const status = generationStatus.data?.status || "processing";
              const completed = generationStatus.data?.completedSections || 0;
              const total = generationStatus.data?.totalSections || 0;
              const failed = generationStatus.data?.failedSections || 0;
              const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

              if (status === "completed") {
                return (
                  <>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                      <CheckCircle2 className="w-24 h-24 text-emerald-400" />
                    </motion.div>
                    <h2 className="text-4xl font-display font-black tracking-tight text-white text-center mt-6">All Done!</h2>
                    <p className="mt-3 text-slate-300 text-xl font-medium">All {total} sections generated successfully.</p>
                  </>
                );
              }

              if (status === "partial") {
                return (
                  <>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                      <AlertTriangle className="w-24 h-24 text-amber-400" />
                    </motion.div>
                    <h2 className="text-4xl font-display font-black tracking-tight text-white text-center mt-6">Partially Complete</h2>
                    <p className="mt-3 text-slate-300 text-xl font-medium">{completed - failed} of {total} sections succeeded. {failed} failed.</p>
                  </>
                );
              }

              if (status === "failed") {
                return (
                  <>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                      <XCircle className="w-24 h-24 text-rose-400" />
                    </motion.div>
                    <h2 className="text-4xl font-display font-black tracking-tight text-white text-center mt-6">Generation Failed</h2>
                    <p className="mt-3 text-slate-300 text-xl font-medium">{generationStatus.data?.error || "Unable to solve constraints."}</p>
                  </>
                );
              }

              // Processing state with real progress
              return (
                <>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 group-hover:scale-175 transition-all duration-1000"></div>
                    <Wand2 className="w-24 h-24 mb-6 text-indigo-400 animate-pulse relative z-10" />
                  </div>
                  <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-display font-black tracking-tight text-white text-center"
                  >
                    Orchestrating Your Timetable
                  </motion.h2>
                  <p className="mt-4 text-slate-300 text-xl font-medium text-center max-w-lg">
                    {total > 0 
                      ? `Solving section ${Math.min(completed + 1, total)} of ${total}...`
                      : "Preparing sections..."
                    }
                  </p>

                  {/* Real progress bar */}
                  <div className="mt-8 w-80 space-y-3">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-indigo-300">{completed} / {total} sections</span>
                      <span className="text-slate-400">{progress}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                      />
                    </div>
                    {failed > 0 && (
                      <p className="text-amber-400 text-xs font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {failed} section(s) had issues
                      </p>
                    )}
                  </div>

                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 5 }}
                    className="mt-10 bg-indigo-500/10 border border-indigo-500/20 px-6 py-4 rounded-2xl flex items-center gap-4 max-w-md"
                  >
                    <Sparkles className="w-6 h-6 text-indigo-400 shrink-0" />
                    <p className="text-sm text-indigo-200">Each section is solved independently to avoid conflicts and ensure fast results.</p>
                  </motion.div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="print:hidden">
        <Sidebar />
      </div>

      <main className="flex-1 p-4 lg:p-8 print:m-0 print:p-0 overflow-y-auto">
        <div className="hidden print:block w-full text-[10pt] font-sans leading-tight">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-4">
            <div className="w-24 h-24 bg-primary/10 flex items-center justify-center rounded-lg">
              <img src="/logo.svg" alt="Learn Beyond" className="w-16 h-16 opacity-50" />
            </div>
            <div className="text-center flex-1">
              <h2 className="text-xl font-bold uppercase">{user?.workspace?.workspaceName || 'Your Institution'}</h2>
              <p className="text-xs italic">(Official Timetable Document)</p>
              <h3 className="text-lg font-semibold mt-1">Academic Management System</h3>
              <h4 className="text-md font-bold underline">Class Time Table</h4>
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
              <div className="border-b border-slate-900 p-1">{selectedDeptData?.name || "N/A"}</div>
              <div className="border-b border-r border-slate-900 p-1 font-bold">Focus</div>
              <div className="border-b border-slate-900 p-1">{selectedSectionData ? `Semester ${selectedSectionData.semester}` : "N/A"}</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="border-b border-r border-slate-900 p-1 font-bold">Entity View</div>
              <div className="border-b border-slate-900 p-1">{isSectionView ? 'Class Schedule' : isFacultyView ? 'Faculty Load' : 'General'}</div>
              <div className="border-b border-r border-slate-900 p-1 font-bold">Class/Faculty</div>
              <div className="border-b border-slate-900 p-1">{selectedSectionData?.name || selectedFacultyData?.name || "N/A"}</div>
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

          <div className="border-y border-x border-slate-900 mb-8">
            <table className="w-full border-collapse text-[9pt]">
              <thead>
                <tr className="bg-slate-100/80 font-bold">
                  <td className="border border-slate-900 p-1 w-12 text-center">S.No</td>
                  <td className="border border-slate-900 p-1 text-center">COURSE NAME</td>
                  <td className="border border-slate-900 p-1 w-32 text-center">CODE</td>
                  <td className="border border-slate-900 p-1 w-48 text-center">{isSectionView ? 'FACULTY' : 'SECTION'}</td>
                  <td className="border border-slate-900 p-1 w-24 text-center">HOURS</td>
                </tr>
              </thead>
              <tbody>
                {tableSubjects.map((subject, idx) => (
                  <tr key={subject.id}>
                    <td className="border border-slate-900 p-1 text-center font-bold">{idx + 1}</td>
                    <td className="border border-slate-900 p-1 px-4">{subject.name}</td>
                    <td className="border border-slate-900 p-1 text-center font-bold">{subject.code}</td>
                    <td className="border border-slate-900 p-1 text-center">{subject.facultyName}</td>
                    <td className="border border-slate-900 p-1 text-center font-bold">{subject.weeklyHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-end mt-16 mb-8 px-12">
            <div className="text-center font-bold">
              <div className="h-0.5 w-32 bg-slate-900 mb-2"></div>
              <p>Prepared By</p>
            </div>
            <div className="text-center font-bold">
               <div className="h-0.5 w-48 bg-slate-900 mb-2"></div>
               <p>Head of Department</p>
            </div>
            <div className="text-center font-bold">
               <div className="h-0.5 w-48 bg-slate-900 mb-2"></div>
               <p>Principal</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-8 pt-12 lg:pt-0 print:hidden">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Calendar className="w-6 h-6" />
                </div>
                <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">Timetable</h1>
              </div>
              <p className="text-slate-500 font-medium">Synchronize academic operations and manage visual schedules.</p>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3">
                <Button variant="outline" className="gap-2 h-12 px-6 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl font-bold" onClick={() => window.print()}>
                  <Printer className="w-4 h-4" /> Print PDF
                </Button>
                {isOwner && (
                    <Button 
                        onClick={handleGenerate} 
                        disabled={isGenerating}
                        className="premium-gradient premium-gradient-hover gap-2 h-12 px-8 shadow-xl shadow-indigo-500/20 rounded-xl font-black transition-all hover:scale-105 active:scale-95"
                    >
                        {isGenerating ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Orchestrating...</>
                        ) : (
                            <><RefreshCw className="w-5 h-5" /> Regenerate All</>
                        )}
                    </Button>
                )}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-8 border-0 shadow-sm border border-slate-100 rounded-[2rem] bg-white relative overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl opacity-50"></div>
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Building2 className="w-3 h-3" /> Core Department
                        </label>
                        <Select value={selectedDept} onValueChange={updateDept}>
                            <SelectTrigger className="h-14 bg-slate-50 border-transparent hover:border-indigo-200 focus:ring-indigo-500 rounded-2xl transition-all font-bold text-slate-900">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                            {departments?.map(d => (
                                <SelectItem key={d.id} value={d.id.toString()} className="rounded-xl font-medium">{d.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <LayoutGrid className="w-3 h-3" /> Class / Cohort
                        </label>
                        <Select disabled={!selectedDept} value={selectedSection} onValueChange={updateSection}>
                            <SelectTrigger className="h-14 bg-slate-50 border-transparent hover:border-indigo-200 focus:ring-indigo-500 rounded-2xl transition-all font-bold text-slate-900">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                            <SelectItem value="none" className="rounded-xl font-medium italic">None Selected</SelectItem>
                            {filteredSections?.map(s => (
                                <SelectItem key={s.id} value={s.id.toString()} className="rounded-xl font-medium">{s.name} (S{s.semester})</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <GraduationCap className="w-3 h-3" /> Faculty Load
                        </label>
                        <Select disabled={!selectedDept} value={selectedFaculty} onValueChange={updateFaculty}>
                            <SelectTrigger className="h-14 bg-slate-50 border-transparent hover:border-indigo-200 focus:ring-indigo-500 rounded-2xl transition-all font-bold text-slate-900">
                                <SelectValue placeholder="Select Faculty" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                            <SelectItem value="none" className="rounded-xl font-medium italic">None Selected</SelectItem>
                            {filteredFaculty?.map(f => (
                                <SelectItem key={f.id} value={f.id.toString()} className="rounded-xl font-medium">{f.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>
          </motion.div>

          <AnimatePresence mode="wait">
            {(!isSectionView && !isFacultyView) ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-32 text-center"
              >
                  <div className="w-24 h-24 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                    <Clock className="w-12 h-12" />
                  </div>
                  <h3 className="text-3xl font-display font-black text-slate-900">Timeline Empty</h3>
                  <p className="text-slate-400 mt-4 max-w-sm mx-auto text-lg leading-relaxed font-medium">Please select a class cohort or a faculty member to visualize their optimized weekly schedule.</p>
              </motion.div>
            ) : isLoadingTimetable ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-40 flex flex-col items-center justify-center gap-6"
              >
                  <Loader2 className="w-16 h-16 animate-spin text-indigo-600" />
                  <p className="text-xl font-black text-slate-900 animate-pulse tracking-tight">Synthesizing Visual Grid...</p>
              </motion.div>
            ) : (
                <motion.div 
                    key="table"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden"
                >
                    <div className="overflow-x-auto print:hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-6 text-left border-r border-slate-100 bg-slate-100/30 sticky left-0 z-10 w-40">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Node</span>
                                            <span className="text-sm font-bold text-slate-900">Cycle Day</span>
                                        </div>
                                    </th>
                                    {uniqueSlots.map((slot, idx) => (
                                        <th key={idx} className="p-6 text-center border-r border-slate-100 last:border-0 min-w-[200px]">
                                            <div className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl bg-white shadow-sm border border-slate-100/50">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${slot.label.toLowerCase().includes('break') ? 'text-rose-500' : 'text-indigo-600'}`}>
                                                    {slot.label}
                                                </span>
                                                <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-500">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activeDays.map((day, dIdx) => (
                                    <motion.tr 
                                        key={day}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: dIdx * 0.05 }}
                                        className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all"
                                    >
                                        <td className="p-6 bg-slate-50/20 border-r border-slate-100 sticky left-0 z-10 font-black text-slate-900 group-hover:bg-white transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-8 bg-indigo-500 rounded-full scale-y-50 group-hover:scale-y-100 transition-transform duration-500"></div>
                                                {day}
                                            </div>
                                        </td>
                                        {uniqueSlots.map((slot, sIdx) => {
                                            const slotIdForDay = slot.idsByDay[day];
                                            const entry = slotIdForDay ? getEntry(day, slotIdForDay) : null;
                                            const isBreak = slot.label.toLowerCase().includes('break') || slot.label.toLowerCase().includes('lunch');
                                            
                                            return (
                                                <td key={sIdx} className={`p-4 border-r border-slate-100 last:border-0 relative h-32 transition-all ${isBreak ? 'bg-slate-50/50' : ''}`}>
                                                    {isBreak ? (
                                                        <div className="flex flex-col items-center justify-center h-full opacity-20 group-hover:opacity-40 transition-opacity">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] rotate-0">{slot.label}</div>
                                                        </div>
                                                    ) : entry ? (
                                                        <motion.div 
                                                            layoutId={`entry-${entry.id}`}
                                                            className="flex flex-col justify-between h-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group-hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all"
                                                        >
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter ${entry.subject?.type === 'lab' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                                        {entry.subject?.type || 'Lecture'}
                                                                    </span>
                                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {entry.classroom?.roomNumber || "R??"}
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">
                                                                    {entry.subject?.name}
                                                                </h4>
                                                            </div>
                                                            
                                                            <div className="pt-3 border-t border-slate-50 flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                                                                    {(isSectionView ? entry.faculty?.name : entry.section?.name)?.charAt(0) || '?'}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-500 truncate">
                                                                    {isSectionView ? entry.faculty?.name : entry.section?.name}
                                                                </span>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-5 transition-opacity">
                                                            <Sparkles className="w-12 h-12 text-slate-600" />
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
          </AnimatePresence>
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
