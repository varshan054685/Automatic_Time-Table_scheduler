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
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, useDepartments } from "@/hooks/use-master-data";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

function SubjectImport({ departments, onImportComplete }) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();
  const createMutation = useCreateSubject();

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let successCount = 0;
        let errorCount = 0;

        for (const item of data) {
          const name = item["Name"] || item.name;
          const code = item["Code"] || item.code;
          const hours = item["Weekly Hours"] || item.weeklyHours;
          const deptSearch = item["Department"] || item.department || item.departmentCode;

          if (name && code) {
            const dept = departments?.find(d => d.name === deptSearch || d.code === deptSearch);
            try {
              await createMutation.mutateAsync({ 
                name, 
                code: String(code), 
                weeklyHours: Number(hours || 0),
                departmentId: dept ? dept.id : Number(item.departmentId || 0),
                type: "theory"
              });
              successCount++;
            } catch (err) {
              errorCount++;
            }
          }
        }

        toast({ 
          title: "Import Complete", 
          description: `Successfully imported ${successCount} subjects.${errorCount > 0 ? ` Failed to import ${errorCount} records.` : ""}`,
          variant: errorCount > 0 ? "destructive" : "default"
        });
        
        if (onImportComplete) onImportComplete();
      } catch (error) {
        toast({ title: "Import Failed", description: "Failed to read Excel file", variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
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
  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const deleteMutation = useDeleteSubject();

  const form = useForm({
    resolver: zodResolver(api.subjects.create.input),
    defaultValues: { name: "", code: "", weeklyHours: 0, departmentId: 0, type: "theory" },
  });

  const onSubmit = (values) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...values }, {
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
      createMutation.mutate(values, {
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
    form.reset({ name: subject.name, code: subject.code, weeklyHours: subject.weeklyHours, departmentId: subject.departmentId, type: subject.type || "theory" });
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
              <SubjectImport departments={departments} onImportComplete={refetch} />

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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filteredAndSortedSubjects.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No subjects found</TableCell></TableRow>
                ) : (
                  filteredAndSortedSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-mono">{subject.code}</TableCell>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.weeklyHours}</TableCell>
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
