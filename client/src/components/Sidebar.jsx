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
  Menu,
  X,
  School,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useLogout, useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/Logo";

const navItems = [
  { label: "Dashboard",   href: "/",            icon: LayoutDashboard, color: "text-cyan-400" },
  { label: "Departments", href: "/departments",  icon: Building2,       color: "text-teal-400" },
  { label: "Classrooms",  href: "/classrooms",   icon: School,          color: "text-sky-400" },
  { label: "Faculty",     href: "/faculty",      icon: GraduationCap,   color: "text-emerald-400" },
  { label: "Sections",    href: "/sections",     icon: Users,           color: "text-green-400" },
  { label: "Subjects",    href: "/subjects",     icon: BookOpen,        color: "text-lime-400" },
  { label: "Time Slots",  href: "/timeslots",    icon: Clock,           color: "text-amber-400" },
  { label: "Timetable",   href: "/timetable",    icon: CalendarDays,    color: "text-orange-400" },
];

export function Sidebar() {
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const { user } = useUser();
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sidebarOpen");
      if (stored !== null) return stored === "true";
    }
    return false;
  });

  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [isMobile]);

  const toggleSidebar = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarOpen", newState);
    }
  };

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

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <>
      {/* ── Mobile Header ── */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-xl border-b border-teal-100 z-50 flex items-center justify-between px-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg premium-gradient flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-slate-800 text-sm truncate max-w-[140px]">
              {workspaceName}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="text-slate-600">
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      )}

      {/* ── Sidebar Container ── */}
      <AnimatePresence mode="wait">
        {(isOpen || !isMobile) && (
          <motion.div
            initial={isMobile ? { x: -300 } : false}
            animate={{ x: 0, width: isOpen ? 264 : 68 }}
            exit={isMobile ? { x: -300 } : false}
            transition={{ type: "spring", damping: 22, stiffness: 120 }}
            className={`
              ${isMobile ? "h-[100dvh]" : "h-screen"}
              sidebar-gradient text-white flex flex-col z-40 shrink-0
              ${isMobile ? "fixed top-0 left-0 shadow-2xl" : "sticky top-0"}
              ${!isOpen && !isMobile ? "w-[68px]" : "w-[264px]"}
            `}
            style={{
              boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
            }}
          >
            {/* ── Logo ── */}
            <div className="px-4 py-5 flex items-center justify-between shrink-0 border-b border-white/5 h-[72px]">
              <div className="flex items-center gap-3 overflow-hidden min-w-0">
                {/* Teal brand mark */}
                <div className="w-9 h-9 rounded-xl premium-gradient flex items-center justify-center shrink-0 shadow-lg shadow-teal-900/40">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="overflow-hidden min-w-0"
                  >
                    <h1 className="font-display font-bold text-[15px] text-white truncate leading-tight">
                      {workspaceName}
                    </h1>
                    <p className="text-[10px] text-teal-400/80 uppercase tracking-widest font-semibold mt-0.5">
                      {isOwner ? "Administrator" : "Viewer"}
                    </p>
                  </motion.div>
                )}
              </div>
              {!isMobile && (
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors shrink-0 ml-1"
                >
                  {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}
              {isMobile && (
                <button onClick={() => setIsOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* ── Nav ── */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar min-h-0">
              {/* Section label */}
              {isOpen && (
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 px-3 pb-2 pt-1">
                  Navigation
                </p>
              )}

              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link href={item.href} onClick={() => isMobile && setIsOpen(false)}>
                        <div
                          className={`
                            group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer
                            transition-all duration-200 relative select-none
                            ${isActive
                              ? "text-white"
                              : "text-slate-400 hover:text-white hover:bg-white/6"
                            }
                          `}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="active-nav"
                              className="absolute inset-0 rounded-xl -z-10"
                              style={{
                                background: "linear-gradient(135deg, rgba(15,160,135,0.35) 0%, rgba(8,145,178,0.25) 100%)",
                                borderLeft: "3px solid #0fa888",
                                boxShadow: "0 0 20px rgba(15,160,135,0.15)",
                              }}
                            />
                          )}
                          <item.icon
                            className={`w-[18px] h-[18px] shrink-0 transition-all duration-200
                              ${isActive ? item.color : "text-slate-500 group-hover:" + item.color.replace("text-", "text-")}`}
                          />
                          {isOpen && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[13px] font-semibold truncate"
                            >
                              {item.label}
                            </motion.span>
                          )}
                          {isActive && isOpen && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400"
                            />
                          )}
                        </div>
                      </Link>
                    </TooltipTrigger>
                    {!isOpen && !isMobile && (
                      <TooltipContent side="right" className="font-semibold" sideOffset={12}>
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}

              {/* Divider */}
              <div className="my-3 mx-3 border-t border-white/6" />

              {/* Settings */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href="/settings" onClick={() => isMobile && setIsOpen(false)}>
                    <div
                      className={`
                        group flex items-center justify-between px-3 py-2.5 rounded-xl
                        cursor-pointer transition-all duration-200 relative select-none
                        ${location === "/settings"
                          ? "text-white"
                          : "text-slate-400 hover:text-white hover:bg-white/6"
                        }
                      `}
                    >
                      {location === "/settings" && (
                        <motion.div
                          layoutId="active-nav"
                          className="absolute inset-0 rounded-xl -z-10"
                          style={{
                            background: "linear-gradient(135deg, rgba(15,160,135,0.35) 0%, rgba(8,145,178,0.25) 100%)",
                            borderLeft: "3px solid #0fa888",
                          }}
                        />
                      )}
                      <div className="flex items-center gap-3">
                        <SettingsIcon className={`w-[18px] h-[18px] shrink-0 transition-all ${location === "/settings" ? "text-teal-400" : "text-slate-500"}`} />
                        {isOpen && (
                          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] font-semibold">
                            Settings
                          </motion.span>
                        )}
                      </div>
                      {isOwner && pendingCount > 0 && (
                        <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-lg shadow-amber-500/40">
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      )}
                    </div>
                  </Link>
                </TooltipTrigger>
                {!isOpen && !isMobile && (
                  <TooltipContent side="right" className="font-semibold" sideOffset={12}>
                    Settings {pendingCount > 0 && `(${pendingCount})`}
                  </TooltipContent>
                )}
              </Tooltip>
            </nav>

            {/* ── Footer ── */}
            <div className="p-3 border-t border-white/6 shrink-0 safe-area-pb">
              {/* User card */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-default mb-1 ${!isOpen && "justify-center"}`}>
                    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden border-2 border-teal-500/30 flex items-center justify-center text-sm font-black"
                      style={{ background: "linear-gradient(135deg, #0f9f87, #0891b2)" }}
                    >
                      {user?.avatar
                        ? <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                        : <span className="text-white text-[11px]">{initials}</span>
                      }
                    </div>
                    {isOpen && (
                      <div className="overflow-hidden min-w-0">
                        <p className="text-[12px] font-bold text-white truncate leading-tight">{user?.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                {!isOpen && !isMobile && (
                  <TooltipContent side="right" sideOffset={12} className="flex flex-col gap-0.5">
                    <p className="font-bold">{user?.name}</p>
                    <p className="text-xs text-slate-400 font-normal">{user?.email}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              {/* Sign out */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-xl
                      text-slate-500 hover:text-rose-400 hover:bg-rose-500/10
                      transition-all duration-200 text-[12px] font-semibold
                      ${!isOpen && "justify-center"}
                    `}
                    onClick={() => { logoutMutation.mutate(); if (isMobile) setIsOpen(false); }}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {isOpen && <span>Sign Out</span>}
                  </button>
                </TooltipTrigger>
                {!isOpen && !isMobile && (
                  <TooltipContent side="right" sideOffset={12} className="font-semibold">
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
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
