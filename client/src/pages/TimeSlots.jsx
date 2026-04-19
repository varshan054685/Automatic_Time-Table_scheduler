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
    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
      <Select value={displayHours.toString()} onValueChange={(h) => updateTime(h, minutes, isPM)}>
        <SelectTrigger className="w-[70px] h-10 border-0 bg-white ring-0 focus:ring-0 rounded-lg font-bold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
            <SelectItem key={h} value={h.toString()} className="font-bold">{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-slate-400 font-bold">:</span>
      <Select value={minutes} onValueChange={(m) => updateTime(displayHours, m, isPM)}>
        <SelectTrigger className="w-[70px] h-10 border-0 bg-white ring-0 focus:ring-0 rounded-lg font-bold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map(m => (
            <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex bg-white/50 p-1 rounded-lg gap-1 border border-slate-200">
        <button
          type="button"
          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${!isPM ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
          onClick={() => updateTime(displayHours, minutes, false)}
        >
          AM
        </button>
        <button
          type="button"
          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${isPM ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="days"
          render={() => (
            <FormItem>
              <FormLabel className="font-bold text-slate-700">Scope of Application (Days)</FormLabel>
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
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                field.value?.includes(day)
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-105'
                                    : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500'
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
              <FormLabel className="font-bold text-slate-700">Academic Period Label</FormLabel>
              <FormControl>
                <div className="relative">
                    <Clock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                    <Input className="h-12 pl-10 rounded-xl bg-slate-50/50 border-slate-200 border-2 font-bold focus:border-indigo-600 transition-all" placeholder="e.g. Period 1 or Lunch Break" {...field} />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold text-slate-700">Interval Start</FormLabel>
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
              <FormItem>
                <FormLabel className="font-bold text-slate-700">Interval End</FormLabel>
                <FormControl>
                  <TimePicker value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full h-12 premium-gradient shadow-xl shadow-indigo-500/20 text-base font-black rounded-xl transition-all hover:scale-[1.02]" disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
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
        let updateCount = 0;
        let errorCount = 0;

        for (const item of data) {
          const dayOfWeek = item.Day || item.dayOfWeek;
          const label = item.Label || item.label;
          const startTime = item["Start Time"] || item.startTime;
          const endTime = item["End Time"] || item.endTime;

          if (dayOfWeek && label && startTime && endTime) {
            const existing = timeSlots?.find(s => 
              s.dayOfWeek === dayOfWeek && 
              s.startTime === startTime && 
              s.endTime === endTime
            );

            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  dayOfWeek,
                  label,
                  startTime,
                  endTime
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({
                  dayOfWeek,
                  label,
                  startTime,
                  endTime
                });
                successCount++;
              }
            } catch (err) {
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Chain Resolved", 
          description: `Ingested ${successCount} entries, synchronized ${updateCount}. ${errorCount > 0 ? `${errorCount} failures observed.` : ""}`,
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

function FirstTimeSetup({ onComplete, timeSlots }) {
  const [selectedDays, setSelectedDays] = useState(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [periods, setPeriods] = useState("6");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const createMutation = useCreateTimeSlot();

  const handleGenerate = async () => {
    if (selectedDays.length === 0) {
      toast({ title: "Scope Incomplete", description: "Please designate active academic days.", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    const numPeriods = parseInt(periods);
    const durMins = parseInt(duration);
    const [startH, startM] = startTime.split(':').map(Number);
    
    const slotsToCreate = [];
    
    for (let d = 0; d < selectedDays.length; d++) {
      for (let p = 0; p < numPeriods; p++) {
        const periodStartMin = startH * 60 + startM + p * durMins;
        const periodEndMin = periodStartMin + durMins;
        
        const sh = Math.floor(periodStartMin / 60).toString().padStart(2, '0');
        const sm = (periodStartMin % 60).toString().padStart(2, '0');
        const eh = Math.floor(periodEndMin / 60).toString().padStart(2, '0');
        const em = (periodEndMin % 60).toString().padStart(2, '0');
        
        slotsToCreate.push({
          dayOfWeek: selectedDays[d],
          label: `Period ${p + 1}`,
          startTime: `${sh}:${sm}`,
          endTime: `${eh}:${em}`
        });
      }
    }
    
    try {
      for (const slot of slotsToCreate) {
        await createMutation.mutateAsync(slot);
      }
      toast({ title: "Architecture Deployed", description: "Your weekly period structure has been successfully initialized." });
      onComplete();
    } catch (error) {
      toast({ title: "Deployment Error", description: error.message || "Failed to generate structure.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto"
    >
        <Card className="border-0 shadow-2xl shadow-indigo-500/10 rounded-[3rem] overflow-hidden bg-white">
        <div className="h-2 premium-gradient" />
        <CardHeader className="text-center pb-12 pt-16 px-12">
            <motion.div 
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="mx-auto w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-xl shadow-indigo-100/50"
            >
            <CalendarDays className="w-12 h-12" />
            </motion.div>
            <CardTitle className="text-4xl font-display font-black tracking-tight text-slate-900 leading-tight">
                Architect Your Weekly <br /><span className="text-indigo-600">Period Structure</span>
            </CardTitle>
            <CardDescription className="text-lg font-medium mt-6 text-slate-500 max-w-xl mx-auto leading-relaxed">
                Initialize your institution's academic cadence. Utilize our automation wizard or synchronize existing datasets from Excel.
            </CardDescription>
            
            <div className="flex justify-center mt-10">
            <TimeSlotImport timeSlots={timeSlots} onImportComplete={onComplete} variant="secondary" />
            </div>
        </CardHeader>

        <CardContent className="space-y-12 px-16 pb-16">
            <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]"><span className="bg-white px-6 text-slate-400">Manual Configuration</span></div>
            </div>

            <div className="grid gap-12">
            <div className="space-y-6">
                <Label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Active Academic Horizons
                </Label>
                <div className="flex flex-wrap gap-4">
                {DAYS.map(day => {
                    const isSelected = selectedDays.includes(day);
                    return (
                    <motion.button
                        key={day}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                        if (isSelected) {
                            setSelectedDays(selectedDays.filter(d => d !== day));
                        } else {
                            setSelectedDays([...selectedDays, day]);
                        }
                        }}
                        className={`px-6 py-4 rounded-[1.2rem] text-sm font-black transition-all border-2 ${
                        isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-500/30' 
                            : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'
                        }`}
                    >
                        {day}
                    </motion.button>
                    )
                })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-4">
                <Label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> Daily Periods
                </Label>
                <Input 
                    type="number" 
                    min="1" 
                    max="15" 
                    value={periods} 
                    onChange={e => setPeriods(e.target.value)}
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:border-indigo-500 font-black text-lg text-slate-900"
                />
                </div>
                <div className="space-y-4">
                <Label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" /> Start Epoch
                </Label>
                <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100">
                    <TimePicker value={startTime} onChange={setStartTime} />
                </div>
                </div>
                <div className="space-y-4">
                <Label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MousePointer2 className="w-4 h-4 text-indigo-500" /> Unit Duration
                </Label>
                <div className="relative">
                    <Input 
                    type="number" 
                    min="15" 
                    step="5"
                    value={duration} 
                    onChange={e => setDuration(e.target.value)}
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:border-indigo-500 font-black text-lg text-slate-900 pr-14"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[10px] uppercase">min</span>
                </div>
                </div>
            </div>
            </div>

            <Button 
                size="lg" 
                className="w-full h-16 text-lg font-black tracking-tight gap-3 premium-gradient shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)] rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98]" 
                onClick={handleGenerate}
                disabled={isGenerating}
            >
            {isGenerating ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Finalizing Architecture...</>
            ) : (
                <><Sparkles className="w-6 h-6" /> Deploy Period Structure</>
            )}
            </Button>
        </CardContent>
        </Card>
    </motion.div>
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc] items-center justify-center">
        <Sidebar className="hidden lg:block z-0" />
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        
        {timeSlots.length === 0 ? (
          <div className="pt-12 lg:pt-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
            <FirstTimeSetup onComplete={refetch} timeSlots={timeSlots} />
          </div>
        ) : (
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
              
              <div className="flex flex-wrap gap-3">
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
                  <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 p-8 shadow-2xl">
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
              <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 p-8 shadow-2xl">
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
                    <TableHead className="py-6 px-8 text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {uniquePeriods.map((slot, idx) => {
                        const activeDaysGroup = timeSlots
                        .filter(s => s.label === slot.label && s.startTime === slot.startTime)
                        .map(s => s.dayOfWeek);

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
                                <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-500">
                                    {formatTime(slot.startTime)} 
                                    <ChevronRight className="w-4 h-4 text-slate-300" />
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
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
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
                </TableBody>
              </Table>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}
