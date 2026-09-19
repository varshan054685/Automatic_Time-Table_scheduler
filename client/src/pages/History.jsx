import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileClock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useTimetableVersions,
  useActivateVersion,
  useDeleteVersion,
  useSchedulerHistory,
} from "@/hooks/use-timetable";
import { useToast } from "@/hooks/use-toast";

const STATUS_STYLES = {
  completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-100", Icon: CheckCircle2, label: "Completed" },
  partial: { cls: "bg-amber-50 text-amber-700 border-amber-100", Icon: AlertTriangle, label: "Partial" },
  failed: { cls: "bg-rose-50 text-rose-700 border-rose-100", Icon: XCircle, label: "Failed" },
  cancelled: { cls: "bg-slate-100 text-slate-600 border-slate-200", Icon: XCircle, label: "Cancelled" },
  running: { cls: "bg-sky-50 text-sky-700 border-sky-100", Icon: Loader2, label: "Running" },
  queued: { cls: "bg-slate-100 text-slate-600 border-slate-200", Icon: FileClock, label: "Queued" },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.queued;
  const { Icon } = style;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${style.cls}`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {style.label}
    </span>
  );
}

export default function HistoryPage() {
  const { data: versions, isLoading: loadingVersions, refetch: refetchVersions } = useTimetableVersions();
  const { data: jobs, isLoading: loadingJobs, refetch: refetchJobs } = useSchedulerHistory();
  const activateVersion = useActivateVersion();
  const deleteVersion = useDeleteVersion();
  const [detailsJobId, setDetailsJobId] = useState(null);
  const [details, setDetails] = useState(null);
  const { toast } = useToast();

  const handleActivate = (version) => {
    if (
      !confirm(
        `Restore "${version.label ?? `Version ${version.id}`}"? It becomes the active timetable; the current one stays in this list.`,
      )
    )
      return;
    activateVersion.mutate(version.id, {
      onSuccess: () =>
        toast({ title: "Timetable restored", description: "The selected version is now active." }),
      onError: (err) => toast({ title: "Could not restore", description: err.message, variant: "destructive" }),
    });
  };

  const handleDelete = (version) => {
    if (!confirm(`Delete "${version.label ?? `Version ${version.id}`}" permanently?`)) return;
    deleteVersion.mutate(version.id, {
      onSuccess: () => toast({ title: "Version deleted" }),
      onError: (err) => toast({ title: "Could not delete", description: err.message, variant: "destructive" }),
    });
  };

  const openDetails = async (jobId) => {
    setDetailsJobId(jobId);
    setDetails(null);
    try {
      setDetails(await window.api.scheduler.job(jobId));
    } catch (err) {
      toast({ title: "Could not load job details", description: err.message, variant: "destructive" });
    }
  };

  const diagnostics = (() => {
    if (!details?.diagnostics) return [];
    const diag = details.diagnostics;
    const list = [...(Array.isArray(diag.preflight) ? diag.preflight : [])];
    Object.values(diag.sections ?? {}).forEach((items) => {
      if (Array.isArray(items)) list.push(...items);
    });
    return list;
  })();

  const handleRefresh = () => {
    refetchVersions();
    refetchJobs();
  };

  return (
    <AppShell
      pageTitle="History"
      pageSubtitle="Every generated timetable is kept — restore any previous version"
      rightActions={
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="gap-2 h-10 px-4 rounded-xl border-slate-200 font-bold text-sm hover:border-teal-300 hover:text-teal-700"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      }
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Timetable versions */}
        <Card className="p-5 border border-slate-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-display font-black text-slate-900">Timetable versions</h2>
          </div>

          {loadingVersions ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : !versions || versions.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold py-6 text-center">
              No timetable has been generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                    version.isActive ? "border-teal-200 bg-teal-50/50" : "border-slate-100"
                  }`}
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800 text-sm">
                        {version.label ?? `Version ${version.id}`}
                      </p>
                      {version.isActive && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-600 text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      {version.entries} periods · {version.source ?? "generation"}
                      {version.createdAt ? ` · ${version.createdAt}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!version.isActive && (
                      <Button
                        variant="outline"
                        onClick={() => handleActivate(version)}
                        disabled={activateVersion.isPending}
                        className="gap-2 h-9 px-3 rounded-lg text-xs font-bold border-slate-200 hover:border-teal-300 hover:text-teal-700"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </Button>
                    )}
                    {!version.isActive && (
                      <button
                        onClick={() => handleDelete(version)}
                        title="Delete this version"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Generation runs */}
        <Card className="p-5 border border-slate-100 rounded-2xl">
          <div className="flex items-center gap-2 mb-4">
            <FileClock className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-display font-black text-slate-900">Generation history</h2>
          </div>

          {loadingJobs ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <p className="text-sm text-slate-400 font-semibold py-6 text-center">
              No generation runs yet.
            </p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">Run #{job.id}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                      {job.completedSections}/{job.totalSections} sections
                      {job.failedSections > 0 ? ` · ${job.failedSections} failed` : ""}
                      {job.finishedAt ? ` · ${job.finishedAt}` : ""}
                    </p>
                    {job.error && (
                      <p className="text-[11px] text-rose-600 font-semibold mt-1">{job.error}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => openDetails(job.id)}
                    className="h-9 px-3 rounded-lg text-xs font-bold border-slate-200"
                  >
                    Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog
        open={detailsJobId !== null}
        onOpenChange={(v) => {
          if (!v) {
            setDetailsJobId(null);
            setDetails(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl rounded-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-display font-black">
              Run #{detailsJobId} details
            </DialogTitle>
            <DialogDescription>
              Per-section solver outcome and every diagnostic the scheduler produced.
            </DialogDescription>
          </DialogHeader>

          {!details ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {diagnostics.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">
                    Diagnostics
                  </p>
                  {diagnostics.map((d, i) => (
                    <p key={i} className="text-xs text-amber-800">
                      {d.severity === "error" ? "✕ " : "⚠ "}
                      {d.section ? <strong>{d.section}: </strong> : null}
                      {d.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-slate-100 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      {["Section", "Status", "Solver", "Periods", "Duration"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-black uppercase tracking-wider text-[10px] text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(details.sections ?? []).map((s) => (
                      <tr key={s.section_id} className="border-t border-slate-50">
                        <td className="px-3 py-1.5 font-semibold text-slate-700">
                          {s.section_name ?? `Section ${s.section_id}`}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{s.status}</td>
                        <td className="px-3 py-1.5 text-slate-600">{s.solver_status ?? "—"}</td>
                        <td className="px-3 py-1.5 text-slate-600">{s.entries_count ?? 0}</td>
                        <td className="px-3 py-1.5 text-slate-600">
                          {s.duration_ms ? `${(Number(s.duration_ms) / 1000).toFixed(1)}s` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
