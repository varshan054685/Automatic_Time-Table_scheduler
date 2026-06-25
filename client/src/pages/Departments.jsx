import { useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Search, ArrowUpDown, Pencil, Loader2, Building2, Fingerprint, FileSpreadsheet, Upload } from "lucide-react";
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import * as XLSX from "xlsx";
import { ExportHint } from "@/components/ExportHint";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/layout/PageHeader";

/* ── colour palette per row index ── */
const rowColors = [
  { bg: "bg-teal-50",    text: "text-teal-700",    ring: "border-teal-100" },
  { bg: "bg-cyan-50",    text: "text-cyan-700",    ring: "border-cyan-100" },
  { bg: "bg-emerald-50", text: "text-emerald-700", ring: "border-emerald-100" },
  { bg: "bg-sky-50",     text: "text-sky-700",     ring: "border-sky-100" },
  { bg: "bg-indigo-50",  text: "text-indigo-700",  ring: "border-indigo-100" },
  { bg: "bg-violet-50",  text: "text-violet-700",  ring: "border-violet-100" },
];

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
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        let successCount = 0, updateCount = 0, errorCount = 0;
        for (const item of data) {
          const keys = Object.keys(item);
          const getVal = (...keys2) => { for (const k of keys2) { const f = keys.find(ck => ck.toLowerCase().trim() === k.toLowerCase().trim()); if (f && item[f] !== undefined && item[f] !== "") return item[f]; } return null; };
          const name = getVal("Department Name","Department","Name","name","dept name","Dept Name");
          const code = getVal("Department Code","Code","code","Dept Code","dept code");
          if (name) {
            const finalCode = code ? String(code) : String(name).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
            const existing = departments?.find(d => String(d.name).toLowerCase().trim()===String(name).toLowerCase().trim() || String(d.code).toLowerCase().trim()===finalCode.toLowerCase().trim());
            try {
              if (existing) { await updateMutation.mutateAsync({ id: existing.id, name: String(name), code: finalCode }); updateCount++; }
              else { await createMutation.mutateAsync({ name: String(name), code: finalCode }); successCount++; }
            } catch { errorCount++; }
          }
        }
        toast({ title: "Import Complete", description: `Imported ${successCount} new, updated ${updateCount} departments.${errorCount > 0 ? ` Failed ${errorCount}.` : ""}` });
        if (onImportComplete) onImportComplete();
      } catch (error) {
        toast({ title: "Import Failed", description: error?.message, variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="relative">
      <Input type="file" accept=".xlsx,.xls" className="hidden" id="import-excel-dept" ref={fileInputRef} onChange={handleImport} disabled={isImporting} />
      <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700 transition-all" asChild disabled={isImporting}>
        <label htmlFor="import-excel-dept" className="cursor-pointer">
          {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          {isImporting ? "Importing..." : "Import"}
        </label>
      </Button>
    </div>
  );
}

export default function Departments() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
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
      ? departments.map(d => ({ "Department Name": d.name, "Department Code": d.code }))
      : [{ "Department Name": "Example Dept", "Department Code": "EXM" }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Departments");
    XLSX.writeFile(wb, "departments_template.xlsx");
    localStorage.setItem("hasExportedOnce", "true");
  };

  const onSubmit = (values) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...values }, {
        onSuccess: () => { setOpen(false); setEditingId(null); form.reset(); toast({ title: "Department updated" }); },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    } else {
      createMutation.mutate(values, {
        onSuccess: () => { setOpen(false); form.reset(); toast({ title: "Department created" }); },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      });
    }
  };

  const handleEdit = (dept) => { setEditingId(dept.id); form.reset({ name: dept.name, code: dept.code }); setOpen(true); };
  const handleDelete = (id) => { if (confirm("Delete this department?")) deleteMutation.mutate(id); };
  const handleSort = (key) => { setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" })); };

  const filtered = useMemo(() => {
    if (!departments) return [];
    let r = departments.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.code.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortConfig.key) r.sort((a, b) => a[sortConfig.key] < b[sortConfig.key] ? (sortConfig.direction === "asc" ? -1 : 1) : a[sortConfig.key] > b[sortConfig.key] ? (sortConfig.direction === "asc" ? 1 : -1) : 0);
    return r;
  }, [departments, searchTerm, sortConfig]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Hero strip */}
        <div className="page-hero px-5 lg:px-8 pt-16 lg:pt-7 pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0f9f8722,#0d948833)" }}>
                    <Building2 className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Master Data / Departments
                  </div>
                </div>
                <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight">Departments</h1>
                <p className="text-sm text-slate-500 font-medium mt-0.5">Manage academic units and their distinct identities.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 flex-wrap">
                <DepartmentImport departments={departments} onImportComplete={refetch} />
                <Button variant="outline" className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700" onClick={handleExport}>
                  <Upload className="w-4 h-4" /> Export
                </Button>
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); form.reset(); } }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 h-10 px-5 rounded-xl text-sm font-bold premium-gradient shadow-lg shadow-teal-500/20">
                      <Plus className="w-4 h-4" /> Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl border border-slate-100">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-display font-black">
                        {editingId ? "Edit Department" : "New Department"}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Department Name</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="Computer Science" className="pl-10 h-11 rounded-xl" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="code" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-bold text-slate-700">Department Code</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Fingerprint className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input placeholder="CSE" className="pl-10 h-11 rounded-xl uppercase" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <Button type="submit" className="w-full h-11 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20" disabled={createMutation.isPending || updateMutation.isPending}>
                          {editingId ? (updateMutation.isPending ? "Saving..." : "Save Changes") : (createMutation.isPending ? "Creating..." : "Create Department")}
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

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or code…"
                className="pl-11 h-11 bg-white border-slate-200 rounded-xl text-sm focus:border-teal-400 focus:ring-teal-400 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Table card */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: "0 2px 16px -4px rgba(0,0,0,0.06)" }}>
              {/* Table header */}
              <div className="grid grid-cols-[3rem_1fr_2fr_auto] items-center px-6 py-3 bg-slate-50/80 border-b border-slate-100 gap-4">
                <div />
                <button onClick={() => handleSort("code")} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-teal-600 transition-colors text-left">
                  Code <ArrowUpDown className="w-3 h-3" />
                </button>
                <button onClick={() => handleSort("name")} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-teal-600 transition-colors text-left">
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
                <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 text-right pr-2">Actions</div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-slate-100">
                    <Building2 className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-semibold text-sm">No departments found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filtered.map((dept, idx) => {
                    const palette = rowColors[idx % rowColors.length];
                    return (
                      <motion.div
                        key={dept.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="grid grid-cols-[3rem_1fr_2fr_auto] items-center px-6 py-4 gap-4 group hover:bg-slate-50/60 transition-all"
                      >
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black border ${palette.bg} ${palette.text} ${palette.ring} group-hover:scale-110 transition-transform`}>
                          {dept.code?.charAt(0) || "D"}
                        </div>

                        {/* Code */}
                        <div>
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${palette.bg} ${palette.text} ${palette.ring} border`}>
                            {dept.code}
                          </span>
                        </div>

                        {/* Name */}
                        <p className="font-bold text-slate-900 text-sm group-hover:text-teal-600 transition-colors">{dept.name}</p>

                        {/* Actions */}
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleEdit(dept)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 border border-transparent hover:border-teal-100 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(dept.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              {!isLoading && filtered.length > 0 && (
                <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50">
                  <p className="text-[11px] font-semibold text-slate-400">
                    {filtered.length} department{filtered.length !== 1 ? "s" : ""} {searchTerm && `matching "${searchTerm}"`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
