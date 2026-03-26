import { useState, useEffect } from "react";
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
  Settings as SettingsIcon
} from "lucide-react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Classrooms", href: "/classrooms", icon: School },
  { label: "Faculty", href: "/faculty", icon: GraduationCap },
  { label: "Sections", href: "/sections", icon: Users },
  { label: "Subjects", href: "/subjects", icon: BookOpen },
  { label: "Time Slots", href: "/timeslots", icon: Clock },
  { label: "Timetable", href: "/timetable", icon: CalendarDays },
];

export function Sidebar() {
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const { user } = useUser();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const isOwner = user?.workspace?.role === "owner";
  const workspaceName = user?.workspace?.workspaceName || "Workspace";

  const { data: requests = [] } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(api.changeRequests.list.path, { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
    enabled: isOwner,
    refetchInterval: 5000,
  });
  
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      {/* Floating menu button when closed */}
      {(!isOpen || (isMobile && !isOpen)) && (
        <div className="fixed top-4 left-4 z-50">
          <Button variant="outline" size="icon" onClick={toggleSidebar} className="bg-white shadow-md">
            <Menu className="w-6 h-6 text-slate-800" />
          </Button>
        </div>
      )}

      {/* Sidebar Container */}
      <div 
        className={`h-screen bg-slate-900 text-white flex flex-col transition-all duration-300 z-40 shrink-0
          ${isMobile ? 'fixed top-0 left-0' : 'sticky top-0'}
          ${isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'}
        `}
      >
        <div className="w-64 flex flex-col h-full overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary" />
              <div>
                <h1 className="font-display font-bold text-lg truncate max-w-[120px]">{workspaceName}</h1>
                <p className="text-xs text-slate-400">
                  {isOwner ? "Admin" : "Viewer"} • {user?.name?.split(" ")[0]}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hover:bg-slate-800 text-slate-400 hover:text-white shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
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

        <div className="my-4 border-t border-slate-800"></div>

        <Link href="/settings" onClick={() => isMobile && setIsOpen(false)}>
          <div 
            className={`
              flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-all duration-200
              ${location === '/settings' 
                ? 'bg-primary text-white shadow-lg shadow-primary/20 font-medium translate-x-1' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-5 h-5" />
              <span>Settings</span>
            </div>
            {isOwner && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md shadow-red-500/50">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </div>
        </Link>
          </nav>

          <div className="p-4 border-t border-slate-800 shrink-0">
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
      </div>

      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30" 
          onClick={toggleSidebar}
        />
      )}
    </>
  );
}
