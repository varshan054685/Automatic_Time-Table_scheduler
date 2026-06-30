import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download, BookOpen, Fingerprint, Clock, Building2, GraduationCap, LayoutGrid, FlaskConical, FileSpreadsheet } from "lucide-react";
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, useDepartments, useFaculty, useSections, useUpdateFaculty } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";

function SubjectImport({ departments, faculty, sections, subjects, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const updateFacultyMutation = useUpdateFaculty();

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

        // Helper to find value with flexible key matching
        const getVal = (obj, ...keys) => {
          const objKeys = Object.keys(obj);
          for (const k of keys) {
            const foundKey = objKeys.find(ok => ok.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, ""));
            if (foundKey) return obj[foundKey];
          }
          return null;
        };

        // Helper for super fuzzy string matching (ignores titles and small suffixes)
        const fuzzyMatch = (s1, s2) => {
          if (s1 === undefined || s1 === null || s2 === undefined || s2 === null) return false;
          const clean = (s) => String(s).toLowerCase()
            .replace(/^(dr|mr|ms|mrs|prof)\.?\s*/i, "") // Strip titles (space optional)
            .replace(/[^a-z0-9]/g, "")
            .trim();
          const c1 = clean(s1);
          const c2 = clean(s2);
          if (!c1 || !c2) return false;
          // Match if equal, or if one starts with another (e.g. "Ambika" matches "Ambika N")
          return c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1);
        };

        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const rowNum = i + 2;
          const name = getVal(item, "Subject Name", "Name", "Subject", "Title");
          const codeRaw = getVal(item, "Subject Code", "Code", "ID", "Ref");
          const code = codeRaw ? String(codeRaw).replace(/\s+/g, "") : null;
          
          const weeklyHoursRaw = parseInt(getVal(item, "Weekly Hours", "Hours", "Weekly", "Lec Hours") || 0);
          const weeklyHours = isNaN(weeklyHoursRaw) || weeklyHoursRaw <= 0 ? 4 : weeklyHoursRaw;
          
          const deptSearch = getVal(item, "Department", "Dept", "Major");
          const facultySearch = getVal(item, "Default Faculty", "Faculty", "Staff", "Teacher", "Staff Name", "Faculty Name");
          const sectionSearch = getVal(item, "Target Section", "Section", "Class", "Cohort");
          const typeSearch = getVal(item, "Subject Type", "Type", "Mode");
          
          if (name && code) {
            const dept = departments?.find(d => 
              fuzzyMatch(d.name, deptSearch) || fuzzyMatch(d.code, deptSearch)
            );
            
            const deptId = dept ? dept.id : (item.departmentId ? Number(item.departmentId) : (departments && departments.length > 0 ? departments[0].id : null));

            if (!deptId) {
              const msg = `Row ${rowNum}: No department found for "${deptSearch}"`;
              console.warn(msg);
              errors.push(msg);
              errorCount++;
              continue;
            }

            const fac = faculty?.find(f => 
              fuzzyMatch(f.name, facultySearch) || fuzzyMatch(f.code, facultySearch)
            );
            
            let facultyId = fac ? fac.id : null;

            // SPECIAL INSTRUCTION: If name mismatch, override faculty name in system
            if (fac && String(fac.name).trim() !== String(facultySearch).trim() && facultySearch) {
              try {
                await updateFacultyMutation.mutateAsync({
                  id: fac.id,
                  name: String(facultySearch).trim()
                });
                console.log(`Updated faculty name from "${fac.name}" to "${facultySearch}"`);
              } catch (err) {
                console.error("Failed to override faculty name:", err);
              }
            }

            const sec = sections?.find(s => fuzzyMatch(s.name, sectionSearch));
            const sectionId = sec ? sec.id : null;
            
            const type = String(typeSearch || "").toLowerCase().trim() === "lab" ? "lab" : "lecture";

            const existing = subjects?.find(s => String(s.code).toLowerCase().replace(/\s+/g, "") === String(code).toLowerCase());

            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  name: String(name),
                  code: String(code),
                  weeklyHours: weeklyHours,
                  departmentId: deptId,
                  facultyId: facultyId || existing.facultyId,
                  sectionId: sectionId || existing.sectionId,
                  type: type
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({ 
                  name: String(name), 
                  code: String(code),
                  weeklyHours: weeklyHours,
                  departmentId: deptId,
                  facultyId: facultyId,
                  sectionId: sectionId,
                  type: type
                });
                successCount++;
              }
            } catch (err) {
              const msg = `Row ${rowNum} (${name}): ${err.message || 'Validation failed'}`;
              console.error(msg, err);
              errors.push(msg);
              errorCount++;
            }
          }
        }

        const summary = `Imported ${successCount} new, updated ${updateCount} subjects.`;
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

export default function Subjects() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const { data: subjects, isLoading, refetch } = useSubjects();
  const { data: departments } = useDepartments();
  const { data: faculty } = useFaculty();
  const { data: sections } = useSections();
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const deleteMutation = useDeleteSubject();

  const form = useForm({
    resolver: zodResolver(api.subjects.create.input),
    defaultValues: { name: "", code: "", weeklyHours: 0, departmentId: 0, facultyId: 0, sectionId: 0, type: "lecture" },
  });

  const handleExport = () => {
    const data = subjects?.length > 0 
      ? subjects.map(s => ({
          "Subject Name": s.name,
          "Subject Code": s.code,
          "Weekly Hours": s.weeklyHours,
          "Department": departments?.find(d => d.id === s.departmentId)?.name || "",
          "Default Faculty": faculty?.find(f => f.id === s.facultyId)?.name || "",
          "Target Section": sections?.find(sec => sec.id === s.sectionId)?.name || "",
          "Subject Type": s.type || "lecture"
        }))
      : [{
          "Subject Name": "Data Structures",
          "Subject Code": "CS201",
          "Weekly Hours": 4,
          "Department": "Computer Science",
          "Default Faculty": "Dr. Alice",
          "Target Section": "CS-A",
          "Subject Type": "lecture"
        }];
        
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subjects");
    XLSX.writeFile(wb, "subjects_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    const submissionData = {
      ...values,
      departmentId: Number(values.departmentId),
      facultyId: values.facultyId && values.facultyId !== "0" ? Number(values.facultyId) : null,
      sectionId: values.sectionId && values.sectionId !== "0" ? Number(values.sectionId) : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...submissionData }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          toast({ title: "Success", description: "Subject updated successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate(submissionData, {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          toast({ title: "Success", description: "Subject created successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  const handleEdit = (subject) => {
    setEditingId(subject.id);
    form.reset({ 
      name: subject.name, 
      code: subject.code, 
      weeklyHours: subject.weeklyHours, 
      departmentId: subject.departmentId, 
      facultyId: subject.facultyId || 0,
      sectionId: subject.sectionId || 0,
      type: subject.type || "lecture" 
    });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this subject?")) {
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

  const filteredAndSortedSubjects = useMemo(() => {
    if (!subjects) return [];
    
    let result = subjects.filter(subject => 
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [subjects, searchTerm, sortConfig]);

  const watchedDeptId = Number(form.watch("departmentId"));

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="page-hero px-5 lg:px-8 pt-16 lg:pt-7 pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb22,#0891b233)" }}>
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Master Data / Subjects</div>
                </div>
                <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight">Subjects</h1>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Curate and manage your academic curriculum.</p>
              </motion.div>
              
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 flex-wrap">

              <SubjectImport departments={departments} faculty={faculty} sections={sections} subjects={subjects} onImportComplete={refetch} />
              <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700" onClick={handleExport}>
                <Upload className="w-4 h-4" /> Export
              </Button>

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 h-10 px-5 rounded-xl text-sm font-bold premium-gradient shadow-lg shadow-teal-500/20">
                    <Plus className="w-4 h-4" /> Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl rounded-2xl border border-slate-100">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display font-black">{editingId ? "Edit Subject" : "New Subject"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Subject Name</FormLabel>
                                <FormControl>
                                <div className="relative">
                                    <BookOpen className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Data Structures" className="pl-10 h-11 rounded-xl" {...field} />
                                </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Subject Code</FormLabel>
                                <FormControl>
                                <div className="relative">
                                    <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input placeholder="CS201" className="pl-10 h-11 rounded-xl uppercase" {...field} />
                                </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="weeklyHours"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Weekly Hours</FormLabel>
                                <FormControl>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
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
                                <FormLabel className="text-slate-700 font-semibold">Learning Mode</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue placeholder="Select Mode" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="lecture">Theory / Lecture</SelectItem>
                                    <SelectItem value="lab">Practical / Lab</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>

                      <FormField
                          control={form.control}
                          name="departmentId"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-slate-700 font-semibold">Parent Department</FormLabel>
                              <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <SelectValue placeholder="Select Department" />
                                    </div>
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent className="rounded-xl">
                                  {departments?.map(dept => (
                                  <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                                  ))}
                              </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                          )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="facultyId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Default Faculty</FormLabel>
                                <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                                <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <GraduationCap className="w-4 h-4 text-slate-400" />
                                            <SelectValue placeholder="Optional" />
                                        </div>
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="0">Unassigned</SelectItem>
                                    {faculty?.map(f => {
                                        const dept = departments?.find(d => d.id === f.departmentId);
                                        return <SelectItem key={f.id} value={f.id.toString()}>{f.name} ({dept?.code || 'Unknown Dept'})</SelectItem>;
                                    })}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sectionId"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Target Section</FormLabel>
                                <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                                <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <LayoutGrid className="w-4 h-4 text-slate-400" />
                                            <SelectValue placeholder="Optional" />
                                        </div>
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="0">Unassigned</SelectItem>
                                    {sections?.map(s => {
                                        const dept = departments?.find(d => d.id === s.departmentId);
                                        return <SelectItem key={s.id} value={s.id.toString()}>{s.name} (S{s.semester}) - {dept?.code || 'Unknown Dept'}</SelectItem>;
                                    })}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>
                      
                      <Button type="submit" className="w-full h-11 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20 mt-2" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Adding..." : "Add Subject")}
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
              <Input placeholder="Search by subject name or code…" className="pl-11 h-11 bg-white border-slate-200 rounded-xl text-sm focus:border-teal-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 2px 16px -4px rgba(0,0,0,0.06)" }}>
              <div className="grid grid-cols-[3rem_5rem_2fr_4rem_1.5fr_1.5fr_4rem_auto] items-center px-4 py-3 bg-slate-50/80 border-b border-slate-100 gap-3">
                <div />{["Code","Name","Hrs","Dept","Faculty","Type","Action"].map(h => (
                  <div key={h} className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 text-left">{h}</div>
                ))}
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-500" /></div>
              ) : filteredAndSortedSubjects.length === 0 ? (
                <div className="text-center py-16"><BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" /><p className="text-slate-400 font-semibold text-sm">No subjects found.</p></div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filteredAndSortedSubjects.map((subject, idx) => (
                    <motion.div key={subject.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                      className="grid grid-cols-[3rem_5rem_2fr_4rem_1.5fr_1.5fr_4rem_auto] items-center px-4 py-3.5 gap-3 group hover:bg-slate-50/60 transition-all">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${subject.type === "lab" ? "bg-amber-50" : "bg-blue-50"}`}>
                        {subject.type === "lab" ? <FlaskConical className="w-4 h-4 text-amber-600" /> : <BookOpen className="w-4 h-4 text-blue-600" />}
                      </div>
                      <span className="font-mono text-[11px] font-black text-slate-500 uppercase truncate">{subject.code}</span>
                      <div>
                        <p className="font-bold text-slate-900 text-sm group-hover:text-teal-600 transition-colors truncate">{subject.name}</p>
                        <p className="text-[10px] text-slate-400">{sections?.find(s => s.id === subject.sectionId)?.name || "Generic"}</p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3"/>{subject.weeklyHours}h</span>
                      <span className="text-[12px] text-slate-600 font-medium truncate">{departments?.find(d => d.id === subject.departmentId)?.name || "—"}</span>
                      <span className="text-[12px] text-slate-500 truncate">{faculty?.find(f => f.id === subject.facultyId)?.name || <span className="text-slate-300 italic text-[11px]">Unassigned</span>}</span>
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md text-left ${subject.type === "lab" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{subject.type || "lec"}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleEdit(subject)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(subject.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {!isLoading && filteredAndSortedSubjects.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-slate-400">{filteredAndSortedSubjects.length} subject{filteredAndSortedSubjects.length !== 1 ? "s" : ""}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
