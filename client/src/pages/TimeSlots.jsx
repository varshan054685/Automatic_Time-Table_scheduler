import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Calendar, Upload, Download, Loader2, Sparkles, Clock, CalendarDays } from "lucide-react";
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";

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
    <div className="flex items-center gap-1">
      <Select value={displayHours.toString()} onValueChange={(h) => updateTime(h, minutes, isPM)}>
        <SelectTrigger className="w-[70px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
            <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-slate-400">:</span>
      <Select value={minutes} onValueChange={(m) => updateTime(displayHours, m, isPM)}>
        <SelectTrigger className="w-[70px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex border rounded-md overflow-hidden ml-1">
        <button
          type="button"
          className={`px-2 py-1 text-xs ${!isPM ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}
          onClick={() => updateTime(displayHours, minutes, false)}
        >
          AM
        </button>
        <button
          type="button"
          className={`px-2 py-1 text-xs ${isPM ? 'bg-primary text-white' : 'bg-white text-slate-600'}`}
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
          toast({ title: "Error", description: "Please select at least one day", variant: "destructive" });
          return;
        }

        const newDays = [...values.days];
        
        // Update existing slots where the day matches, delete if unchecked
        for (const oldSlot of editingGroup) {
          const dayIndex = newDays.indexOf(oldSlot.dayOfWeek);
          if (dayIndex !== -1) {
            // Keep and update this slot's time/label
            await updateMutation.mutateAsync({
              id: oldSlot.id,
              dayOfWeek: oldSlot.dayOfWeek,
              label: values.label,
              startTime: values.startTime,
              endTime: values.endTime
            });
            // Remove from newDays because it's handled
            newDays.splice(dayIndex, 1);
          } else {
            // Day was unchecked, delete this slot
            await deleteMutation.mutateAsync(oldSlot.id);
          }
        }
        
        // Any remaining newDays are completely new slots added to this group
        for (const day of newDays) {
          await createMutation.mutateAsync({
            dayOfWeek: day,
            label: values.label,
            startTime: values.startTime,
            endTime: values.endTime
          });
        }

        toast({ title: "Success", description: "Time slot updated" });
      } else {
        if (values.days.length === 0) {
          toast({ title: "Error", description: "Please select at least one day", variant: "destructive" });
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
        toast({ title: "Success", description: `Added slots for ${values.days.length} days` });
      }
      onSuccess();
      if (onClose) onClose();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="days"
          render={() => (
            <FormItem>
              <FormLabel>Select Days</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {DAYS.map((day) => (
                  <FormField
                    key={day}
                    control={form.control}
                    name="days"
                    render={({ field }) => (
                      <FormItem key={day} className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(day)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, day])
                                : field.onChange(field.value?.filter((value) => value !== day))
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">{day}</FormLabel>
                      </FormItem>
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
              <FormLabel>Label</FormLabel>
              <FormControl><Input placeholder="Period 1" {...field} /></FormControl>
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
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
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <TimePicker value={field.value} onChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
          {editingGroup ? "Update Time Slot" : "Create for Selected Days"}
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
              console.error(`Failed to import/update time slot ${label}:`, err);
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Complete", 
          description: `Imported ${successCount} new, updated ${updateCount} time slots.${errorCount > 0 ? ` Failed ${errorCount} records.` : ""}`,
        });
        
        if (onImportComplete) onImportComplete();
      } catch (error) {
        console.error("Excel import error:", error);
        toast({ title: "Import Failed", description: error?.message || "Failed to read Excel file", variant: "destructive" });
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
      <Button variant={variant} className="gap-2" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import Excel"}
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
      toast({ title: "Validation Error", description: "Select at least one day", variant: "destructive" });
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
      // Create sequentially to ensure ordering and not overload client
      for (const slot of slotsToCreate) {
        await createMutation.mutateAsync(slot);
      }
      toast({ title: "Success", description: "Schedule structure created successfully!" });
      onComplete();
    } catch (error) {
      toast({ title: "Error", description: error.message || "Failed to generate slots", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-xl border-slate-200/60 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
      <CardHeader className="text-center pb-8 pt-10">
        <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
          <CalendarDays className="w-8 h-8" />
        </div>
        <CardTitle className="text-3xl font-display">Let's set up your Schedule Weekly Structure</CardTitle>
        <CardDescription className="text-base mt-2">
          It looks like you haven't set up your daily time periods yet. 
          Use this wizard to auto-generate your college timings or import them via Excel.
        </CardDescription>
        
        <div className="flex justify-center mt-6">
          <TimeSlotImport timeSlots={timeSlots} onImportComplete={onComplete} variant="secondary" />
        </div>
      </CardHeader>

      <CardContent className="space-y-8 px-10">
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-500 font-medium tracking-wider">OR GENERATE MANUALLY</span></div>
        </div>

        <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 space-y-6">
          <div>
            <Label className="text-base mb-3 block text-slate-700">How many days for a week?</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedDays(selectedDays.filter(d => d !== day));
                      } else {
                        setSelectedDays([...selectedDays, day]);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700">Periods for a day</Label>
              <Input 
                type="number" 
                min="1" 
                max="15" 
                value={periods} 
                onChange={e => setPeriods(e.target.value)}
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">College Start Time</Label>
              <div className="bg-white rounded-md border p-2 shadow-sm">
                <TimePicker value={startTime} onChange={setStartTime} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700">Duration per period (mins)</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  min="15" 
                  step="5"
                  value={duration} 
                  onChange={e => setDuration(e.target.value)}
                  className="bg-white pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">min</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-10 pb-10 pt-4">
        <Button 
          size="lg" 
          className="w-full text-base h-12 gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" 
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Generating Structure...</>
          ) : (
            <><Sparkles className="w-5 h-5" /> Generate Timetable Structure</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function TimeSlots() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editGroup, setEditGroup] = useState(null); // array of slots
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
    // Collect all actual slots that share this exact time and label across different days
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
      <div className="flex min-h-screen bg-slate-50/50 items-center justify-center">
        <Sidebar className="hidden lg:block z-0" />
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8">
        
        {timeSlots.length === 0 ? (
          <div className="pt-12 lg:pt-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center">
            <FirstTimeSetup onComplete={refetch} timeSlots={timeSlots} />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6 pt-12 lg:pt-0">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-display font-bold text-slate-900">Time Slots</h1>
                <p className="text-slate-500 mt-1">Manage class periods across the week.</p>
              </div>
              
              <div className="flex gap-2">
                <TimeSlotImport timeSlots={timeSlots} onImportComplete={refetch} />

                <Button variant="outline" className="gap-2" onClick={handleExport}>
                  <Download className="w-4 h-4" /> Export Excel
                </Button>

                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shadow-lg shadow-primary/20 bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Calendar className="w-4 h-4" /> Add custom Period
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Time Slot</DialogTitle>
                    </DialogHeader>
                    <BulkTimeSlotDialog onSuccess={refetch} onClose={() => setBulkOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Dialog open={!!editGroup} onOpenChange={(v) => !v && setEditGroup(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Time Slot for {editGroup?.[0]?.label}</DialogTitle>
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[180px]">Period Label</TableHead>
                    <TableHead>Time Range</TableHead>
                    <TableHead>Active Days</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniquePeriods.map((slot, idx) => {
                    const activeDays = timeSlots
                      .filter(s => s.label === slot.label && s.startTime === slot.startTime)
                      .map(s => s.dayOfWeek);

                    return (
                      <TableRow key={idx} className="group hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-400" />
                            {slot.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {activeDays.map(d => (
                              <span key={d} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md font-medium shadow-sm border border-indigo-100">
                                {d.slice(0, 3)}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors h-8 w-8"
                              onClick={() => handleEdit(slot)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors h-8 w-8"
                              onClick={() => {
                                if(confirm(`Remove all ${activeDays.length} instances of ${slot.label} for all days?`)) {
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
