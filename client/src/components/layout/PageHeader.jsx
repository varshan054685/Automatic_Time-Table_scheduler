import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

const routeLabels = {
  "/":            "Dashboard",
  "/departments": "Departments",
  "/classrooms":  "Classrooms",
  "/faculty":     "Faculty",
  "/sections":    "Sections",
  "/subjects":    "Subjects",
  "/timeslots":   "Time Slots",
  "/timetable":   "Timetable",
  "/settings":    "Settings",
};

export function PageHeader({ title, subtitle, rightActions }) {
  const [location] = useLocation();
  const isHome = location === "/";

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"
    >
      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        {!isHome && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            <Home className="w-3 h-3" />
            <ChevronRight className="w-3 h-3 opacity-50" />
            <span className="text-teal-600">{routeLabels[location] || title}</span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-[28px] font-display font-black text-slate-900 tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-500 mt-1 text-sm font-medium">{subtitle}</p>
        )}
      </div>

      {rightActions && (
        <div className="flex items-center gap-3 shrink-0">{rightActions}</div>
      )}
    </motion.header>
  );
}
