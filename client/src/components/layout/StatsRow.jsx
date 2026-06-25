import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";

export function StatsRow({ items = [] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      {items.map((it, idx) => (
        <div key={it.label || idx} className="h-full">
          <StatCard
            label={it.label}
            value={it.value}
            icon={it.icon}
            colorClass={it.colorClass}
          />
        </div>
      ))}
    </motion.section>
  );
}
