import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download, BookOpen, Fingerprint, Clock, Building2, GraduationCap, LayoutGrid, FileSpreadsheet, FlaskConical } from "lucide-react";
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, useDepartments, useFaculty, useSections } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";

function SubjectImport({ departments, subjects, faculty, sections, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();

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
          // Robust header matching helper
          const getValue = (possibleKeys) => {
            const keys = Object.keys(item);
            for (const key of possibleKeys) {
              const matchedKey = keys.find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
              if (matchedKey) return item[matchedKey];
            }
            return null;
          };

          const name = getValue(["Name", "Subject Name", "Subject", "subject"]);
          const code = getValue(["Code", "Subject Code", "subject code"]);
          const hours = getValue(["Weekly Hours", "weeklyHours", "Hours", "hours"]);
          const deptSearch = getValue(["Department", "department", "departmentCode", "Dept", "dept"]);
          const facultySearch = getValue(["Default Faculty", "Faculty", "Faculty Name", "Faculty Code", "Staff", "staff", "Professor"]);
          const sectionSearch = getValue(["Target Section", "Section", "section"]);
          const typeSearch = getValue(["Subject Type", "Type", "SubjectType", "type"]);

          if (name && code) {
            let type = "lecture";
            if (typeSearch) {
              const lowerType = String(typeSearch).toLowerCase().trim();
              if (lowerType.includes("lab")) type = "lab";
              else if (lowerType.includes("lecture") || lowerType.includes("theory")) type = "lecture";
            }
            const existing = subjects?.find(s => String(s.code).toLowerCase() === String(code).toLowerCase());
            
            const dept = departments?.find(d => 
              String(d.name).toLowerCase().trim() === String(deptSearch).toLowerCase().trim() || 
              String(d.code).toLowerCase().trim() === String(deptSearch).toLowerCase().trim()
            );

            const deptId = dept ? dept.id : (item.departmentId ? Number(item.departmentId) : null);

            if (!deptId && !existing) {
              console.warn(`Skipping subject ${name}: No valid department ID found.`);
              errorCount++;
              continue;
            }

            // Normalize helper: replace punctuation with spaces so "B.com.(IT)" and "B.Com IT" both become "b com it"
            const normalize = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
            const looseMatch = (a, b) => {
              if (!a || !b) return false;
              const na = normalize(a), nb = normalize(b);
              // Exact match after normalization is much safer for Roman numerals (I, II, III)
              // This prevents "II B.Com IT" from matching "I B.Com IT"
              return na === nb;
            };

            const fac = faculty?.find(f => 
              looseMatch(f.name, facultySearch) || 
              looseMatch(f.code, facultySearch)
            );

            const sec = (sectionSearch && deptId) ? sections?.find(s => 
              Number(s.departmentId) === deptId && looseMatch(s.name, sectionSearch)
            ) : null;
            
            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  name: String(name),
                  code: String(code),
                  weeklyHours: Number(hours || existing.weeklyHours),
                  departmentId: deptId || existing.departmentId,
                   facultyId: fac ? fac.id : (item.facultyId ? Number(item.facultyId) : existing.facultyId),
                  sectionId: sec ? sec.id : (item.sectionId ? Number(item.sectionId) : existing.sectionId),
                  type: type || existing.type || "lecture"
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({ 
                  name: String(name), 
                  code: String(code), 
                  weeklyHours: Number(hours || 0),
                  departmentId: deptId,
                  facultyId: fac ? fac.id : (item.facultyId ? Number(item.facultyId) : null),
                  sectionId: sec ? sec.id : (item.sectionId ? Number(item.sectionId) : null),
                  type: type || "lecture"
                });
                successCount++;
              }
            } catch (err) {
              console.error(`Failed to import/update subject ${name}:`, err);
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Complete", 
          description: `Imported ${successCount} new, updated ${updateCount} subjects.${errorCount > 0 ? ` Failed ${errorCount} records.` : ""}`,
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
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8 pt-12 lg:pt-0">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <BookOpen className="w-10 h-10 text-indigo-600" />
                Subjects
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Curate and manage your academic curriculum.</p>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap gap-3">
              <SubjectImport departments={departments} subjects={subjects} faculty={faculty} sections={sections} onImportComplete={refetch} />
              <Button variant="outline" className="gap-2 h-11 px-5 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl" onClick={handleExport}>
                <FileSpreadsheet className="w-4 h-4" /> Export
              </Button>

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="premium-gradient premium-gradient-hover gap-2 h-11 px-6 shadow-xl shadow-indigo-500/20 rounded-xl">
                    <Plus className="w-4 h-4" /> Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">{editingId ? "Edit Subject" : "Add New Subject"}</DialogTitle>
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
                                    {faculty?.filter(f => Number(f.departmentId) === watchedDeptId).map(f => (
                                    <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                                    ))}
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
                                    {sections?.filter(s => Number(s.departmentId) === watchedDeptId).map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} (S{s.semester})</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>
                      
                      <Button type="submit" className="w-full h-12 premium-gradient premium-gradient-hover rounded-xl text-base font-bold shadow-lg shadow-indigo-500/20 mt-2" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingId ? (updateMutation.isPending ? "Updating..." : "Save Changes") : (createMutation.isPending ? "Adding..." : "Add Subject")}
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
                placeholder="Search by subject name or code..." 
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
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors py-4 px-6" onClick={() => handleSort('code')}>
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">Code <ArrowUpDown className="w-3 h-3" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-indigo-600 transition-colors py-4 px-6" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">Subject Name <ArrowUpDown className="w-3 h-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Hours</TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Department</TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Faculty</TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Type</TableHead>
                    <TableHead className="text-right py-4 px-6 font-bold uppercase tracking-wider text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></TableCell></TableRow>
                  ) : filteredAndSortedSubjects.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-20 text-slate-400 font-medium">No subjects found matching your search.</TableCell></TableRow>
                  ) : (
                    filteredAndSortedSubjects.map((subject, idx) => (
                      <motion.tr 
                        key={subject.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <TableCell className="py-4 pl-6">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all group-hover:scale-110 shadow-sm ${subject.type === 'lab' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {subject.type === 'lab' ? <FlaskConical className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                            </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-mono text-sm font-bold text-slate-500 uppercase">{subject.code}</TableCell>
                        <TableCell className="py-4 px-6">
                            <div className="flex flex-col">
                                <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{subject.name}</p>
                                <span className="text-xs text-slate-400 font-medium">{sections?.find(s => s.id === subject.sectionId)?.name || 'Generic'}</span>
                            </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 w-fit">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span className="text-xs font-bold text-slate-600">{subject.weeklyHours}h</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                            <span className="text-sm font-medium text-slate-600">{departments?.find(d => d.id === subject.departmentId)?.name || "N/A"}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                            <span className="text-sm font-medium text-slate-700">{faculty?.find(f => f.id === subject.facultyId)?.name || <span className="text-slate-300 italic">Unassigned</span>}</span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${subject.type === 'lab' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {subject.type || 'lecture'}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm bg-white border border-slate-100"
                              onClick={() => handleEdit(subject)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm bg-white border border-slate-100"
                              onClick={() => handleDelete(subject.id)}
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
