import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Upload, Loader2, GraduationCap, Mail, Fingerprint, Building2, FileSpreadsheet } from "lucide-react";
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        let successCount = 0, updateCount = 0, errorCount = 0;
        const errors = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const rowNum = i + 2;
          const name = item["Faculty Name"]||item["Name"]||item.name||item.Name||item["Full Name"];
          const emailRaw = item["Email"]||item.email||item.Email;
          const code = item["Faculty Code"]||item["Code"]||item.code||item.Code;
          const deptSearch = item["Department"]||item.department||item.Department;
          if (name) {
            const dept = departments?.find(d => String(d.name).toLowerCase().trim()===String(deptSearch||"").toLowerCase().trim() || String(d.code).toLowerCase().trim()===String(deptSearch||"").toLowerCase().trim());
            const deptId = dept ? dept.id : (departments && departments.length > 0 ? departments[0].id : null);
            if (!deptId) { errors.push(`Row ${rowNum}: No dept for "${deptSearch}"`); errorCount++; continue; }
            const email = emailRaw && String(emailRaw).includes("@") ? String(emailRaw).trim() : null;
            const existing = faculty?.find(f => (code && String(f.code).toLowerCase()===String(code).toLowerCase()) || (email && String(f.email).toLowerCase()===String(email).toLowerCase()));
            try {
              if (existing) { await updateMutation.mutateAsync({ id: existing.id, name: String(name), code: code ? String(code) : existing.code, email: email||existing.email, departmentId: deptId||existing.departmentId, availability: existing.availability||[] }); updateCount++; }
              else { await createMutation.mutateAsync({ name: String(name), code: code ? String(code) : `FAC${Date.now()}${successCount}`, email, departmentId: deptId, availability: [] }); successCount++; }
            } catch (err) { errors.push(`Row ${rowNum}: ${err.message}`); errorCount++; }
          }
        }
        toast({ title: "Import Complete", description: `Imported ${successCount} new, updated ${updateCount}.${errorCount > 0 ? ` Failed ${errorCount}.` : ""}`, variant: errorCount > 0 ? "destructive" : "default" });
        if (onImportComplete) onImportComplete();
      } catch (error) { toast({ title: "Import Failed", description: error?.message, variant: "destructive" }); }
      finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="relative">
      <Input type="file" accept=".xlsx,.xls" className="hidden" id="import-excel-fac" ref={fileInputRef} onChange={handleImport} disabled={isImporting} />
      <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700 transition-all" asChild disabled={isImporting}>
        <label htmlFor="import-excel-fac" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import"}
        </label>
      </Button>
    </div>
  );
}

const avatarGradients = [
  "linear-gradient(135deg,#0f9f87,#0891b2)",
  "linear-gradient(135deg,#7c3aed,#a855f7)",
  "linear-gradient(135deg,#059669,#10b981)",
  "linear-gradient(135deg,#d97706,#f59e0b)",
  "linear-gradient(135deg,#e11d48,#f43f5e)",
  "linear-gradient(135deg,#2563eb,#0891b2)",
];

export default function Faculty() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
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
      ? faculty.map(f => ({ "Faculty Code": f.code, "Faculty Name": f.name, "Email": f.email, "Department": departments?.find(d => d.id === f.departmentId)?.name || "" }))
      : [{ "Faculty Code": "FAC001", "Faculty Name": "Dr. Alice", "Email": "alice@college.edu", "Department": "Computer Science" }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faculty");
    XLSX.writeFile(wb, "faculty_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    const data = { ...values, departmentId: Number(values.departmentId) };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data }, {
        onSuccess: () => { setOpen(false); setEditingId(null); form.reset(); toast({ title: "Faculty updated" }); },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => { setOpen(false); form.reset(); toast({ title: "Faculty created" }); },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    }
  };

  const handleEdit = (f) => { setEditingId(f.id); form.reset({ name: f.name, code: f.code||"", departmentId: f.departmentId, email: f.email||"", availability: f.availability||[] }); setOpen(true); };
  const handleDelete = (id) => { if (confirm("Delete this faculty member?")) deleteMutation.mutate(id); };
  const handleSort = (key) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" })); };

  const filtered = useMemo(() => {
    if (!faculty) return [];
    let r = faculty.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.code?.toLowerCase().includes(searchTerm.toLowerCase()) || f.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig.key) r.sort((a, b) => a[sortConfig.key] < b[sortConfig.key] ? (sortConfig.direction === "asc" ? -1 : 1) : a[sortConfig.key] > b[sortConfig.key] ? (sortConfig.direction === "asc" ? 1 : -1) : 0);
    return r;
  }, [faculty, searchTerm, sortConfig]);

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
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0f9f8722,#0891b233)" }}>
                    <GraduationCap className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Master Data / Faculty</div>
                </div>
                <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight">Faculty</h1>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Manage and organize your teaching staff.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 flex-wrap">
                <FacultyImport departments={departments} faculty={faculty} onImportComplete={refetch} />
                <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700" onClick={handleExport}>
                  <Upload className="w-4 h-4" /> Export
                </Button>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); form.reset(); } }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 h-10 px-5 rounded-xl text-sm font-bold premium-gradient shadow-lg shadow-teal-500/20">
                      <Plus className="w-4 h-4" /> Add Faculty
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl border border-slate-100">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-display font-black">{editingId ? "Edit Faculty" : "New Faculty Member"}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Full Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="Dr. Alice Johnson" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name="code" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-bold text-slate-700">Faculty Code</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                  <Input placeholder="FAC001" className="pl-10 h-11 rounded-xl uppercase" {...field} />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="departmentId" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-bold text-slate-700">Department</FormLabel>
                              <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                                <FormControl>
                                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                                </FormControl>
                                <SelectContent className="rounded-xl">
                                  {departments?.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Email</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="alice@college.edu" className="pl-10 h-11 rounded-xl" type="email" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full h-11 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20" disabled={createMutation.isPending || updateMutation.isPending}>
                          {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Creating..." : "Add Faculty Member")}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto space-y-4">
            <ExportHint />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search by name, code, or email…" className="pl-11 h-11 bg-white border-slate-200 rounded-xl text-sm focus:border-teal-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {/* Card grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-teal-500" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <GraduationCap className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-semibold text-sm">No faculty members found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((f, idx) => {
                  const grad = avatarGradients[idx % avatarGradients.length];
                  const deptName = departments?.find(d => d.id === f.departmentId)?.name || "—";
                  const initials = f.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="bg-white rounded-2xl border border-slate-100 p-5 group hover:border-teal-200 transition-all"
                      style={{ boxShadow: "0 2px 12px -4px rgba(0,0,0,0.05)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px -6px rgba(15,160,135,0.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px -4px rgba(0,0,0,0.05)"; }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-black text-white shrink-0" style={{ background: grad }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate group-hover:text-teal-600 transition-colors">{f.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono font-bold mt-0.5">{f.code || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => handleEdit(f)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(f.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <Building2 className="w-3 h-3 text-teal-400 shrink-0" />
                          <span className="font-semibold truncate">{deptName}</span>
                        </div>
                        {f.email && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{f.email}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {!isLoading && filtered.length > 0 && (
              <p className="text-[11px] text-slate-400 font-semibold px-1">
                {filtered.length} faculty member{filtered.length !== 1 ? "s" : ""} {searchTerm && `matching "${searchTerm}"`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
