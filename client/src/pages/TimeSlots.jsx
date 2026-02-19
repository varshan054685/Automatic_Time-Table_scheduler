import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Calendar, Upload, Download } from "lucide-react";
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
        {!editingSlot && (
          <FormField
            control={form.control}
            name="days"
            render={() => (
              <FormItem>
                <FormLabel>Working Days</FormLabel>
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
        )}
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl><Input placeholder="09:00" {...field} /></FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl><Input placeholder="10:00" {...field} /></FormControl>
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
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        for (const item of data) {
          await createMutation.mutateAsync({
            dayOfWeek: item.Day || item.dayOfWeek,
            label: item.Label || item.label,
            startTime: item["Start Time"] || item.startTime,
            endTime: item["End Time"] || item.endTime
          });
        }
        toast({ title: "Success", description: "Imported time slots" });
        refetch();
      } catch (err) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
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
                    <Calendar className="w-4 h-4" /> Add Weekly Slots
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Weekly Slots</DialogTitle>
                  </DialogHeader>
                  <BulkTimeSlotDialog onSuccess={refetch} onClose={() => setBulkOpen(false)} />
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export Excel
              </Button>

              <div className="relative">
                <Input type="file" accept=".xlsx, .xls" className="hidden" id="import-timeslots" onChange={handleImport} />
                <Button variant="outline" className="gap-2" asChild>
                  <label htmlFor="import-timeslots" className="cursor-pointer">
                    <Upload className="w-4 h-4" /> Import Excel
                  </label>
                </Button>
              </div>
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
                  <TableHead>Day</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : timeSlots?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No time slots found</TableCell></TableRow>
                ) : (
                  timeSlots?.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="font-medium">{slot.dayOfWeek}</TableCell>
                      <TableCell>{slot.label}</TableCell>
                      <TableCell>{slot.startTime} - {slot.endTime}</TableCell>
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
                            onClick={() => handleDelete(slot.id)}
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
