import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  useDepartments,
  useFaculty,
  useSections,
  useClassrooms,
  useSubjects,
  useTimeSlots,
} from "@/hooks/use-master-data";
import {
  Building2,
  GraduationCap,
  Users,
  BookOpen,
  CalendarDays,
  UserCog,
  Settings,
  Clock,
  FileEdit,
  Trash2,
  ArrowRight,
  Sparkles,
  School,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [, navigate] = useLocation();

  const { data: departments } = useDepartments();
  const { data: faculty }     = useFaculty();
  const { data: sections }    = useSections();
  const { data: classrooms }  = useClassrooms();
  const { data: subjects }    = useSubjects();
  const { data: timeSlots }   = useTimeSlots();

  const { user } = useUser();
  const isOwner  = user?.workspace?.role === "owner";

  const { data: requests = [] } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.changeRequests.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    },
  });

  const pendingRequests = requests.filter((r) => r.status === "pending").slice(0, 5);

  const kpi = [
    { label: "Departments", value: departments?.length || 0, icon: Building2,    colorClass: "text-teal-600" },
    { label: "Faculty",     value: faculty?.length     || 0, icon: GraduationCap, colorClass: "text-cyan-600" },
    { label: "Sections",    value: sections?.length    || 0, icon: Users,         colorClass: "text-emerald-600" },
    { label: "Classrooms",  value: classrooms?.length  || 0, icon: School,        colorClass: "text-orange-600" },
  ];

  // Setup checklist
  const setupItems = [
    { key: "dept",      label: "Departments",  ok: (departments?.length  || 0) > 0, path: "/departments", icon: Building2 },
    { key: "faculty",   label: "Faculty",      ok: (faculty?.length      || 0) > 0, path: "/faculty",     icon: GraduationCap },
    { key: "sections",  label: "Sections",     ok: (sections?.length     || 0) > 0, path: "/sections",    icon: Users },
    { key: "rooms",     label: "Classrooms",   ok: (classrooms?.length   || 0) > 0, path: "/classrooms",  icon: School },
    { key: "subjects",  label: "Subjects",     ok: (subjects?.length     || 0) > 0, path: "/subjects",    icon: BookOpen },
    { key: "timeslots", label: "Time Slots",   ok: (timeSlots?.length    || 0) > 0, path: "/timeslots",   icon: Clock },
  ];

  const completedCount = setupItems.filter((x) => x.ok).length;
  const setupPct = Math.round((completedCount / setupItems.length) * 100);
  const healthLabel =
    setupPct >= 100 ? "Ready to generate" :
    setupPct >= 66  ? "Almost there"      :
    setupPct >= 33  ? "In progress"       :
                      "Getting started";

  const firstName = user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AppShell
      pageTitle={`${greeting}, ${firstName}!`}
      pageSubtitle={`${user?.workspace?.workspaceName} · Academic Scheduler`}
      rightActions={
        <Button
          onClick={() => navigate("/timetable")}
          className="premium-gradient gap-2 h-10 px-5 rounded-xl shadow-lg shadow-teal-500/25 text-sm font-bold"
        >
          <Zap className="w-4 h-4" />
          Generate Timetable
        </Button>
      }
      stats={
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpi.map((it, i) => (
            <motion.div key={it.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <StatCard label={it.label} value={it.value} icon={it.icon} colorClass={it.colorClass} />
            </motion.div>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick Actions */}
          <ContentCard
            header={
              <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg premium-gradient flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-[15px] font-display font-black text-slate-900">Quick Actions</h3>
              </div>
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: BookOpen,    label: "Subjects",   desc: "Courses & mapping", path: "/subjects",    from: "#0891b2", to: "#0e7490" },
                { icon: UserCog,     label: "Faculty",    desc: "Roles & load",      path: "/faculty",     from: "#0f9f87", to: "#0d9488" },
                { icon: CalendarDays,label: "Timetable",  desc: "View schedules",    path: "/timetable",   from: "#059669", to: "#10b981" },
                { icon: Settings,    label: "Settings",   desc: "Configuration",     path: "/settings",    from: "#d97706", to: "#f59e0b" },
              ].map(({ icon: Icon, label, desc, path, from, to }, idx) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  onClick={() => navigate(path)}
                  className="group p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-transparent hover:bg-white cursor-pointer transition-all"
                  style={{ "--hover-shadow": `0 4px 20px -4px ${from}33` }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px -4px ${from}33`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${from}22, ${to}33)` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: from }} />
                  </div>
                  <p className="text-[12px] font-black text-slate-900 group-hover:text-teal-600 transition-colors uppercase tracking-tight">
                    {label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{desc}</p>
                </motion.div>
              ))}
            </div>
          </ContentCard>

          {/* Recent Activity */}
          <ContentCard
            header={
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-500" />
                  <h3 className="text-[15px] font-display font-black text-slate-900">Recent Activity</h3>
                </div>
                {pendingRequests.length > 0 && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    {pendingRequests.length} pending
                  </span>
                )}
              </div>
            }
          >
            {pendingRequests.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-teal-100">
                  <CheckCircle2 className="w-6 h-6 text-teal-500" />
                </div>
                <p className="text-slate-500 font-semibold text-sm">All clear — no pending tasks.</p>
                <p className="text-slate-400 text-xs mt-1">You're up to date!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => {
                  const data = req.data || {};
                  return (
                    <div
                      key={req.id}
                      onClick={() => navigate("/settings?tab=requests")}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-transparent hover:border-teal-100 hover:bg-white cursor-pointer group transition-all"
                      style={{ boxShadow: "0 0 0 0 transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px -4px rgba(15,160,135,0.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${req.type === "edit" ? "bg-cyan-100 text-cyan-600" : "bg-rose-100 text-rose-600"}`}>
                          {req.type === "edit" ? <FileEdit className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {req.type === "edit" ? "Edit" : "Delete"} {data.table}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            <span className="text-teal-600">{req.requesterName || "System"}</span>
                            {" · "}{new Date(req.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  className="w-full text-teal-600 hover:text-teal-700 hover:bg-teal-50 font-bold text-sm mt-1"
                  onClick={() => navigate("/settings?tab=requests")}
                >
                  View All Activity
                </Button>
              </div>
            )}
          </ContentCard>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Setup Progress */}
          <ContentCard
            header={
              <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-500" />
                <h3 className="text-[15px] font-display font-black text-slate-900">Setup Progress</h3>
              </div>
            }
          >
            <div className="mb-4">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-4xl font-display font-black text-slate-900">{setupPct}%</p>
                  <p className="text-sm font-semibold text-slate-400 mt-0.5">{healthLabel}</p>
                </div>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #0f9f8722, #0891b233)" }}
                >
                  <Sparkles className="w-5 h-5 text-teal-600" />
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${setupPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #0f9f87, #0891b2)" }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">
                {completedCount} of {setupItems.length} steps complete
              </p>
            </div>

            <div className="space-y-1.5">
              {setupItems.map((x) => (
                <button
                  key={x.key}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-teal-100 transition-all text-left"
                  onClick={() => navigate(x.path)}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${x.ok ? "bg-emerald-100" : "bg-slate-200"}`}>
                    {x.ok
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      : <AlertCircle className="w-3 h-3 text-slate-400" />
                    }
                  </div>
                  <span className={`text-[12px] font-bold flex-1 ${x.ok ? "text-slate-500 line-through" : "text-slate-800"}`}>
                    {x.label}
                  </span>
                  {!x.ok && <ArrowRight className="w-3 h-3 text-slate-300" />}
                </button>
              ))}
            </div>
          </ContentCard>

          {/* Generate CTA */}
          <div
            className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0d1f2d 0%, #0f2b3d 100%)" }}
          >
            {/* decorative blobs */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #0f9f87, transparent)" }} />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #0891b2, transparent)" }} />

            <div className="relative z-10">
              <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h4 className="font-display font-black text-base mb-1">Ready to schedule?</h4>
              <p className="text-[12px] text-slate-400 mb-4 leading-relaxed">
                Generate conflict-free timetables for all sections automatically.
              </p>
              <button
                onClick={() => navigate("/timetable")}
                className="w-full py-2.5 rounded-xl text-[13px] font-black premium-gradient shadow-lg shadow-teal-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Open Timetable →
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
