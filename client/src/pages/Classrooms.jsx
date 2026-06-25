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
        const errors = [];

        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const rowNum = i + 2;
          const keys = Object.keys(item);
          const getVal = (...possibleKeys) => {
            for (const k of possibleKeys) {
              const found = keys.find(ck => ck.toLowerCase().trim() === k.toLowerCase().trim());
              if (found !== undefined && item[found] !== undefined && item[found] !== "") return item[found];
            }
            return null;
          };

          const roomNumber = getVal("Room Number", "Room No", "Room No.", "Room", "Classroom", "room number", "room", "RoomNumber", "roomNumber");
          const capacityRaw = getVal("Capacity", "capacity", "Seats", "seats", "Size", "size");
          const capacity = Math.max(1, parseInt(capacityRaw || 0) || 30); // Default to 30 if missing or invalid
          const typeRaw = getVal("Type", "type", "Room Type", "room type", "Classroom Type");

          if (roomNumber) {
            const existing = classrooms?.find(c => String(c.roomNumber).toLowerCase() === String(roomNumber).toLowerCase());
            
            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  roomNumber: String(roomNumber),
                  capacity: capacity,
                  type: typeRaw ? (String(typeRaw).toLowerCase().includes("lab") ? "lab" : "lecture") : existing.type
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({ 
                  roomNumber: String(roomNumber), 
                  capacity: capacity, 
                  type: typeRaw ? (String(typeRaw).toLowerCase().includes("lab") ? "lab" : "lecture") : "lecture"
                });
                successCount++;
              }
            } catch (err) {
              const msg = `Row ${rowNum} (${roomNumber}): ${err.message || 'Validation failed'}`;
              console.error(msg, err);
              errors.push(msg);
              errorCount++;
            }
          }
        }

        const summary = `Imported ${successCount} new, updated ${updateCount} classrooms.`;
        const errorSummary = errorCount > 0 ? ` Failed ${errorCount} records: ${errors.slice(0, 2).join("; ")}${errorCount > 2 ? "..." : ""}` : "";

        toast({ 
          title: "Import Complete", 
          description: summary + errorSummary,
          variant: errorCount > 0 ? "destructive" : "default"
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
      <Button variant="outline" className="gap-2 h-11 px-6 rounded-xl border-2 border-slate-200 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <FileSpreadsheet className="w-4 h-4" />}
          {isImporting ? "Injecting Data..." : "Import Dataset"}
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Hero */}
        <div className="page-hero px-5 lg:px-8 pt-16 lg:pt-7 pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0891b222,#0e749033)" }}>
                    <School className="w-5 h-5 text-sky-600" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Master Data / Classrooms</div>
                </div>
                <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight">Classrooms</h1>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Manage physical teaching spaces and labs.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 flex-wrap">
                <ClassroomImport classrooms={classrooms} onImportComplete={refetch} />
                <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700" onClick={handleExport}>
                  <Upload className="w-4 h-4" /> Export
                </Button>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); form.reset(); } }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 h-10 px-5 rounded-xl text-sm font-bold premium-gradient shadow-lg shadow-teal-500/20">
                      <Plus className="w-4 h-4" /> Add Classroom
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl border border-slate-100">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-display font-black">{editingId ? "Edit Classroom" : "New Classroom"}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField control={form.control} name="roomNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Room Number</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Hash className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="101" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="capacity" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Capacity</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input type="number" className="pl-10 h-11 rounded-xl" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="type" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Room Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="lecture">Lecture / Classroom</SelectItem>
                                <SelectItem value="lab">Computer Lab</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full h-11 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20" disabled={createMutation.isPending || updateMutation.isPending}>
                          {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Creating..." : "Create Classroom")}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="px-5 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto space-y-4">
            <ExportHint />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search by room number…" className="pl-11 h-11 bg-white border-slate-200 rounded-xl text-sm focus:border-teal-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* Cards grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-500" /></div>
            ) : filteredAndSortedClassrooms.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <School className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-semibold text-sm">No classrooms found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAndSortedClassrooms.map((room, idx) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-white rounded-2xl border border-slate-100 p-4 group hover:border-teal-200 transition-all"
                    style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.05)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px -6px rgba(15,160,135,0.12)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px -4px rgba(0,0,0,0.05)"; }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${room.type === "lab" ? "bg-amber-50" : "bg-sky-50"}`}>
                        {room.type === "lab" ? <Laptop className="w-5 h-5 text-amber-600" /> : <School className="w-5 h-5 text-sky-600" />}
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleEdit(room)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(room.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="font-black text-slate-900 text-lg uppercase tracking-tight group-hover:text-teal-600 transition-colors">{room.roomNumber}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${room.type === "lab" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
                        {room.type}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />{room.capacity}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
