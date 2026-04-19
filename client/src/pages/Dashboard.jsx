import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { useDepartments, useFaculty, useSections, useClassrooms } from "@/hooks/use-master-data";
import { Building2, GraduationCap, Users, BookOpen, CalendarDays, UserCog, LayoutGrid, Settings, Clock, FileEdit, Trash2, ArrowRight, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { useUser } from "@/hooks/use-auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: departments } = useDepartments();
  const { data: faculty } = useFaculty();
  const { data: sections } = useSections();
  const { data: classrooms } = useClassrooms();
  const { user } = useUser();
  const isOwner = user?.workspace?.role === "owner";

  // Fetch pending requests
  const { data: requests = [] } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.changeRequests.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    },
  });

  const pendingRequests = requests.filter((r) => r.status === "pending").slice(0, 5);

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-10 pt-12 lg:pt-0">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">
                Welcome back, <span className="text-indigo-600">{user?.name?.split(" ")[0]}!</span>
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Here's what's happening in <span className="text-slate-900">{user?.workspace?.workspaceName}</span> today.</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button onClick={() => navigate("/timetable")} className="premium-gradient premium-gradient-hover shadow-xl shadow-indigo-500/20 gap-2 h-11 px-6">
                <Sparkles className="w-4 h-4" />
                Generate Timetable
              </Button>
            </motion.div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="Departments" 
              value={departments?.length || 0} 
              icon={Building2} 
              colorClass="text-indigo-600"
            />
            <StatCard 
              label="Faculty" 
              value={faculty?.length || 0} 
              icon={GraduationCap}
              colorClass="text-purple-600"
            />
            <StatCard 
              label="Sections" 
              value={sections?.length || 0} 
              icon={Users}
              colorClass="text-emerald-600"
            />
            <StatCard 
              label="Classrooms" 
              value={classrooms?.length || 0} 
              icon={BookOpen}
              colorClass="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions Panel */}
            <div className="lg:col-span-2 space-y-6">
              <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-indigo-500" />
                Quick Management
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: BookOpen, label: "Subjects", desc: "Course syllabus & mapping", path: "/subjects", color: "text-blue-600 bg-blue-50" },
                  { icon: UserCog, label: "Faculty Roles", desc: "Permissions & assignments", path: "/faculty", color: "text-purple-600 bg-purple-50" },
                  { icon: CalendarDays, label: "Schedules", desc: "Weekly academic charts", path: "/timetable", color: "text-emerald-600 bg-emerald-50" },
                  { icon: Settings, label: "System", desc: "Workspace configuration", path: "/settings", color: "text-amber-600 bg-amber-50" },
                ].map(({ icon: Icon, label, desc, path, color }, idx) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => navigate(path)}
                    className="group p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer transition-all flex items-start gap-4"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">{label}</h4>
                      <p className="text-sm text-slate-500 mt-1">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Pending Requests & Alerts */}
            <div className="space-y-6">
              <h3 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Recent Alerts
              </h3>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-medium">All clear! No pending tasks.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((req) => {
                      const data = req.data || {};
                      return (
                        <div key={req.id} onClick={() => navigate("/settings?tab=requests")} className="flex items-center justify-between p-4 bg-slate-50 border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 rounded-2xl transition-all cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${req.type === "edit" ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                              {req.type === "edit" ? <FileEdit className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">
                                {req.type === "edit" ? "Edit" : "Delete"} {data.table}
                              </p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium uppercase tracking-wider">
                                <span className="text-indigo-600">{req.requesterName || "System"}</span> • {new Date(req.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {pendingRequests.length > 0 && (
                  <Button variant="ghost" className="w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold" onClick={() => navigate("/settings?tab=requests")}>
                    View All Activity
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
