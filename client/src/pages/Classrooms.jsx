import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download, School, Hash, Users, Laptop, FileSpreadsheet } from "lucide-react";
import { useClassrooms, useCreateClassroom, useUpdateClassroom, useDeleteClassroom } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";

function ClassroomImport({ classrooms, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateClassroom();
  const updateMutation = useUpdateClassroom();

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
          const keys = Object.keys(item);
          const getVal = (...possibleKeys) => {
            for (const k of possibleKeys) {
              const found = keys.find(ck => ck.toLowerCase().trim() === k.toLowerCase().trim());
              if (found !== undefined && item[found] !== undefined && item[found] !== "") return item[found];
            }
            return null;
          };

          const roomNumber = getVal("Room Number", "Room No", "Room No.", "Room", "Classroom", "room number", "room", "RoomNumber", "roomNumber");
          const capacity = getVal("Capacity", "capacity", "Seats", "seats", "Size", "size");
          const typeRaw = getVal("Type", "type", "Room Type", "room type", "Classroom Type");

          if (roomNumber) {
            const existing = classrooms?.find(c => c.roomNumber === String(roomNumber));
            
            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  roomNumber: String(roomNumber),
                  capacity: Number(capacity || existing.capacity),
                  type: typeRaw ? (String(typeRaw).toLowerCase().includes("lab") ? "lab" : "lecture") : existing.type
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({ 
                  roomNumber: String(roomNumber), 
                  capacity: Number(capacity || 0), 
                  type: typeRaw ? (String(typeRaw).toLowerCase().includes("lab") ? "lab" : "lecture") : "lecture"
                });
                successCount++;
              }
            } catch (err) {
              console.error(`Failed to import/update classroom ${roomNumber}:`, err);
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Complete", 
          description: `Imported ${successCount} new, updated ${updateCount} classrooms.${errorCount > 0 ? ` Failed ${errorCount} records.` : ""}`,
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
      <Button variant="outline" className="gap-2 h-11 px-5 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import Excel"}
        </label>
      </Button>
    </div>
  );
}

export default function Classrooms() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const { data: classrooms, isLoading, refetch } = useClassrooms();
  const createMutation = useCreateClassroom();
  const updateMutation = useUpdateClassroom();
  const deleteMutation = useDeleteClassroom();

  const form = useForm({
    resolver: zodResolver(api.classrooms.create.input),
    defaultValues: { roomNumber: "", capacity: 0, type: "lecture" },
  });

  const handleExport = () => {
    const data = classrooms?.length > 0 
      ? classrooms.map(c => ({
          "Room Number": c.roomNumber,
          "Capacity": c.capacity,
          "Type": c.type
        }))
      : [{
          "Room Number": "101",
          "Capacity": 60,
          "Type": "lecture"
        }];
        
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Classrooms");
    XLSX.writeFile(wb, "classrooms_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...values }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          toast({ title: "Success", description: "Classroom updated successfully" });
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
          toast({ title: "Success", description: "Classroom created successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  const handleEdit = (room) => {
    setEditingId(room.id);
    form.reset({ roomNumber: room.roomNumber, capacity: room.capacity, type: room.type });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this classroom?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedClassrooms = useMemo(() => {
    if (!classrooms) return [];
    
    let result = classrooms.filter(room => 
      room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [classrooms, searchTerm, sortConfig]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8 pt-12 lg:pt-0">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <School className="w-10 h-10 text-indigo-600" />
                Classrooms
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Manage and allocated physical teaching spaces.</p>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap gap-3">
              <ClassroomImport classrooms={classrooms} onImportComplete={refetch} />
              <Button variant="outline" className="gap-2 h-11 px-5 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl" onClick={handleExport}>
                <FileSpreadsheet className="w-4 h-4" /> Export
              </Button>

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="premium-gradient premium-gradient-hover gap-2 h-11 px-6 shadow-xl shadow-indigo-500/20 rounded-xl">
                    <Plus className="w-4 h-4" /> Add Classroom
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">{editingId ? "Edit Classroom" : "Add New Classroom"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
                      <FormField
                        control={form.control}
                        name="roomNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Room Number</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Hash className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="101" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="capacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Capacity (No. of Students)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input type="number" className="pl-10 h-11 rounded-xl" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Room Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="lecture">Lecture / Classroom</SelectItem>
                                <SelectItem value="lab">Computer Lab</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full h-12 premium-gradient premium-gradient-hover rounded-xl text-base font-bold shadow-lg shadow-indigo-500/20" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingId ? (updateMutation.isPending ? "Updating..." : "Update Space") : (createMutation.isPending ? "Add Space" : "Create Classroom")}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </motion.div>
          </div>

          <ExportHint />

          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <Input 
                placeholder="Search by room number..." 
                className="pl-12 h-14 bg-white border-slate-100 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 rounded-2xl text-lg transition-all" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-16 h-14"></TableHead>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors py-4 px-6" onClick={() => handleSort('roomNumber')}>
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">Room ID <ArrowUpDown className="w-3 h-3" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors py-4 px-6" onClick={() => handleSort('capacity')}>
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">Capacity <ArrowUpDown className="w-3 h-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Type</TableHead>
                    <TableHead className="text-right py-4 px-6 font-bold uppercase tracking-wider text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></TableCell></TableRow>
                  ) : filteredAndSortedClassrooms.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 font-medium">No classrooms found matching your search.</TableCell></TableRow>
                  ) : (
                    filteredAndSortedClassrooms.map((room, idx) => (
                      <motion.tr 
                        key={room.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <TableCell className="py-4 pl-6">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-transform group-hover:scale-110 ${room.type === 'lab' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                            {room.type === 'lab' ? <Laptop className="w-5 h-5" /> : <School className="w-5 h-5" />}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{room.roomNumber}</p>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="font-semibold text-slate-700">{room.capacity} students</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${room.type === 'lab' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                            {room.type}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              onClick={() => handleEdit(room)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                              onClick={() => handleDelete(room.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
