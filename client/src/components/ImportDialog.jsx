import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getInstitutionId } from "@/lib/desktop-api";

const KIND_LABELS = {
  departments: "Departments",
  classrooms: "Classrooms",
  faculty: "Faculty",
  subjects: "Subjects",
  sections: "Sections",
  timeslots: "Time Slots",
};

/** Query keys to refresh after an import (master data + dependent timetable). */
const KIND_QUERY_KEYS = {
  departments: ["departments"],
  classrooms: ["classrooms"],
  faculty: ["faculty"],
  subjects: ["subjects"],
  sections: ["sections"],
  timeslots: ["time-slots"],
};

/**
 * Excel import with a mandatory review step (spec §12): the main process parses
 * and validates the workbook, this dialog shows exactly what will be created,
 * updated or rejected, and only then does the user commit.
 */
export function ImportDialog({ kind, label = "Import" }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const entityLabel = KIND_LABELS[kind] ?? kind;

  // Audit trail: every preview is recorded, applied or not.
  const { data: batches } = useQuery({
    queryKey: ["import-batches", kind],
    queryFn: () => window.api.excel.batches(),
    enabled: open,
    staleTime: 5_000,
  });
  const recent = (batches ?? []).filter((b) => b.entityType === kind).slice(0, 5);

  const reset = () => {
    setReport(null);
    setIsPreviewing(false);
    setIsCommitting(false);
  };

  const handleOpenChange = (next) => {
    setOpen(next);
    if (!next) reset();
  };

  const handlePick = async () => {
    setIsPreviewing(true);
    try {
      const institutionId = await getInstitutionId();
      const result = await window.api.excel.preview(kind, institutionId);
      if (result?.cancelled) return;
      setReport(result);
    } catch (err) {
      toast({ title: "Could not read the file", description: err.message, variant: "destructive" });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!report?.batchId) return;
    setIsCommitting(true);
    try {
      const result = await window.api.excel.commit(report.batchId);
      queryClient.invalidateQueries({ queryKey: KIND_QUERY_KEYS[kind] ?? [] });
      queryClient.invalidateQueries({ queryKey: ["timetable"] });
      toast({
        title: `${entityLabel} imported`,
        description: `${result.created} created, ${result.updated} updated.`,
      });
      handleOpenChange(false);
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setIsCommitting(false);
    }
  };

  const handleTemplate = async () => {
    try {
      const result = await window.api.excel.template(kind);
      if (result?.cancelled) return;
      toast({ title: "Template saved", description: result.path });
    } catch (err) {
      toast({ title: "Could not save the template", description: err.message, variant: "destructive" });
    }
  };

  const previewColumns = report?.preview?.[0] ? Object.keys(report.preview[0]) : [];

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold hover:border-teal-300 hover:text-teal-700"
      >
        <Upload className="w-4 h-4" /> {label}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl rounded-2xl border border-slate-100 max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display font-black flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              Import {entityLabel}
            </DialogTitle>
            <DialogDescription>
              Nothing is written until you confirm. You will see every row that is valid, updated or
              rejected first.
            </DialogDescription>
          </DialogHeader>

          {!report ? (
            <div className="py-4 space-y-4">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">
                  Choose an Excel file ({".xlsx"} / {".xls"} / {".csv"})
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  The first sheet is imported. Column headers are matched loosely.
                </p>
                <div className="flex items-center justify-center gap-2.5 mt-5">
                  <Button
                    onClick={handlePick}
                    disabled={isPreviewing}
                    className="gap-2 h-10 px-5 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20"
                  >
                    {isPreviewing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Reading…</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Choose file</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleTemplate}
                    className="gap-2 h-10 px-4 rounded-xl font-bold border-slate-200"
                  >
                    <Download className="w-4 h-4" /> Template
                  </Button>
                </div>
              </div>

              {recent.length > 0 && (
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                    Recent imports
                  </p>
                  <ul className="space-y-1">
                    {recent.map((b) => (
                      <li key={b.id} className="text-xs text-slate-500 flex justify-between gap-3">
                        <span className="truncate">{b.fileName}</span>
                        <span className="shrink-0 font-semibold">
                          {b.validRows} rows · {b.applied ? "applied" : "not applied"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {report.validRows} valid
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {report.duplicateRows} to update / duplicate
                </span>
                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> {report.errorRows} rejected
                </span>
                <span className="text-slate-400 font-semibold ml-auto">
                  {report.fileName} · {report.totalRows} row(s)
                </span>
              </div>

              {report.errors?.length > 0 && (
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 max-h-40 overflow-y-auto">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-1.5">
                    Rejected rows (not imported)
                  </p>
                  <ul className="space-y-1">
                    {report.errors.map((e, i) => (
                      <li key={i} className="text-xs text-rose-700">
                        Row {e.row}
                        {e.field ? ` · ${e.field}` : ""} — {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.warnings?.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 max-h-32 overflow-y-auto">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-1.5">
                    Warnings
                  </p>
                  <ul className="space-y-1">
                    {report.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {w.row > 0 ? `Row ${w.row}: ` : ""}
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.preview?.length > 0 && (
                <div className="rounded-xl border border-slate-100 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        {previewColumns.map((c) => (
                          <th
                            key={c}
                            className="text-left px-2.5 py-2 font-black uppercase tracking-wider text-[10px] text-slate-400 whitespace-nowrap"
                          >
                            {c.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.preview.map((row, i) => (
                        <tr key={i} className="border-t border-slate-50">
                          {previewColumns.map((c) => (
                            <td key={c} className="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">
                              {row[c] === null || row[c] === undefined ? "—" : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {report.preview?.length > 0 && report.validRows > report.preview.length && (
                <p className="text-[11px] text-slate-400 font-semibold">
                  Showing the first {report.preview.length} of {report.validRows} valid rows.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handlePick}
                  disabled={isPreviewing || isCommitting}
                  className="h-10 px-4 rounded-xl font-bold border-slate-200"
                >
                  Choose another file
                </Button>
                <Button
                  onClick={handleCommit}
                  disabled={report.validRows === 0 || isCommitting}
                  className="h-10 px-5 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20"
                >
                  {isCommitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                  ) : (
                    `Import ${report.validRows} row${report.validRows === 1 ? "" : "s"}`
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
