import {
  User,
  Building2,
  Link2,
  ClipboardList,
  ShieldAlert,
} from "lucide-react";

export const SETTINGS_SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "referrals", label: "Referrals", icon: Link2 },
  { id: "requests", label: "Requests", icon: ClipboardList, badge: true },
  { id: "danger", label: "Danger Zone", icon: ShieldAlert, danger: true },
];

export function SettingsNav({ active, onChange, pendingCount = 0 }) {
  return (
    <>
      {/* Desktop sidebar nav */}
      <nav className="hidden lg:block w-[220px] shrink-0">
        <div className="sticky top-6 space-y-1">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon, badge, danger }) => {
            const isActive = active === id;
            const showBadge = badge && pendingCount > 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                  isActive
                    ? danger
                      ? "bg-rose-50 text-rose-700 border border-rose-100"
                      : "bg-teal-50 text-teal-700 border border-teal-100"
                    : danger
                      ? "text-rose-500 hover:bg-rose-50/60 hover:text-rose-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive && !danger ? "text-teal-600" : ""}`} />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile pill tabs */}
      <div className="lg:hidden -mx-1 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 px-1 pb-1 min-w-max">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon, badge, danger }) => {
            const isActive = active === id;
            const showBadge = badge && pendingCount > 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? danger
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-teal-50 text-teal-700 border-teal-200"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {showBadge && (
                  <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
