import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, Download, Building2, Fingerprint, FileSpreadsheet } from "lucide-react";
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";

function DepartmentImport({ departments, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();

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

          const name = getVal("Department Name", "Department", "Name", "name", "dept name", "Dept Name");
          const code = getVal("Department Code", "Code", "code", "Dept Code", "dept code");

          if (name) {
            const finalCode = code ? String(code) : String(name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
            const existing = departments?.find(d =>
              String(d.name).toLowerCase().trim() === String(name).toLowerCase().trim() ||
              String(d.code).toLowerCase().trim() === finalCode.toLowerCase().trim()
            );
            
            try {
              if (existing) {
                await updateMutation.mutateAsync({
                  id: existing.id,
                  name: String(name),
                  code: finalCode
                });
                updateCount++;
              } else {
                await createMutation.mutateAsync({ name: String(name), code: finalCode });
                successCount++;
              }
            } catch (err) {
              console.error(`Failed to import/update department ${name}:`, err);
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Complete", 
          description: `Imported ${successCount} new, updated ${updateCount} departments.${errorCount > 0 ? ` Failed ${errorCount} records.` : ""}`,
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
      <Input
        type="file"
        accept=".xlsx, .xls"
        className="hidden"
        id="import-excel"
        ref={fileInputRef}
        onChange={handleImport}
        disabled={isImporting}
      />
      <Button variant="outline" className="gap-2 h-11 px-5 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl" asChild disabled={isImporting}>
        <label htmlFor="import-excel" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import Excel"}
        </label>
      </Button>
    </div>
  );
}

export default function Departments() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { toast } = useToast();
  const { data: departments, isLoading, refetch } = useDepartments();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const form = useForm({
    resolver: zodResolver(api.departments.create.input),
    defaultValues: { name: "", code: "" },
  });

  const handleExport = () => {
    const data = departments?.length > 0 
      ? departments.map(d => ({
          "Department Name": d.name,
          "Department Code": d.code
        }))
      : [{
          "Department Name": "Example Dept",
          "Department Code": "EXM"
        }];
        
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Departments");
    XLSX.writeFile(wb, "departments_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...values }, {
        onSuccess: () => {
          setOpen(false);
          setEditingId(null);
          form.reset();
          toast({ title: "Success", description: "Department updated successfully" });
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
          toast({ title: "Success", description: "Department created successfully" });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
      });
    }
  };

  const handleEdit = (dept) => {
    setEditingId(dept.id);
    form.reset({ name: dept.name, code: dept.code });
    setOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this department?")) {
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

  const filteredAndSortedDepartments = useMemo(() => {
    if (!departments) return [];
    
    let result = departments.filter(dept => 
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [departments, searchTerm, sortConfig]);

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8 pt-12 lg:pt-0">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <Building2 className="w-10 h-10 text-indigo-600" />
                Departments
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Manage academic units and their distinct identities.</p>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap gap-3">
              <DepartmentImport departments={departments} onImportComplete={refetch} />
              <Button variant="outline" className="gap-2 h-11 px-5 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl" onClick={handleExport}>
                <FileSpreadsheet className="w-4 h-4" /> Export
              </Button>

              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setEditingId(null); form.reset(); } }}>
                <DialogTrigger asChild>
                  <Button className="premium-gradient premium-gradient-hover gap-2 h-11 px-6 shadow-xl shadow-indigo-500/20 rounded-xl">
                    <Plus className="w-4 h-4" /> Add Department
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">{editingId ? "Edit Department" : "Add New Department"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 font-semibold">Department Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="Computer Science" className="pl-10 h-11 rounded-xl" {...field} data-testid="input-department-name" />
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
                            <FormLabel className="text-slate-700 font-semibold">Department Code</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="CSE" className="pl-10 h-11 rounded-xl uppercase" {...field} data-testid="input-department-code" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full h-12 premium-gradient premium-gradient-hover rounded-xl text-base font-bold shadow-lg shadow-indigo-500/20" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-department">
                        {editingId ? (updateMutation.isPending ? "Updating..." : "Update Details") : (createMutation.isPending ? "Add Department" : "Create Unit")}
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
                placeholder="Search by department name or code..." 
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
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs">Department Name <ArrowUpDown className="w-3 h-3" /></div>
                    </TableHead>
                    <TableHead className="text-right py-4 px-6 font-bold uppercase tracking-wider text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></TableCell></TableRow>
                  ) : filteredAndSortedDepartments.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 font-medium">No units found matching your criteria.</TableCell></TableRow>
                  ) : (
                    filteredAndSortedDepartments.map((dept, idx) => (
                      <motion.tr 
                        key={dept.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <TableCell className="py-4 pl-6">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all">
                                {dept.code?.charAt(0) || "D"}
                            </div>
                        </TableCell>
                        <TableCell className="py-4 px-6 font-mono text-sm font-bold text-slate-500 uppercase">{dept.code}</TableCell>
                        <TableCell className="py-4 px-6">
                            <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{dept.name}</p>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                              onClick={() => handleEdit(dept)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                              onClick={() => handleDelete(dept.id)}
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
