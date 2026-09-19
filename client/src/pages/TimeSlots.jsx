import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Pencil, Download, Loader2, Clock, CalendarDays, Settings2, ChevronRight } from "lucide-react";
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToExcel } from "@/lib/export-excel";
import { ImportDialog } from "@/components/ImportDialog";
import { ExportHint } from "@/components/ExportHint";
import { motion, AnimatePresence } from "framer-motion";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function normalizeDay(d) {
  if (typeof d === "number") return DAYS[d] || DAYS[0];
  if (typeof d === "string") {
    const num = parseInt(d, 10);
    if (!isNaN(num) && DAYS[num]) return DAYS[num];
    if (DAYS.includes(d)) return d;
    // Capitalize first letter if needed
    const found = DAYS.find(day => day.toLowerCase() === d.toLowerCase());
    if (found) return found;
  }
  return "Monday";
}

function TimePicker({ value, onChange }) {
  const valStr = typeof value === "string" ? value : "09:00";
  const parts = valStr.split(":");
  const hours = parts[0] || "09";
  const minutes = parts[1] || "00";
  const hNum = parseInt(hours, 10) || 9;
  const isPM = hNum >= 12;
  const displayHours = hNum % 12 || 12;

  const updateTime = (newH, newM, newIsPM) => {
    let finalH = parseInt(newH, 10) % 12;
    if (newIsPM) finalH += 12;
    const timeStr = `${finalH.toString().padStart(2, "0")}:${(newM || "00").toString().padStart(2, "0")}`;
    if (onChange) onChange(timeStr);
  };

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm w-fit max-w-full overflow-hidden">
      <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm">
        <Select value={displayHours.toString()} onValueChange={(h) => updateTime(h, minutes, isPM)}>
          <SelectTrigger className="w-[58px] h-9 border-0 bg-transparent ring-0 focus:ring-0 rounded-md font-black text-slate-900 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-100">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <SelectItem key={h} value={h.toString()} className="font-bold">{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-slate-300 font-black px-0.5 text-[10px]">:</span>
        <Select value={minutes} onValueChange={(m) => updateTime(displayHours, m, isPM)}>
          <SelectTrigger className="w-[58px] h-9 border-0 bg-transparent ring-0 focus:ring-0 rounded-md font-black text-slate-900 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-100">
            {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
              <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex bg-slate-200/40 p-0.5 rounded-lg gap-0.5 border border-slate-200/30">
        <button
          type="button"
          className={`px-2.5 py-1.5 text-[9px] font-black rounded-md transition-all duration-300 ${!isPM ? 'premium-gradient text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => updateTime(displayHours, minutes, false)}
        >
          AM
        </button>
        <button
          type="button"
          className={`px-2.5 py-1.5 text-[9px] font-black rounded-md transition-all duration-300 ${isPM ? 'premium-gradient text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => updateTime(displayHours, minutes, true)}
        >
          PM
        </button>
      </div>
    </div>
  );
}

function BulkTimeSlotDialog({ onSuccess, editingGroup = null, onClose }) {
  const { toast } = useToast();
  const createMutation = useCreateTimeSlot();
  const updateMutation = useUpdateTimeSlot();
  const deleteMutation = useDeleteTimeSlot();
  
  const form = useForm({
    defaultValues: editingGroup ? {
      days: editingGroup.map(s => normalizeDay(s.dayOfWeek)),
      label: editingGroup[0]?.label || "Period 1",
      startTime: editingGroup[0]?.startTime || "09:00",
      endTime: editingGroup[0]?.endTime || "10:00"
    } : {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      label: "Period 1",
      startTime: "09:00",
      endTime: "10:00"
    }
  });

  const onSubmit = async (values) => {
    try {
      if (editingGroup) {
        if (!values.days || values.days.length === 0) {
          toast({ title: "Configuration Error", description: "Select at least one day for this slot group", variant: "destructive" });
          return;
        }

        const newDays = [...values.days];
        
        for (const oldSlot of editingGroup) {
          const oldDay = normalizeDay(oldSlot.dayOfWeek);
          const dayIndex = newDays.indexOf(oldDay);
          if (dayIndex !== -1) {
            await updateMutation.mutateAsync({
              id: oldSlot.id,
              dayOfWeek: oldDay,
              label: values.label,
              startTime: values.startTime,
              endTime: values.endTime
            });
            newDays.splice(dayIndex, 1);
          } else {
            await deleteMutation.mutateAsync(oldSlot.id);
          }
        }
        
        for (const day of newDays) {
          await createMutation.mutateAsync({
            dayOfWeek: day,
            label: values.label,
            startTime: values.startTime,
            endTime: values.endTime
          });
        }
        toast({ title: "Group Sync Complete", description: "All instances of this time slot have been synchronized." });
      } else {
        if (!values.days || values.days.length === 0) {
          toast({ title: "Configuration Error", description: "At least one target day is required", variant: "destructive" });
          return;
        }
        for (const day of values.days) {
          await createMutation.mutateAsync({
            dayOfWeek: day,
            label: values.label,
            startTime: values.startTime,
            endTime: values.endTime
          });
        }
        toast({ title: "Generation Successful", description: `Injected periods across ${values.days.length} academic days` });
      }
      onSuccess();
      if (onClose) onClose();
    } catch (error) {
      toast({ title: "Transaction Failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="days"
          render={() => (
            <FormItem>
              <FormLabel className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-500" /> Scope of Application (Days)
              </FormLabel>
              <div className="flex flex-wrap gap-2 pt-2">
                {DAYS.map((day) => (
                  <FormField
                    key={day}
                    control={form.control}
                    name="days"
                    render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => {
                          const checked = field.value?.includes(day);
                          return checked
                            ? field.onChange(field.value?.filter((value) => value !== day))
                            : field.onChange([...(field.value || []), day]);
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                          field.value?.includes(day)
                            ? 'premium-gradient text-white border-teal-500 shadow-lg shadow-teal-500/20 scale-105'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:text-slate-700'
                        }`}
                      >
                        {day.slice(0, 3).toUpperCase()}
                      </button>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" /> Academic Period Label
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input className="h-14 pl-12 rounded-2xl bg-slate-50/50 border-slate-100 border-2 font-black text-slate-900 focus:border-indigo-500 focus:bg-white transition-all" placeholder="e.g. Period 1 or Lunch Break" {...field} />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-5 rounded-[2.5rem] border border-slate-100">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Interval Start</FormLabel>
                <FormControl>
                  <TimePicker value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Interval End</FormLabel>
                <FormControl>
                  <TimePicker value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full h-14 premium-gradient shadow-2xl shadow-indigo-500/20 text-lg font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
          {editingGroup ? "Synchronize Updates" : "Create Active Periods"}
        </Button>
      </form>
    </Form>
  );
}

export default function TimeSlots() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const { toast } = useToast();
  const { data: timeSlots, isLoading, refetch } = useTimeSlots();
  const deleteMutation = useDeleteTimeSlot();

  const handleExport = async () => {
    const data = timeSlots?.map(slot => ({
      Day: normalizeDay(slot.dayOfWeek),
      Label: slot.label,
      "Start Time": slot.startTime,
      "End Time": slot.endTime
    }));
    await exportToExcel({
      kind: "TimeSlots",
      data: data || [],
      defaultFileName: "timeslots_export.xlsx",
      toast
    });
  };

  const uniquePeriods = useMemo(() => {
    if (!Array.isArray(timeSlots)) return [];
    const seen = new Set();
    return timeSlots
      .filter(slot => {
        if (!slot) return false;
        const key = `${slot.label || ""}-${slot.startTime || ""}-${slot.endTime || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [timeSlots]);

  const handleEdit = (prototypeSlot) => {
    if (!Array.isArray(timeSlots)) return;
    const relatedSlots = timeSlots.filter(s => 
      s &&
      s.label === prototypeSlot.label && 
      s.startTime === prototypeSlot.startTime && 
      s.endTime === prototypeSlot.endTime
    );
    setEditGroup(relatedSlots);
  };

  const formatTime = (time24) => {
    if (!time24 || typeof time24 !== "string") return "09:00 AM";
    const parts = time24.split(":");
    const h = parts[0] || "09";
    const m = parts[1] || "00";
    const hNum = parseInt(h, 10) || 9;
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const h12 = hNum % 12 || 12;
    return `${h12}:${m.padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="page-hero px-5 lg:px-8 pt-16 lg:pt-7 pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#d9770622,#f59e0b33)" }}>
                    <Settings2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Master Data / Time Slots</div>
                </div>
                <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight">Time Slots</h1>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Orchestrate academic intervals and period synchronization.</p>
              </motion.div>
              
              <div className="flex items-center gap-2.5 flex-wrap">
                <ImportDialog kind="timeslots" />
                <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700" onClick={handleExport}>
                  <Download className="w-4 h-4" /> Export
                </Button>
                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 h-10 px-5 rounded-xl text-sm font-bold premium-gradient shadow-lg shadow-teal-500/20">
                      <Plus className="w-4 h-4" /> Add Period
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl rounded-2xl border border-slate-100 p-8 shadow-2xl bg-white">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="text-xl font-display font-black text-slate-900">Define Custom Interval</DialogTitle>
                    </DialogHeader>
                    <BulkTimeSlotDialog onSuccess={refetch} onClose={() => setBulkOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto space-y-4">
            <ExportHint />

            <Dialog open={!!editGroup} onOpenChange={(v) => !v && setEditGroup(null)}>
              <DialogContent className="sm:max-w-xl rounded-2xl border border-slate-100 p-8 shadow-2xl bg-white">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-xl font-display font-black text-slate-900">Modify Period</DialogTitle>
                </DialogHeader>
                {editGroup && <BulkTimeSlotDialog editingGroup={editGroup} onSuccess={refetch} onClose={() => setEditGroup(null)} />}
              </DialogContent>
            </Dialog>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
              style={{ boxShadow: "0 2px 16px -4px rgba(0,0,0,0.06)" }}
            >
              <div className="grid grid-cols-[2fr_1.5fr_2fr_auto] items-center px-6 py-3 bg-slate-50/80 border-b border-slate-100 gap-4">
                {["Period Label","Time Range","Active Days","Action"].map(h => (
                  <div key={h} className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 text-left">{h}</div>
                ))}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-500" /></div>
              ) : uniquePeriods.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-semibold text-sm">No time slots defined yet.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="divide-y divide-slate-50">
                    {uniquePeriods.map((slot) => {
                      const activeDaysGroup = Array.from(new Set(
                        (Array.isArray(timeSlots) ? timeSlots : [])
                          .filter(s => s && s.label === slot.label && s.startTime === slot.startTime)
                          .map(s => normalizeDay(s.dayOfWeek))
                      )).sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
                      const isBreak = (slot.label || "").toLowerCase().includes("break") || (slot.label || "").toLowerCase().includes("lunch");

                      return (
                        <motion.div
                          key={`${slot.label}-${slot.startTime}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="grid grid-cols-[2fr_1.5fr_2fr_auto] items-center px-6 py-4 gap-4 group hover:bg-slate-50/60 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBreak ? "bg-amber-50" : "bg-teal-50"}`}>
                              <Clock className={`w-4 h-4 ${isBreak ? "text-amber-500" : "text-teal-500"}`} />
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{slot.label}</span>
                            {isBreak && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">Break</span>}
                          </div>

                          <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 w-fit">
                            {formatTime(slot.startTime)}
                            <ChevronRight className="w-3 h-3 text-teal-300" />
                            {formatTime(slot.endTime)}
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {activeDaysGroup.map(d => {
                              const dayStr = String(d || "");
                              const shortName = dayStr.length >= 3 ? dayStr.slice(0, 3) : dayStr || "Day";
                              return (
                                <span key={dayStr} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[9px] font-black uppercase tracking-wide rounded border border-teal-100">
                                  {shortName}
                                </span>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleEdit(slot)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete all ${activeDaysGroup.length} instances of this period?`)) {
                                  (timeSlots || [])
                                    .filter(s => s && s.label === slot.label && s.startTime === slot.startTime)
                                    .forEach(s => deleteMutation.mutate(s.id));
                                }
                              }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              )}

              {!isLoading && uniquePeriods.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-slate-400">{uniquePeriods.length} period{uniquePeriods.length !== 1 ? "s" : ""} defined</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
