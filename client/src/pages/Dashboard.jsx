import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { useDepartments, useFaculty, useSections, useClassrooms } from "@/hooks/use-master-data";
import { Building2, GraduationCap, Users, BookOpen, CalendarDays, UserCog, LayoutGrid, Settings, Clock, FileEdit, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { useUser } from "@/hooks/use-auth";
import { Link } from "wouter";

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
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1  p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8 animate-in pt-12 lg:pt-0">
          <div>
            <h1 className="text-3xl font-display font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Overview of college resources and statistics.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="Departments" 
              value={departments?.length || 0} 
              icon={Building2} 
              colorClass="text-blue-600 bg-blue-50"
            />
            <StatCard 
              label="Faculty Members" 
              value={faculty?.length || 0} 
              icon={GraduationCap}
              colorClass="text-purple-600 bg-purple-50"
            />
            <StatCard 
              label="Active Sections" 
              value={sections?.length || 0} 
              icon={Users}
              colorClass="text-green-600 bg-green-50"
            />
            <StatCard 
              label="Classrooms" 
              value={classrooms?.length || 0} 
              icon={BookOpen}
              colorClass="text-orange-600 bg-orange-50"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pending Requests Panel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Pending Requests
                  </h3>
                  {pendingRequests.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {pendingRequests.length}
                    </span>
                  )}
                </div>
                
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <p>No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingRequests.map((req) => {
                      const data = req.data || {};
                      return (
                        <div key={req.id} onClick={() => navigate("/settings?tab=requests")} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                            {req.type === "edit" ? (
                              <FileEdit className="w-4 h-4 text-blue-500" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                            <div>
                              <p className="font-medium text-slate-900 text-sm">
                                {req.type === "edit" ? "Edit" : "Delete"} → {data.table}
                              </p>
                              <p className="text-xs text-slate-500">
                                by {req.requesterName || req.requesterEmail} • {new Date(req.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="mt-auto pt-4 border-t border-slate-100 text-center">
                  <span onClick={() => navigate("/settings?tab=requests")} className="text-sm text-primary hover:underline cursor-pointer py-2 px-4 inline-block tracking-wide font-medium">View all requests →</span>
                </div>
              </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: CalendarDays, label: "Generate Timetable", desc: "Create a new schedule for a semester", path: "/timetable", color: "text-blue-500 bg-blue-50" },
                  { icon: UserCog, label: "Manage Faculty", desc: "Add or update faculty details", path: "/faculty", color: "text-purple-500 bg-purple-50" },
                  { icon: LayoutGrid, label: "View Schedule", desc: "Check current academic timetable", path: "/timetable", color: "text-green-500 bg-green-50" },
                  { icon: Settings, label: "System Settings", desc: "Configure settings", path: "/settings", color: "text-orange-500 bg-orange-50" },
                ].map(({ icon: Icon, label, desc, path, color }) => (
                  <button
                    key={label}
                    onClick={() => navigate(path)}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all text-left group"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color} group-hover:scale-110 transition-transform`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h4 className="font-medium text-slate-900">{label}</h4>
                    <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
