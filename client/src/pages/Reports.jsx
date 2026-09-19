import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BarChart3,
  Building2,
  FileText,
  FolderOpen,
  GraduationCap,
  Loader2,
  Printer,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REPORTS = [
  {
    kind: "timetable",
    title: "Timetable Report",
    description:
      "A printable weekly grid for every section, showing subject, teacher and room for each period.",
    Icon: CalendarDays,
    action: "Export timetable PDF",
  },
  {
    kind: "teacherWorkload",
    title: "Teacher Workload",
    description:
      "Periods assigned per teacher with weekly/daily limits and observed overloads.",
    Icon: GraduationCap,
    action: "Export workload PDF",
  },
  {
    kind: "roomUtilization",
    title: "Room Utilization",
    description:
      "How many of the available teaching periods each classroom or lab is actually used for.",
    Icon: Building2,
    action: "Export utilization PDF",
  },
  {
    kind: "analytics",
    title: "Schedule Analytics",
    description:
      "Totals, distribution of periods across the week, per-section load and any detected conflicts.",
    Icon: BarChart3,
    action: "Export analytics PDF",
  },
];

export default function ReportsPage() {
  const [exporting, setExporting] = useState(null);
  const { toast } = useToast();

  const handleExport = async (kind, title) => {
    setExporting(kind);
    try {
      const result = await window.api.pdf.exportReport(kind);
      if (result?.cancelled) return;
      toast({ title: `${title} exported`, description: result.path });
    } catch (err) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppShell
      pageTitle="Reports"
      pageSubtitle="Printable PDF reports — generated locally, no internet required"
      rightActions={
        <Button
          variant="outline"
          onClick={() => window.api.system.openPath("exports")}
          className="gap-2 h-10 px-4 rounded-xl border-slate-200 font-bold text-sm hover:border-teal-300 hover:text-teal-700"
        >
          <FolderOpen className="w-4 h-4" /> Exports folder
        </Button>
      }
    >
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 flex items-start gap-3">
          <FileText className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-500 font-medium">
            Reports are rendered and printed on this computer, then saved as PDF wherever you
            choose. Nothing is uploaded.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORTS.map(({ kind, title, description, Icon, action }) => (
            <Card key={kind} className="p-5 border border-slate-100 rounded-2xl flex flex-col">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-teal-600" />
                </div>
                <h2 className="text-base font-display font-black text-slate-900">{title}</h2>
              </div>
              <p className="text-sm text-slate-500 font-medium flex-1">{description}</p>
              <Button
                onClick={() => handleExport(kind, title)}
                disabled={exporting !== null}
                className="mt-4 gap-2 h-10 rounded-xl font-bold premium-gradient shadow-lg shadow-teal-500/20"
              >
                {exporting === kind ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Printer className="w-4 h-4" /> {action}</>
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
