import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2 } from "lucide-react";
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, useDepartments, useFaculty, useSections } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

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

            const deptId = dept ? dept.id : (item.departmentId ? Number(item.departmentId) : (departments && departments.length > 0 ? departments[0].id : null));

            if (!deptId && !existing) {
              console.warn(`Skipping subject ${name}: No valid department ID found.`);
              errorCount++;
              continue;
            }

            // Normalize helper: strip punctuation, collapse spaces, lowercase
            const normalize = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
            const looseMatch = (a, b) => {
              if (!a || !b) return false;
              const na = normalize(a), nb = normalize(b);
              return na === nb || na.includes(nb) || nb.includes(na);
            };

            const fac = faculty?.find(f => 
              looseMatch(f.name, facultySearch) || 
              looseMatch(f.code, facultySearch)
            );

            const sec = sectionSearch ? sections?.find(s => looseMatch(s.name, sectionSearch)) : null;
            
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
      <Button variant="outline" className="gap-2" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
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
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6 pt-12 lg:pt-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900">Subjects</h1>
              <p className="text-slate-500 mt-1">Manage academic subjects.</p>
            </div>
            
            <div className="flex gap-2">
              <SubjectImport departments={departments} subjects={subjects} faculty={faculty} sections={sections} onImportComplete={refetch} />

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Edit Subject" : "Add Subject"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl><Input placeholder="Data Structures" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Code</FormLabel>
                            <FormControl><Input placeholder="CS201" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="weeklyHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weekly Hours</FormLabel>
                            <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="departmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departments?.map(dept => (
                                  <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="facultyId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Faculty</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Faculty (Optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">None</SelectItem>
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
                            <FormLabel>Target Section</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Section (Optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">None</SelectItem>
                                {sections?.filter(s => Number(s.departmentId) === watchedDeptId).map(s => (
                                  <SelectItem key={s.id} value={s.id.toString()}>{s.name} (Sem {s.semester})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="lecture">Lecture</SelectItem>
                                <SelectItem value="lab">Lab</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingId ? (updateMutation.isPending ? "Updating..." : "Update Subject") : (createMutation.isPending ? "Creating..." : "Create Subject")}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search subjects..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('code')}>
                    <div className="flex items-center gap-2">Code <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-2">Name <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead>Weekly Hours</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Default Faculty</TableHead>
                  <TableHead>Target Section</TableHead>
                  <TableHead>Subject Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filteredAndSortedSubjects.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No subjects found</TableCell></TableRow>
                ) : (
                  filteredAndSortedSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-mono">{subject.code}</TableCell>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.weeklyHours}</TableCell>
                      <TableCell>{departments?.find(d => d.id === subject.departmentId)?.name || "N/A"}</TableCell>
                      <TableCell>{faculty?.find(f => f.id === subject.facultyId)?.name || "None"}</TableCell>
                      <TableCell>{sections?.find(s => s.id === subject.sectionId)?.name || "None"}</TableCell>
                      <TableCell className="capitalize">{subject.type || "lecture"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-500 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleEdit(subject)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(subject.id)}
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
