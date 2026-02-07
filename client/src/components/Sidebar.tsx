import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  BookOpen, 
  GraduationCap, 
  CalendarDays, 
  Clock,
  LogOut,
  Calendar
} from "lucide-react";
import { useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Classrooms", href: "/classrooms", icon: Users }, // Using Users icon as generic placeholder, but Classrooms is specific
  { label: "Subjects", href: "/subjects", icon: BookOpen },
  { label: "Faculty", href: "/faculty", icon: GraduationCap },
  { label: "Sections", href: "/sections", icon: Users },
  { label: "Time Slots", href: "/timeslots", icon: Clock },
  { label: "Timetable", href: "/timetable", icon: CalendarDays },
];

export function Sidebar() {
  const [location] = useLocation();
  const logoutMutation = useLogout();

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-display font-bold text-lg">College</h1>
            <p className="text-xs text-slate-400">Scheduler Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div 
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
                  ${isActive 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 font-medium translate-x-1' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30 gap-3"
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </div>
  );
}
