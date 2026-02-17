import { Sidebar } from "@/components/Sidebar";
import { StatCard } from "@/components/StatCard";
import { useDepartments, useFaculty, useSections, useClassrooms } from "@/hooks/use-master-data";
import { Building2, GraduationCap, Users, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { data: departments } = useDepartments();
  const { data: faculty } = useFaculty();
  const { data: sections } = useSections();
  const { data: classrooms } = useClassrooms();

  // Simple data transformation for chart
  const chartData = [
    { name: 'Depts', count: departments?.length || 0 },
    { name: 'Faculty', count: faculty?.length || 0 },
    { name: 'Sections', count: sections?.length || 0 },
    { name: 'Rooms', count: classrooms?.length || 0 },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-4 lg:p-8">
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold mb-6">Resource Distribution</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/50 cursor-pointer transition-colors">
                  <h4 className="font-medium text-slate-900">Generate Timetable</h4>
                  <p className="text-sm text-slate-500 mt-1">Create a new schedule for a semester</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/50 cursor-pointer transition-colors">
                  <h4 className="font-medium text-slate-900">Manage Faculty</h4>
                  <p className="text-sm text-slate-500 mt-1">Add or update faculty details</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/50 cursor-pointer transition-colors">
                  <h4 className="font-medium text-slate-900">View Schedule</h4>
                  <p className="text-sm text-slate-500 mt-1">Check current academic timetable</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 hover:border-primary/50 cursor-pointer transition-colors">
                  <h4 className="font-medium text-slate-900">System Settings</h4>
                  <p className="text-sm text-slate-500 mt-1">Configure academic year</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
