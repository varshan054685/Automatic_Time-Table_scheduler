import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Calendar, Upload, Download, Loader2, Sparkles, Clock, CalendarDays, MousePointer2, Settings2, FileSpreadsheet, ChevronRight, Activity } from "lucide-react";
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion, AnimatePresence } from "framer-motion";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function TimePicker({ value, onChange }) {
  const [hours, minutes] = value.split(":");
  const hNum = parseInt(hours);
  const isPM = hNum >= 12;
  const displayHours = hNum % 12 || 12;

  const updateTime = (newH, newM, newIsPM) => {
    let finalH = parseInt(newH) % 12;
    if (newIsPM) finalH += 12;
    const timeStr = `${finalH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
    onChange(timeStr);
  };

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm w-fit max-w-full overflow-hidden">
      <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-100 shadow-sm">
        <Select value={displayHours.toString()} onValueChange={(h) => updateTime(h, minutes, isPM)}>
          <SelectTrigger className="w-[58px] h-9 border-0 bg-transparent ring-0 focus:ring-0 rounded-md font-black text-slate-900 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-100">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
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
            {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map(m => (
              <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex bg-slate-200/40 p-0.5 rounded-lg gap-0.5 border border-slate-200/30">
        <button
          type="button"
          className={`px-2.5 py-1.5 text-[9px] font-black rounded-md transition-all duration-300 ${!isPM ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => updateTime(displayHours, minutes, false)}
        >
          AM
        </button>
        <button
          type="button"
          className={`px-2.5 py-1.5 text-[9px] font-black rounded-md transition-all duration-300 ${isPM ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-700'}`}
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
      days: editingGroup.map(s => s.dayOfWeek),
      label: editingGroup[0].label,
      startTime: editingGroup[0].startTime,
      endTime: editingGroup[0].endTime
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
        if (values.days.length === 0) {
          toast({ title: "Configuration Error", description: "Select at least one day for this slot group", variant: "destructive" });
          return;
        }

        const newDays = [...values.days];
        
        for (const oldSlot of editingGroup) {
          const dayIndex = newDays.indexOf(oldSlot.dayOfWeek);
          if (dayIndex !== -1) {
            await updateMutation.mutateAsync({
              id: oldSlot.id,
              dayOfWeek: oldSlot.dayOfWeek,
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
        if (values.days.length === 0) {
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
                                    : field.onChange([...field.value, day])
                            }}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${
                                field.value?.includes(day)
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-500/25 scale-105'
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

function TimeSlotImport({ timeSlots, onImportComplete, variant = "outline" }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateTimeSlot();
  const updateMutation = useUpdateTimeSlot();

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const buffer = new Uint8Array(evt.target.result);
        const wb = XLSX.read(buffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;
        let errorCount = 0;

        // Erase all existing data to prevent duplication
        if (timeSlots && timeSlots.length > 0) {
          try {
            // Sequential deletion is safer for large datasets to avoid overloading the socket
            for (const s of timeSlots) {
              await deleteMutation.mutateAsync(s.id);
            }
          } catch (err) {
            console.error("Failed to delete existing time slots:", err);
          }
        }

        for (const item of data) {
          const dayOfWeek = item.Day || item.dayOfWeek;
          const label = item.Label || item.label;
          const startTime = item["Start Time"] || item.startTime;
          const endTime = item["End Time"] || item.endTime;

          if (dayOfWeek && label && startTime && endTime) {
            try {
              await createMutation.mutateAsync({
                dayOfWeek,
                label,
                startTime,
                endTime
              });
              successCount++;
            } catch (err) {
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Chain Resolved", 
          description: `Ingested ${successCount} entries. ${errorCount > 0 ? `${errorCount} failures observed.` : ""}`,
        });
        
        if (onImportComplete) onImportComplete();
      } catch (error) {
        toast({ title: "IO Error", description: "Failed to parse academic data stream.", variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="relative">
      <Input type="file" accept=".xlsx, .xls" className="hidden" id="import-excel" ref={fileInputRef} onChange={handleImport} disabled={isImporting} />
      <Button variant={variant} className={`gap-2 h-11 px-6 rounded-xl font-bold transition-all ${variant === 'outline' ? 'border-2 border-slate-200' : ''}`} asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <FileSpreadsheet className="w-4 h-4" />}
          {isImporting ? "Injecting Data..." : "Import Dataset"}
        </label>
      </Button>
    </div>
  );
}


export default function TimeSlots() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const { toast } = useToast();
  const { data: timeSlots, isLoading, refetch } = useTimeSlots();
  const deleteMutation = useDeleteTimeSlot();

  const handleExport = () => {
    const data = timeSlots?.map(slot => ({
      Day: slot.dayOfWeek,
      Label: slot.label,
      "Start Time": slot.startTime,
      "End Time": slot.endTime
    }));
    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TimeSlots");
    XLSX.writeFile(wb, "timeslots.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const uniquePeriods = useMemo(() => {
    if (!timeSlots) return [];
    const seen = new Set();
    return timeSlots
      .filter(slot => {
        const key = `${slot.label}-${slot.startTime}-${slot.endTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timeSlots]);

  const handleEdit = (prototypeSlot) => {
    const relatedSlots = timeSlots.filter(s => 
      s.label === prototypeSlot.label && 
      s.startTime === prototypeSlot.startTime && 
      s.endTime === prototypeSlot.endTime
    );
    setEditGroup(relatedSlots);
  };

  const formatTime = (time24) => {
    const [h, m] = time24.split(":");
    const hNum = parseInt(h);
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const h12 = hNum % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };



  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        
        <div className="max-w-6xl mx-auto space-y-10 pt-12 lg:pt-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                        <Settings2 className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-4xl font-display font-black text-slate-900 tracking-tight">Time Slots</h1>
                </div>
                <p className="text-slate-500 font-medium">Orchestrate and manage academic intervals and period synchronization.</p>
              </motion.div>
              
              <div className="flex items-center gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                <TimeSlotImport timeSlots={timeSlots} onImportComplete={refetch} />

                <Button variant="outline" className="gap-2 h-11 px-6 rounded-xl border-2 border-slate-200 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all" onClick={handleExport}>
                  <Upload className="w-4 h-4" /> Export Dataset
                </Button>

                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                  <DialogTrigger asChild>
                    <Button className="premium-gradient premium-gradient-hover gap-2 h-11 px-8 shadow-xl shadow-indigo-500/20 text-white font-black rounded-xl transition-all hover:scale-105 active:scale-95">
                      <Plus className="w-5 h-5" /> Add New Period
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl rounded-[3rem] border-0 p-10 shadow-2xl bg-white/95 backdrop-blur-2xl">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="text-2xl font-black text-slate-900">Define Custom Interval</DialogTitle>
                    </DialogHeader>
                    <BulkTimeSlotDialog onSuccess={refetch} onClose={() => setBulkOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <ExportHint />

            <Dialog open={!!editGroup} onOpenChange={(v) => !v && setEditGroup(null)}>
              <DialogContent className="sm:max-w-xl rounded-[3rem] border-0 p-10 shadow-2xl bg-white/95 backdrop-blur-2xl">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-black text-slate-900">Modify Period Chain</DialogTitle>
                </DialogHeader>
                {editGroup && (
                  <BulkTimeSlotDialog 
                    editingGroup={editGroup} 
                    onSuccess={refetch} 
                    onClose={() => setEditGroup(null)} 
                  />
                )}
              </DialogContent>
            </Dialog>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden"
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                    <TableHead className="py-6 px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Reference Label</TableHead>
                    <TableHead className="py-6 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Temporal Scope</TableHead>
                    <TableHead className="py-6 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Active Synchronicity</TableHead>
                    <TableHead className="py-6 px-8 text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></TableCell></TableRow>
                  ) : uniquePeriods.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 font-medium">No time slots found. Create or import some to get started.</TableCell></TableRow>
                  ) : (
                  <AnimatePresence mode="popLayout">
                    {uniquePeriods.map((slot, idx) => {
                        const activeDaysGroup = Array.from(new Set(timeSlots
                        .filter(s => s.label === slot.label && s.startTime === slot.startTime)
                        .map(s => s.dayOfWeek)))
                        .sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));

                        return (
                        <motion.tr 
                            key={`${slot.label}-${slot.startTime}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all"
                        >
                            <TableCell className="py-6 px-8">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${slot.label.toLowerCase().includes('break') ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-900 text-base">{slot.label}</span>
                                </div>
                            </TableCell>
                            <TableCell className="py-6 px-6">
                                <div className="flex items-center gap-3 font-mono text-sm font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    {formatTime(slot.startTime)} 
                                    <ChevronRight className="w-4 h-4 text-indigo-300" />
                                    {formatTime(slot.endTime)}
                                </div>
                            </TableCell>
                            <TableCell className="py-6 px-6 text-slate-600">
                                <div className="flex flex-wrap gap-1.5">
                                    {activeDaysGroup.map(d => (
                                    <span key={d} className="px-3 py-1 bg-white text-slate-600 text-[10px] rounded-lg font-black uppercase tracking-tighter shadow-sm border border-slate-100">
                                        {d.slice(0, 3)}
                                    </span>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell className="py-6 px-8 text-right">
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-10 w-10 rounded-xl text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm bg-white border border-slate-100"
                                        onClick={() => handleEdit(slot)}
                                    >
                                    <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-10 w-10 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm bg-white border border-slate-100"
                                        onClick={() => {
                                            if(confirm(`Obliterate all ${activeDaysGroup.length} instances of this period across all days? This cannot be undone.`)) {
                                            timeSlots
                                                .filter(s => s.label === slot.label && s.startTime === slot.startTime)
                                                .forEach(s => deleteMutation.mutate(s.id));
                                            }
                                        }}
                                    >
                                    <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </motion.tr>
                        );
                    })}
                  </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </motion.div>
          </div>
      </main>
    </div>
  );
}
