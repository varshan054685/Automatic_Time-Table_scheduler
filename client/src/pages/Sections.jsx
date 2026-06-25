import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download, LayoutGrid, Building2, School, GraduationCap, Calendar, FileSpreadsheet } from "lucide-react";
import { useSections, useCreateSection, useUpdateSection, useDeleteSection, useDepartments, useClassrooms } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";

function SectionImport({ departments, classrooms, sections, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateSection();
  const updateMutation = useUpdateSection();

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

        // Helper to find value from object with case-insensitive keys and space-tolerant search
        const getVal = (obj, ...keys) => {
          const objKeys = Object.keys(obj);
          for (const k of keys) {
            const foundKey = objKeys.find(ok => ok.toLowerCase().trim() === k.toLowerCase().trim());
            if (foundKey) return obj[foundKey];
          }
          return null;
        };

        const clean = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
        
        // Helper to extract first digit or Roman numeral (I-X)
        const parseOrdinal = (val) => {
          if (!val) return null;
          const s = String(val).toUpperCase().trim();
          const roman = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10 };
          if (roman[s]) return roman[s];
          const match = s.match(/\d+/);
          return match ? parseInt(match[0]) : null;
        };

        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const rowNum = i + 2; // Assuming header is row 1
          const name = getVal(item, "Section Name", "Name", "Section", "Class", "Class Name");
          const yearRaw = getVal(item, "Year", "Study Year");
          const semesterRaw = getVal(item, "Semester", "Sem");
          const deptSearch = getVal(item, "Department", "Dept", "Department Code", "Dept Code");
          const classroomSearch = getVal(item, "Classroom", "Room", "Class Room", "Room Number");

          if (name) {
            // Also try to extract year from name if missing
            let yearNum = parseOrdinal(yearRaw);
            if (!yearNum) {
              const nameParts = String(name).split(/[\s-]+/);
              for (const p of nameParts) {
                const pNum = parseOrdinal(p);
                if (pNum) { yearNum = pNum; break; }
              }
            }
            const semesterNum = parseOrdinal(semesterRaw);
            const searchDeptClean = clean(deptSearch);
            
            const dept = departments?.find(d => {
              const dNameClean = clean(d.name);
              const dCodeClean = clean(d.code);
              // Flexible matching: exact clean match OR code match OR prefix/suffix match
              return (searchDeptClean && (
                dNameClean === searchDeptClean || 
                dCodeClean === searchDeptClean ||
                dNameClean.includes(searchDeptClean) ||
                searchDeptClean.includes(dNameClean)
              ));
            });
            
            const deptId = dept ? dept.id : (item.departmentId ? Number(item.departmentId) : 0);

            const searchRoomClean = clean(classroomSearch);
            const classroom = classrooms?.find(c => {
              const rNumClean = clean(c.roomNumber);
              return (searchRoomClean && (rNumClean === searchRoomClean || rNumClean.includes(searchRoomClean)));
            });
            const classroomId = classroom ? classroom.id : (item.classroomId ? Number(item.classroomId) : null);

            // Check for existing section
            const nameClean = clean(name);
            const existing = sections?.find(s => 
              clean(s.name) === nameClean && 
              Number(s.year) === (yearNum || s.year) &&
              Number(s.semester) === (semesterNum || s.semester)
            );

            const payload = {
              name: String(name),
              year: Number(yearNum || 1), 
              semester: Number(semesterNum || 1),
              departmentId: Number(deptId),
              classroomId: classroomId
            };

            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  ...payload,
                  departmentId: Number(deptId || existing.departmentId),
                  classroomId: classroomId || existing.classroomId
                });
                updateCount++;
              } else {
                if (!deptId) {
                  const msg = `Row ${rowNum}: No department found for "${deptSearch}"`;
                  console.warn(msg);
                  errors.push(msg);
                  errorCount++;
                  continue;
                }
                await createMutation.mutateAsync(payload);
                successCount++;
              }
            } catch (err) {
              const msg = `Row ${rowNum} (${name}): ${err.message || 'Unknown error'}`;
              console.error(`Import failed for row ${rowNum}:`, { payload, error: err });
              errors.push(msg);
              errorCount++;
            }
          }
        }

        const summary = `Imported ${successCount} new, updated ${updateCount} sections.`;
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

export default function Sections() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const { data: sections, isLoading, refetch } = useSections();
  const { data: departments } = useDepartments();
  const { data: classrooms } = useClassrooms();
  const createMutation = useCreateSection();
  const updateMutation = useUpdateSection();
  const deleteMutation = useDeleteSection();

  const form = useForm({
    resolver: zodResolver(api.sections.create.input),
    defaultValues: { name: "", year: 1, semester: 1, departmentId: 0, classroomId: 0 },
  });

  const handleExport = () => {
    const data = sections?.length > 0 
      ? sections.map(s => ({
          "Section Name": s.name,
          "Year": s.year,
          "Semester": s.semester,
          "Department": departments?.find(d => d.id === s.departmentId)?.name || "",
          "Classroom": classrooms?.find(c => c.id === s.classroomId)?.roomNumber || ""
        }))
      : [{
          "Section Name": "CS-A",
          "Year": 1,
          "Semester": 1,
          "Department": "Computer Science",
          "Classroom": "101"
        }];
        
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sections");
    XLSX.writeFile(wb, "sections_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    if (editingId) {
      updateMutation.mutate({ 
        id: editingId, 
        ...values,
        classroomId: values.classroomId && values.classroomId !== "0" ? Number(values.classroomId) : null,
      }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          toast({ title: "Success", description: "Section updated successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate({
        ...values,
        classroomId: values.classroomId && values.classroomId !== "0" ? Number(values.classroomId) : null,
      }, {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          toast({ title: "Success", description: "Section created successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  const handleEdit = (section) => {
    setEditingId(section.id);
    form.reset({ 
      name: section.name, 
      year: section.year, 
      semester: section.semester, 
      departmentId: section.departmentId,
      classroomId: section.classroomId || 0 
    });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this section?")) {
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

  const filteredAndSortedSections = useMemo(() => {
    if (!sections) return [];
    
    let result = sections.filter(section => 
      section.name.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [sections, searchTerm, sortConfig]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="page-hero px-5 lg:px-8 pt-16 lg:pt-7 pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#05966922,#10b98133)" }}>
                    <LayoutGrid className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Master Data / Sections</div>
                </div>
                <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight">Sections</h1>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Coordinate class groups and academic cohorts.</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 flex-wrap">
                <SectionImport departments={departments} classrooms={classrooms} sections={sections} onImportComplete={refetch} />
                <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700" onClick={handleExport}>
                  <Upload className="w-4 h-4" /> Export
                </Button>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 h-10 px-5 rounded-xl text-sm font-bold premium-gradient shadow-lg shadow-teal-500/20">
                      <Plus className="w-4 h-4" /> Add Section
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl border border-slate-100">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-display font-black">{editingId ? "Edit Section" : "New Section"}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Section Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <LayoutGrid className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="CS-A" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name="year" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-bold text-slate-700">Study Year</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                  <Input type="number" className="pl-10 h-11 rounded-xl" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="semester" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-bold text-slate-700">Semester</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                  <Input type="number" className="pl-10 h-11 rounded-xl" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="departmentId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Department</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Department" /></SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                {departments?.map(dept => <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="classroomId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Default Classroom</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Optional" /></SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="0">Unassigned</SelectItem>
                                {classrooms?.map(room => <SelectItem key={room.id} value={room.id.toString()}>{room.roomNumber}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full h-11 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20" disabled={createMutation.isPending || updateMutation.isPending}>
                          {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Creating..." : "Add Section")}
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
              <Input placeholder="Search by section name…" className="pl-11 h-11 bg-white border-slate-200 rounded-xl text-sm focus:border-teal-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 2px 16px -4px rgba(0,0,0,0.06)" }}>
              <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_auto] items-center px-6 py-3 bg-slate-50/80 border-b border-slate-100 gap-4">
                <div />
                {["Section","Year / Sem","Department","Classroom"].map(h => (
                  <div key={h} className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{h}</div>
                ))}
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 text-right pr-2">Actions</div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-500" /></div>
              ) : filteredAndSortedSections.length === 0 ? (
                <div className="text-center py-16">
                  <LayoutGrid className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-semibold text-sm">No sections found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredAndSortedSections.map((section, idx) => (
                    <motion.div
                      key={section.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_auto] items-center px-6 py-4 gap-4 group hover:bg-slate-50/60 transition-all"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 group-hover:scale-110 transition-transform">
                        {section.name?.charAt(0)}
                      </div>
                      <p className="font-bold text-slate-900 text-sm group-hover:text-teal-600 transition-colors">{section.name}</p>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Year {section.year}</p>
                        <p className="text-[10px] text-slate-400">Sem {section.semester}</p>
                      </div>
                      <p className="text-sm text-slate-600 font-medium truncate">{departments?.find(d => d.id === section.departmentId)?.name || "—"}</p>
                      <p className="text-sm text-slate-500 font-medium">{classrooms?.find(c => c.id === section.classroomId)?.roomNumber || <span className="text-slate-300 italic text-xs">None</span>}</p>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={() => handleEdit(section)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(section.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {!isLoading && filteredAndSortedSections.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-slate-400">{filteredAndSortedSections.length} section{filteredAndSortedSections.length !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
