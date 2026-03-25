import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download } from "lucide-react";
import { useSections, useCreateSection, useUpdateSection, useDeleteSection, useDepartments, useClassrooms } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

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
        const errorSummary = errorCount > 0 ? ` Failed ${errorCount} records: ${errors.slice(0, 3).join("; ")}${errorCount > 3 ? "..." : ""}` : "";

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
      <Button variant="outline" className="gap-2" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import Excel"}
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
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6 pt-12 lg:pt-0">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-display font-bold text-slate-900">Sections</h1>
              <p className="text-slate-500 mt-1">Manage class sections.</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export Excel
              </Button>
              <SectionImport departments={departments} classrooms={classrooms} sections={sections} onImportComplete={refetch} />

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> Add Section
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Edit Section" : "Add Section"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl><Input placeholder="CS-A" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="semester"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Semester</FormLabel>
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
                        name="classroomId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Classroom</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Classroom (Optional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="0">None</SelectItem>
                                {classrooms?.map(room => (
                                  <SelectItem key={room.id} value={room.id.toString()}>{room.roomNumber}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingId ? (updateMutation.isPending ? "Updating..." : "Update Section") : (createMutation.isPending ? "Creating..." : "Create Section")}
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
                placeholder="Search sections..." 
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
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-2">Name <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('year')}>
                    <div className="flex items-center gap-2">Year <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('semester')}>
                    <div className="flex items-center gap-2">Semester <ArrowUpDown className="w-3 h-3" /></div>
                  </TableHead>
                   <TableHead>Department</TableHead>
                   <TableHead>Classroom</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filteredAndSortedSections.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sections found</TableCell></TableRow>
                ) : (
                  filteredAndSortedSections.map((section) => (
                    <TableRow key={section.id}>
                      <TableCell className="font-medium">{section.name}</TableCell>
                      <TableCell>{section.year}</TableCell>
                      <TableCell>{section.semester}</TableCell>
                       <TableCell>{departments?.find(d => d.id === section.departmentId)?.name || section.department?.name || "Unknown"}</TableCell>
                       <TableCell>{classrooms?.find(c => c.id === section.classroomId)?.roomNumber || section.classroom?.roomNumber || "None"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-500 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleEdit(section)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(section.id)}
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
