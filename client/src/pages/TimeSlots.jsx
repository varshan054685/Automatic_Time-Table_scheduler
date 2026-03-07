import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Calendar, Upload, Download, Loader2 } from "lucide-react";
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { useRef } from "react";

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

function BulkTimeSlotDialog({ onSuccess, editingSlot = null, onClose }) {
  const { toast } = useToast();
  const createMutation = useCreateTimeSlot();
  const updateMutation = useUpdateTimeSlot();
  
  const form = useForm({
    defaultValues: editingSlot ? {
      days: [editingSlot.dayOfWeek],
      label: editingSlot.label,
      startTime: editingSlot.startTime,
      endTime: editingSlot.endTime
    } : {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      label: "Period 1",
      startTime: "09:00",
      endTime: "10:00"
    }
  });

  const onSubmit = async (values) => {
    try {
      if (editingSlot) {
        await updateMutation.mutateAsync({
          id: editingSlot.id,
          dayOfWeek: values.days[0],
          label: values.label,
          startTime: values.startTime,
          endTime: values.endTime
        });
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
        <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
          {editingSlot ? "Update Time Slot" : "Create for Selected Days"}
        </Button>
      </form>
    </Form>
  );
}

function TimeSlotImport({ timeSlots, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateTimeSlot();

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

        for (const item of data) {
          const dayOfWeek = item.Day || item.dayOfWeek;
          const label = item.Label || item.label;
          const startTime = item["Start Time"] || item.startTime;
          const endTime = item["End Time"] || item.endTime;

          if (dayOfWeek && label && startTime && endTime) {
            // Check for duplicate time slot
            const isDuplicate = timeSlots?.some(s => 
              s.dayOfWeek === dayOfWeek && 
              s.startTime === startTime && 
              s.endTime === endTime
            );

            if (isDuplicate) {
              errorCount++;
              continue;
            }

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
          title: "Import Complete", 
          description: `Successfully imported ${successCount} time slots.${errorCount > 0 ? ` Skipped/Failed ${errorCount} records.` : ""}`,
          variant: errorCount > 0 ? "default" : "default"
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
      <Button variant="outline" className="gap-2" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import Excel"}
        </label>
      </Button>
    </div>
  );
}

export default function TimeSlots() {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const { toast } = useToast();
  const { data: timeSlots, isLoading, refetch } = useTimeSlots();
  const createMutation = useCreateTimeSlot();
  const deleteMutation = useDeleteTimeSlot();

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this time slot?")) {
      deleteMutation.mutate(id);
    }
  };

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

  const handleImport = (e) => {
    // This is replaced by TimeSlotImport component
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

  const formatTime = (time24) => {
    const [h, m] = time24.split(":");
    const hNum = parseInt(h);
    const ampm = hNum >= 12 ? 'PM' : 'AM';
    const h12 = hNum % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6 pt-12 lg:pt-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900">Time Slots</h1>
              <p className="text-slate-500 mt-1">Manage class periods.</p>
            </div>
            
            <div className="flex gap-2">
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-lg shadow-primary/20">
                    <Calendar className="w-4 h-4" /> Add Time Slot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Time Slot</DialogTitle>
                  </DialogHeader>
                  <BulkTimeSlotDialog onSuccess={refetch} onClose={() => setBulkOpen(false)} />
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export Excel
              </Button>

              <TimeSlotImport timeSlots={timeSlots} onImportComplete={refetch} />
            </div>
          </div>

          <Dialog open={!!editSlot} onOpenChange={(v) => !v && setEditSlot(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Time Slot</DialogTitle>
              </DialogHeader>
              {editSlot && (
                <BulkTimeSlotDialog 
                  editingSlot={editSlot} 
                  onSuccess={refetch} 
                  onClose={() => setEditSlot(null)} 
                />
              )}
            </DialogContent>
          </Dialog>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : uniquePeriods.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No time slots found</TableCell></TableRow>
                ) : (
                  uniquePeriods.map((slot, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{slot.label}</TableCell>
                      <TableCell>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-500 hover:text-primary hover:bg-primary/10"
                            onClick={() => setEditSlot(slot)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if(confirm(`Delete all instances of ${slot.label}?`)) {
                                timeSlots.filter(s => s.label === slot.label && s.startTime === slot.startTime).forEach(s => deleteMutation.mutate(s.id));
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
