import { ContentCard } from "@/components/layout/ContentCard";

export function EmptyStateCard({
  title = "Nothing to show",
  description = "Try adjusting your filters or create something new.",
  icon,
  action,
}) {
  return (
    <ContentCard className="py-12">
      <div className="flex flex-col items-center text-center gap-4">
        {icon ? (
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <p className="text-slate-500 font-medium mt-2">{description}</p>
        </div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </ContentCard>
  );
}
