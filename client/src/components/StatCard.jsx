import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export function StatCard({ label, value, icon: Icon, colorClass = "text-primary" }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card className="overflow-hidden border-0 bg-white/50 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-300 group">
        <CardContent className="p-6 relative">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <Icon className={`w-24 h-24 ${colorClass}`} />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <h3 className="text-3xl font-display font-bold text-slate-900">{value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm border border-slate-100 ${colorClass} group-hover:scale-110 transition-transform`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-1">
            <div className={`h-1 w-12 rounded-full ${colorClass.split(' ')[0]} bg-current opacity-20`} />
            <div className="h-1 flex-1 rounded-full bg-slate-100" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
