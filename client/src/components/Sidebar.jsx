import { useState } from "react";
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
  Calendar,
  Menu,
  X,
  School,
  Link2,
  ClipboardList
} from "lucide-react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Classrooms", href: "/classrooms", icon: School },
  { label: "Faculty", href: "/faculty", icon: GraduationCap },
  { label: "Sections", href: "/sections", icon: Users },
  { label: "Subjects", href: "/subjects", icon: BookOpen },
  { label: "Time Slots", href: "/timeslots", icon: Clock },
  { label: "Timetable", href: "/timetable", icon: CalendarDays },
  { label: "Referral Code", href: "/referral", icon: Link2 },
  { label: "Requests", href: "/requests", icon: ClipboardList, ownerOnly: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const { user } = useUser();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const isOwner = user?.workspace?.role === "owner";
  const workspaceName = user?.workspace?.workspaceName || "Workspace";

  const filteredNavItems = navItems.filter((item) => {
    if (item.ownerOnly && !isOwner) return false;
    return true;
  });

  const sidebarContent = (
    <div className={`h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 border-r border-slate-800 z-50 transition-transform duration-300 ${isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'}`}>
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-display font-bold text-lg">{workspaceName}</h1>
            <p className="text-xs text-slate-400">
              {isOwner ? "Owner" : "Viewer"} • {user?.name}
            </p>
          </div>
        </div>
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <X className="w-6 h-6" />
          </Button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={() => isMobile && setIsOpen(false)}>
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

  return (
    <>
      {isMobile && (
        <div className="fixed top-4 left-4 z-40">
          <Button variant="outline" size="icon" onClick={toggleSidebar} className="bg-white shadow-md">
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      )}
      {sidebarContent}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40" 
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
