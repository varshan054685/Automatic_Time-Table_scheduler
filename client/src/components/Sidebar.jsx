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
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
    if (isMobile) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, [isMobile]);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const isOwner = user?.workspace?.role === "owner";
  const workspaceName = user?.workspace?.workspaceName || "Workspace";

  const { data: requests = [] } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.changeRequests.list.path), { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
    enabled: isOwner,
    refetchInterval: 5000,
  });
  
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg premium-gradient flex items-center justify-center text-white">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-slate-900">{workspaceName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
            <Menu className="w-6 h-6 text-slate-600" />
          </Button>
        </div>
      )}

      {/* Sidebar Container */}
      <AnimatePresence mode="wait">
        {(isOpen || !isMobile) && (
          <motion.div 
            initial={isMobile ? { x: -300 } : false}
            animate={{ x: 0, width: isOpen ? 280 : 80 }}
            exit={isMobile ? { x: -300 } : false}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className={`h-screen bg-slate-900 text-white flex flex-col z-40 shrink-0 shadow-2xl
              ${isMobile ? 'fixed top-0 left-0' : 'sticky top-0'}
              ${!isOpen && !isMobile ? 'w-20' : 'w-[280px]'}
            `}
          >
            {/* Logo Section */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0 h-24">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                  <Calendar className="w-6 h-6" />
                </div>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="overflow-hidden"
                  >
                    <h1 className="font-display font-bold text-lg truncate w-32">{workspaceName}</h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {isOwner ? "Administrator" : "Viewer"}
                    </p>
                  </motion.div>
                )}
              </div>
              {!isMobile && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleSidebar} 
                  className="hover:bg-slate-800 text-slate-500 hover:text-white shrink-0"
                >
                  {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </Button>
              )}
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-slate-400">
                  <X className="w-6 h-6" />
                </Button>
              )}
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} onClick={() => isMobile && setIsOpen(false)}>
                        <div 
                          className={`
                            group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-300 relative
                            ${isActive 
                              ? 'bg-indigo-600/10 text-white font-medium' 
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                            }
                          `}
                        >
                          {isActive && (
                            <motion.div 
                              layoutId="active-nav"
                              className="absolute inset-0 bg-indigo-600 rounded-xl -z-10 shadow-lg shadow-indigo-600/20"
                            />
                          )}
                          <item.icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                          {isOpen && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="truncate"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </div>
                      </Link>
                    </TooltipTrigger>
                    {!isOpen && !isMobile && (
                      <TooltipContent side="right" className="font-semibold text-slate-900" sideOffset={10}>
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}

              <div className="my-6 border-t border-slate-800/50"></div>

              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href="/settings" onClick={() => isMobile && setIsOpen(false)}>
                    <div 
                      className={`
                        group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-300 relative
                        ${location === '/settings' 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-medium' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <SettingsIcon className={`w-5 h-5 shrink-0 ${location === '/settings' ? 'scale-110' : 'group-hover:scale-110'}`} />
                        {isOpen && (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            Settings
                          </motion.span>
                        )}
                      </div>
                      {isOwner && pendingCount > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-rose-500/50">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                {!isOpen && !isMobile && (
                  <TooltipContent side="right" className="font-semibold text-slate-900" sideOffset={10}>
                    Settings
                  </TooltipContent>
                )}
              </Tooltip>
            </nav>

            {/* Footer Section */}
            <div className="p-4 border-t border-slate-800/50 shrink-0 bg-slate-900/50 backdrop-blur-sm">
              <div className={`flex items-center gap-3 mb-4 ${!isOpen && 'justify-center'}`}>
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
                  {user?.name?.charAt(0) || "U"}
                </div>
                {isOpen && (
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                )}
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className={`w-full hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 gap-3 justify-start rounded-xl px-3 transition-colors ${!isOpen && 'justify-center px-0'}`}
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {isOpen && <span>Sign Out</span>}
                  </Button>
                </TooltipTrigger>
                {!isOpen && !isMobile && (
                  <TooltipContent side="right" className="font-semibold text-slate-900" sideOffset={10}>
                    Sign Out
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile backdrop */}
      {isMobile && isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
