import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useTimeSlots, useCreateTimeSlot, useUpdateTimeSlot, useDeleteTimeSlot } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TimeSlots() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();
  const { data: timeSlots, isLoading } = useTimeSlots();
  const createMutation = useCreateTimeSlot();
  const updateMutation = useUpdateTimeSlot();
  const deleteMutation = useDeleteTimeSlot();

  const form = useForm({
    resolver: zodResolver(api.timeSlots.create.input),
    defaultValues: { dayOfWeek: "Monday", startTime: "09:00", endTime: "10:00", label: "Period 1" },
  });

  const onSubmit = (values) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...values }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          toast({ title: "Success", description: "Time slot updated successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          toast({ title: "Success", description: "Time slot created successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  const handleEdit = (slot) => {
    setEditingId(slot.id);
    form.reset({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, label: slot.label });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this time slot?")) {
      deleteMutation.mutate(id);
    }
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
            
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4" /> Add Time Slot
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Time Slot" : "Add Time Slot"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="dayOfWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Day</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Day" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => (
                                <SelectItem key={day} value={day}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl><Input placeholder="09:00" {...field} /></FormControl>
                          <FormMessage />
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingId ? (updateMutation.isPending ? "Updating..." : "Update Time Slot") : (createMutation.isPending ? "Creating..." : "Create Time Slot")}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

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
                            onClick={() => handleEdit(slot)}
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
