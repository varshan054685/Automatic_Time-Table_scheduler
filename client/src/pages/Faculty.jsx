import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download, GraduationCap, Mail, Fingerprint, Building2, FileSpreadsheet } from "lucide-react";
import { useFaculty, useCreateFaculty, useUpdateFaculty, useDeleteFaculty, useDepartments } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";

function FacultyImport({ departments, faculty, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateFaculty();
  const updateMutation = useUpdateFaculty();

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
          const name = item["Faculty Name"] || item["Name"] || item.name || item.Name || item["Full Name"] || item["fullName"] || item["staff name"] || item["Staff Name"];
          const email = item["Email"] || item.email || item.Email || item["email"] || item["Mail"] || item["mail"];
          const code = item["Faculty Code"] || item["Code"] || item.code || item.Code || item["code"] || item["Staff Code"] || item["staff code"];
          const deptSearch = item["Department"] || item.department || item.Department || item["department"] || item.departmentCode || item.DepartmentCode || item["Dept"] || item["dept"];

          if (name) {
            const dept = departments?.find(d => 
              String(d.name).toLowerCase().trim() === String(deptSearch).toLowerCase().trim() || 
              String(d.code).toLowerCase().trim() === String(deptSearch).toLowerCase().trim()
            );
            
            const deptId = dept ? dept.id : (item.departmentId ? Number(item.departmentId) : (departments && departments.length > 0 ? departments[0].id : null));

            if (!deptId) {
              console.warn(`Skipping faculty ${name}: No valid department ID found.`);
              errorCount++;
              continue;
            }

            // Check for existing by code or email
            const existing = faculty?.find(f => 
              (code && String(f.code).toLowerCase() === String(code).toLowerCase()) || 
              (email && String(f.email).toLowerCase() === String(email).toLowerCase())
            );

            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  name: String(name),
                  code: code ? String(code) : existing.code,
                  email: email ? String(email) : existing.email,
                  departmentId: deptId || existing.departmentId,
                  availability: existing.availability || []
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({ 
                  name: String(name), 
                  code: code ? String(code) : `FAC${Date.now()}${successCount}`,
                  email: email ? String(email) : "", 
                  departmentId: deptId,
                  availability: []
                });
                successCount++;
              }
            } catch (err) {
              console.error(`Failed to import/update faculty ${name}:`, err);
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Complete", 
          description: `Imported ${successCount} new, updated ${updateCount} faculty.${errorCount > 0 ? ` Failed ${errorCount} records.` : ""}`,
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

export default function Faculty() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const { data: faculty, isLoading, refetch } = useFaculty();
  const { data: departments } = useDepartments();
  const createMutation = useCreateFaculty();
  const updateMutation = useUpdateFaculty();
  const deleteMutation = useDeleteFaculty();

  const form = useForm({
    resolver: zodResolver(api.faculty.create.input),
    defaultValues: { name: "", code: "", departmentId: 0, email: "", availability: [] },
  });

  const handleExport = () => {
    const data = faculty?.length > 0 
      ? faculty.map(f => ({
          "Faculty Code": f.code,
          "Faculty Name": f.name,
          "Email": f.email,
          "Department": departments?.find(d => d.id === f.departmentId)?.name || ""
        }))
      : [{
          "Faculty Code": "FAC001",
          "Faculty Name": "Dr. Alice",
          "Email": "alice@college.edu",
          "Department": "Computer Science"
        }];
        
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faculty");
    XLSX.writeFile(wb, "faculty_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    const data = {
      ...values,
      departmentId: Number(values.departmentId)
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          toast({ title: "Success", description: "Faculty updated successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          toast({ title: "Success", description: "Faculty created successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  const handleEdit = (f) => {
    setEditingId(f.id);
    form.reset({ name: f.name, code: f.code || "", departmentId: f.departmentId, email: f.email || "", availability: f.availability || [] });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this faculty member?")) {
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

  const filteredAndSortedFaculty = useMemo(() => {
    if (!faculty) return [];
    
    let result = faculty.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [faculty, searchTerm, sortConfig]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8 pt-12 lg:pt-0">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <GraduationCap className="w-10 h-10 text-indigo-600" />
                Faculty
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Manage and organize your teaching staff effectively.</p>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap gap-3">
              <FacultyImport departments={departments} faculty={faculty} onImportComplete={refetch} />
              <Button variant="outline" className="gap-2 h-11 px-5 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl" onClick={handleExport}>
                <FileSpreadsheet className="w-4 h-4" /> Export
              </Button>

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="premium-gradient premium-gradient-hover gap-2 h-11 px-6 shadow-xl shadow-indigo-500/20 rounded-xl">
                    <Plus className="w-4 h-4" /> Add Faculty
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">{editingId ? "Edit Faculty" : "Add New Faculty"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Full Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="Dr. Alice Johnson" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-semibold">Faculty Code</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                  <Input placeholder="FAC001" className="pl-10 h-11 rounded-xl uppercase" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="departmentId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 font-semibold">Department</FormLabel>
                              <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue placeholder="Select" />
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
                      </div>
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Email Address</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="alice@college.edu" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full h-12 premium-gradient premium-gradient-hover rounded-xl text-base font-bold shadow-lg shadow-indigo-500/20" disabled={createMutation.isPending || updateMutation.isPending}>
                        {editingId ? (updateMutation.isPending ? "Updating..." : "Update Details") : (createMutation.isPending ? "Add Member" : "Create Faculty")}
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
                placeholder="Search by name, code, or email..." 
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
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">Full Name <ArrowUpDown className="w-3 h-3" /></div>
                    </TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Department</TableHead>
                    <TableHead className="py-4 px-6 font-bold uppercase tracking-wider text-xs">Contact</TableHead>
                    <TableHead className="text-right py-4 px-6 font-bold uppercase tracking-wider text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></TableCell></TableRow>
                  ) : filteredAndSortedFaculty.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 font-medium">No faculty members found in this search.</TableCell></TableRow>
                  ) : (
                    filteredAndSortedFaculty.map((f, idx) => (
                      <motion.tr 
                        key={f.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <TableCell className="py-4 pl-6">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold group-hover:scale-110 transition-transform">
                            {f.name.charAt(0)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-mono text-sm text-slate-500 font-bold">{f.code}</TableCell>
                        <TableCell className="py-4 px-6">
                          <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{f.name}</p>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="font-medium text-slate-600">{departments?.find(d => d.id === f.departmentId)?.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <p className="text-sm text-slate-500 flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            {f.email || <span className="text-slate-300 italic">No email</span>}
                          </p>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm bg-white border border-slate-100"
                              onClick={() => handleEdit(f)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm bg-white border border-slate-100"
                              onClick={() => handleDelete(f.id)}
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
