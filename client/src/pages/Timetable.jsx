import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyStateCard } from "@/components/layout/EmptyStateCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Download,
  RefreshCw,
  User,
  Calendar,
  BookOpen,
  Clock,
  Building2,
  LayoutGrid,
  GraduationCap,
  MapPin,
  Sparkles,
  Wand2,
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  useTimetable,
  useGenerateTimetable,
  useRegenerateAll,
  useGenerationStatus,
} from "@/hooks/use-timetable";
import {
  useDepartments,
  useSections,
  useTimeSlots,
  useFaculty,
  useSubjects,
} from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { TimetableGrid } from "@/components/TimetableGrid";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";

export default function TimetablePage() {
  const [selectedDept, setSelectedDept] = useState(
    () => localStorage.getItem("tt_selectedDept") || "",
  );
  const [selectedSection, setSelectedSection] = useState(
    () => localStorage.getItem("tt_selectedSection") || "",
  );
  const [selectedFaculty, setSelectedFaculty] = useState(
    () => localStorage.getItem("tt_selectedFaculty") || "",
  );

  const { user } = useUser();
  const isOwner = user?.workspace?.role === "owner";

  const updateDept = (val) => {
    const newVal = val === "none" ? "" : val;
    setSelectedDept(newVal);
    if (newVal) {
      localStorage.setItem("tt_selectedDept", newVal);
    } else {
      localStorage.removeItem("tt_selectedDept");
    }
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

  // Handle Escape key to clear selections
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setSelectedDept("");
        setSelectedSection("");
        setSelectedFaculty("");
        localStorage.removeItem("tt_selectedDept");
        localStorage.removeItem("tt_selectedSection");
        localStorage.removeItem("tt_selectedFaculty");
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const { data: departments } = useDepartments();
  const { data: sections } = useSections();
  const { data: timeSlots } = useTimeSlots();
  const { data: faculty } = useFaculty();
  const { data: subjects } = useSubjects();

  const filteredSections = sections?.filter(
    (s) => !selectedDept || s.departmentId.toString() === selectedDept,
  );

  const filteredFaculty = useMemo(() => {
    if (!selectedDept) return faculty;
    // Faculty belonging to this dept
    const deptFacultyIds = new Set(
      faculty
        ?.filter((f) => f.departmentId.toString() === selectedDept)
        .map((f) => f.id),
    );
    // Also include faculty who teach any subject in this department
    subjects
      ?.filter((s) => s.departmentId.toString() === selectedDept && s.facultyId)
      .forEach((s) => {
        deptFacultyIds.add(s.facultyId);
      });
    return faculty?.filter((f) => deptFacultyIds.has(f.id));
  }, [faculty, subjects, selectedDept]);

  const normalizedSection =
    selectedSection && selectedSection !== "none" && selectedSection !== "all"
      ? selectedSection
      : "";
  const normalizedFaculty =
    selectedFaculty && selectedFaculty !== "none" ? selectedFaculty : "";
  const isSectionView = Boolean(normalizedSection) || selectedSection === "all";
  const isFacultyView = Boolean(normalizedFaculty);

  const { data: timetable, isLoading: isLoadingTimetable } = useTimetable({
    sectionId: normalizedSection,
    facultyId: normalizedFaculty,
  });

  const generateMutation = useGenerateTimetable();
  const regenerateAllMutation = useRegenerateAll();
  const generationStatus = useGenerationStatus();

  const isGenerating =
    generationStatus.isPolling || regenerateAllMutation.isPending;

  const handleGenerate = () => {
    if (
      !confirm(
        "This will regenerate timetables for all sections. The current timetable will only be replaced after the new one is fully ready. Continue?",
      )
    )
      return;

    regenerateAllMutation.mutate(null, {
      onSuccess: (data) => {
        // API returned instantly with jobId — start polling
        generationStatus.startPolling(data.jobId);
      },
      onError: (err) => {
        toast({
          title: "Failed to start",
          description: err.message,
          variant: "destructive",
        });
      },
    });
  };

  // React to generation completion/failure
  useEffect(() => {
    if (!generationStatus.data) return;
    const { status, completedSections, totalSections, failedSections, error } =
      generationStatus.data;

    if (status === "completed") {
      toast({
        title: "✅ Generation Complete!",
        description: `Successfully generated timetables for ${totalSections} section(s).`,
      });
      // Reset after a short delay so the user sees the success state
      setTimeout(() => generationStatus.reset(), 2000);
    } else if (status === "partial") {
      toast({
        title: "⚠️ Partial Success",
        description: `${completedSections - failedSections} of ${totalSections} sections succeeded. ${failedSections} failed.`,
        variant: "destructive",
      });
      setTimeout(() => generationStatus.reset(), 3000);
    } else if (status === "failed") {
      toast({
        title: "❌ Generation Failed",
        description: error || "All sections failed to generate.",
        variant: "destructive",
      });
      setTimeout(() => generationStatus.reset(), 3000);
    }
  }, [generationStatus.data]);

  // Helper functions moved to TimetableGrid

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const uniqueSlots = useMemo(() => {
    if (!timeSlots) return [];

    const slotsByTime = new Map();
    timeSlots.forEach((slot) => {
      const key = `${slot.label}-${slot.startTime}-${slot.endTime}`;
      if (!slotsByTime.has(key)) {
        slotsByTime.set(key, {
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          idsByDay: {},
        });
      }
      slotsByTime.get(key).idsByDay[slot.dayOfWeek] = slot.id;
    });

    return Array.from(slotsByTime.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }, [timeSlots]);

  const activeDays = days.filter((day) =>
    timeSlots?.some((slot) => slot.dayOfWeek === day),
  );

  // formatTime moved to TimetableGrid

  const selectedDeptData = departments?.find(
    (d) => d.id.toString() === selectedDept,
  );
  const selectedSectionData = sections?.find(
    (s) => s.id.toString() === selectedSection,
  );
  const selectedFacultyData = faculty?.find(
    (f) => f.id.toString() === selectedFaculty,
  );

  // tableSubjects moved to TimetableGrid

const conflictCount = (() => {
    // Likely conflict proxy: multiple entries for same slot + day.
    const map = new Map();
    if (!Array.isArray(timetable)) return 0;
    timetable.forEach((t) => {
      const day = t.timeSlot?.dayOfWeek;
      const slotId = t.timeSlotId;
      if (!day || !slotId) return;
      const key = `${day}-${slotId}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    let conflicts = 0;
    for (const [, c] of map.entries()) {
      if (c > 1) conflicts += c - 1;
    }
    return conflicts;
  })();

  return (
    <AppShell
      pageTitle="Timetable"
      pageSubtitle="Generate, visualize, and audit weekly schedules"
      rightActions={
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            className="gap-2 h-10 px-4 border-slate-200 hover:border-teal-300 hover:text-teal-700 transition-all rounded-xl font-bold text-sm"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" /> Print
          </Button>
          {isOwner && (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="premium-gradient gap-2 h-10 px-5 shadow-lg shadow-teal-500/25 rounded-xl font-bold text-sm"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Regenerate All</>
              )}
            </Button>
          )}
        </div>
      }
      stats={
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Potential Conflicts", value: conflictCount,     unit: "cells", color: conflictCount > 0 ? "#e11d48" : "#059669" },
            { label: "Active Days",          value: activeDays.length, unit: "days",  color: "#0891b2" },
            { label: "Time Slots",           value: uniqueSlots.length, unit: "slots", color: "#d97706" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5" style={{ boxShadow: `0 2px 16px -4px ${s.color}22` }}>
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">{s.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-display font-black text-slate-900">{s.value}</span>
                <span className="text-sm font-semibold text-slate-400 mb-1">{s.unit}</span>
              </div>
              <div className="h-1 rounded-full mt-3" style={{ background: `${s.color}22` }}>
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, s.value > 0 ? Math.max(20, (s.value / Math.max(s.value, 10)) * 100) : 0)}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <AnimatePresence>
        {(isGenerating ||
          (generationStatus.data &&
            ["completed", "partial", "failed"].includes(
              generationStatus.data.status,
            ))) && (
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
              const progress =
                total > 0 ? Math.round((completed / total) * 100) : 0;

              if (status === "completed") {
                return (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <CheckCircle2 className="w-24 h-24 text-emerald-400" />
                    </motion.div>
                    <h2 className="text-4xl font-display font-black tracking-tight text-white text-center mt-6">
                      All Done!
                    </h2>
                    <p className="mt-3 text-slate-300 text-xl font-medium">
                      All {total} sections generated successfully.
                    </p>
                  </>
                );
              }

              if (status === "partial") {
                return (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <AlertTriangle className="w-24 h-24 text-amber-400" />
                    </motion.div>
                    <h2 className="text-4xl font-display font-black tracking-tight text-white text-center mt-6">
                      Partially Complete
                    </h2>
                    <p className="mt-3 text-slate-300 text-xl font-medium">
                      {completed - failed} of {total} sections succeeded.{" "}
                      {failed} failed.
                    </p>
                  </>
                );
              }

              if (status === "failed") {
                return (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <XCircle className="w-24 h-24 text-rose-400" />
                    </motion.div>
                    <h2 className="text-4xl font-display font-black tracking-tight text-white text-center mt-6">
                      Generation Failed
                    </h2>
                    <p className="mt-3 text-slate-300 text-xl font-medium">
                      {generationStatus.data?.error ||
                        "Unable to solve constraints."}
                    </p>
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
                      : "Preparing sections..."}
                  </p>

                  {/* Real progress bar */}
                  <div className="mt-8 w-80 space-y-3">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-indigo-300">
                        {completed} / {total} sections
                      </span>
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
                        <AlertTriangle className="w-3 h-3" /> {failed}{" "}
                        section(s) had issues
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
                    <p className="text-sm text-indigo-200">
                      Each section is solved independently to avoid conflicts
                      and ensure fast results.
                    </p>
                  </motion.div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-3 lg:p-0 print:m-0 print:p-0 overflow-y-auto">
        <div className="max-w-full mx-auto space-y-4">
          <div className="print:hidden">
            <Card className="p-3 lg:p-4 border border-slate-100 bg-white rounded-2xl" style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06)" }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Department
                  </label>
                  <Select value={selectedDept} onValueChange={updateDept}>
                    <SelectTrigger className="h-10 bg-slate-50 border-transparent hover:border-teal-300 focus:ring-teal-500 rounded-xl font-bold text-slate-900 text-sm">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="rounded-lg font-medium italic">None</SelectItem>
                      {departments?.map((d) => (<SelectItem key={d.id} value={d.id.toString()} className="rounded-lg font-medium">{d.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <LayoutGrid className="w-3 h-3" /> Class / Cohort
                  </label>
                  <Select disabled={!selectedDept} value={selectedSection} onValueChange={updateSection}>
                    <SelectTrigger className="h-10 bg-slate-50 border-transparent hover:border-teal-300 focus:ring-teal-500 rounded-xl font-bold text-slate-900 text-sm">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="rounded-lg font-medium italic">None Selected</SelectItem>
                      <SelectItem value="all" className="rounded-lg font-bold text-teal-600">Whole Department</SelectItem>
                      {filteredSections?.map((s) => (<SelectItem key={s.id} value={s.id.toString()} className="rounded-lg font-medium">{s.name} (S{s.semester})</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <GraduationCap className="w-3 h-3" /> Faculty
                  </label>
                  <Select disabled={!selectedDept} value={selectedFaculty} onValueChange={updateFaculty}>
                    <SelectTrigger className="h-10 bg-slate-50 border-transparent hover:border-teal-300 focus:ring-teal-500 rounded-xl font-bold text-slate-900 text-sm">
                      <SelectValue placeholder="Select Faculty" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="rounded-lg font-medium italic">None Selected</SelectItem>
                      {filteredFaculty?.map((f) => (<SelectItem key={f.id} value={f.id.toString()} className="rounded-lg font-medium">{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 items-start">
            <div>
              <AnimatePresence mode="wait">
                {!isSectionView && !isFacultyView ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center print:hidden"
                  >
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-display font-black text-slate-900">
                      Pick a scope to open the schedule
                    </h3>
                    <p className="text-slate-500 mt-2 max-w-md mx-auto font-medium">
                      Select a department and then either a class cohort or a
                      faculty member to view the weekly timetable grid.
                    </p>
                  </motion.div>
                ) : isLoadingTimetable ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center gap-3 print:hidden"
                  >
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                    <p className="text-lg font-black text-slate-900">
                      Rendering timetable workspace…
                    </p>
                  </motion.div>
                ) : selectedSection === "all" ? (
                  <div key="all-sections" className="space-y-8">
                    {filteredSections?.map((section) => (
                      <TimetableGrid
                        key={`sec-${section.id}`}
                        user={user}
                        entityData={section}
                        entityType="section"
                        departmentData={selectedDeptData}
                        timetableData={timetable?.filter(
                          (t) => t.sectionId === section.id,
                        )}
                        uniqueSlots={uniqueSlots}
                        activeDays={activeDays}
                        subjects={subjects}
                        facultyList={faculty}
                        sectionsList={sections}
                        isWebVisible={true}
                      />
                    ))}
                    {filteredFaculty?.map((fac) => (
                      <TimetableGrid
                        key={`fac-${fac.id}`}
                        user={user}
                        entityData={fac}
                        entityType="faculty"
                        departmentData={selectedDeptData}
                        timetableData={timetable?.filter(
                          (t) => t.facultyId === fac.id,
                        )}
                        uniqueSlots={uniqueSlots}
                        activeDays={activeDays}
                        subjects={subjects}
                        facultyList={faculty}
                        sectionsList={sections}
                        isWebVisible={false}
                      />
                    ))}
                  </div>
                ) : (
                  <TimetableGrid
                    key="single-grid"
                    user={user}
                    entityData={
                      isSectionView ? selectedSectionData : selectedFacultyData
                    }
                    entityType={isSectionView ? "section" : "faculty"}
                    departmentData={selectedDeptData}
                    timetableData={timetable}
                    uniqueSlots={uniqueSlots}
                    activeDays={activeDays}
                    subjects={subjects}
                    facultyList={faculty}
                    sectionsList={sections}
                    isWebVisible={true}
                  />
                )}
              </AnimatePresence>
            </div>


          </div>
        </div>
      </main>

      <style>{`
        @media print {


          @page { 
            margin: 0.5cm; 
            size: landscape; 
          }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact;
            zoom: 0.85;
          }
          .print\:m-0 { margin: 0 !important; }
          .print\:p-0 { padding: 0 !important; }
          .vertical-text {
            writing-mode: vertical-rl;
            text-orientation: mixed;
          }
          table { page-break-inside: avoid; }
          .course-table { font-size: 8pt !important; }
          .timetable-cell { height: auto !important; padding: 2px !important; }
        }
      `}</style>
    </AppShell>
  );
}
