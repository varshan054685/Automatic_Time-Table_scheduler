import { motion } from "framer-motion";

// colorMap: maps a Tailwind color class to gradient stops + ring colour
const colorMap = {
  "text-teal-600":    { from: "#0f9f87", to: "#0d9488", ring: "rgba(15,159,135,0.15)", light: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-100" },
  "text-cyan-600":    { from: "#0891b2", to: "#0e7490", ring: "rgba(8,145,178,0.15)",  light: "bg-cyan-50",    text: "text-cyan-700",    border: "border-cyan-100" },
  "text-indigo-600":  { from: "#4f46e5", to: "#7c3aed", ring: "rgba(79,70,229,0.15)",  light: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-100" },
  "text-purple-600":  { from: "#7c3aed", to: "#a855f7", ring: "rgba(124,58,237,0.15)", light: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-100" },
  "text-emerald-600": { from: "#059669", to: "#10b981", ring: "rgba(5,150,105,0.15)",  light: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  "text-orange-600":  { from: "#ea580c", to: "#f97316", ring: "rgba(234,88,12,0.15)",  light: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-100" },
  "text-amber-600":   { from: "#d97706", to: "#f59e0b", ring: "rgba(217,119,6,0.15)",  light: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-100" },
  "text-rose-600":    { from: "#e11d48", to: "#f43f5e", ring: "rgba(225,29,72,0.15)",  light: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-100" },
};

export function StatCard({ label, value, icon: Icon, colorClass = "text-teal-600", trend, trendLabel }) {
  const palette = colorMap[colorClass] || colorMap["text-teal-600"];
  const isPositiveTrend = trend && trend > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
    >
      <div
        className="relative bg-white rounded-2xl border border-slate-100 overflow-hidden group"
        style={{ boxShadow: `0 4px 24px -6px ${palette.ring}` }}
      >
        {/* Accent strip */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, ${palette.from}, ${palette.to})` }}
        />

        {/* Subtle background glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 100% 0%, ${palette.ring} 0%, transparent 70%)`,
          }}
        />

        <div className="relative p-5 pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">
                {label}
              </p>
              <p className="text-4xl font-display font-black text-slate-900 leading-none">
                {value}
              </p>
              {trendLabel && (
                <p className="text-xs font-semibold text-slate-400 mt-1.5">{trendLabel}</p>
              )}
            </div>

            {/* Icon badge */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform duration-300"
              style={{ background: `linear-gradient(135deg, ${palette.from}22, ${palette.to}33)`, border: `1px solid ${palette.from}30` }}
            >
              <Icon className="w-5 h-5" style={{ color: palette.from }} />
            </div>
          </div>

          {/* Trend indicator */}
          {trend !== undefined && (
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isPositiveTrend ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}
              >
                {isPositiveTrend ? "+" : ""}{trend}
              </span>
              <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.abs(value) > 0 ? 60 + (value % 40) : 0)}%`,
                    background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
