import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  colorClass?: string;
}

export function StatCard({ label, value, icon: Icon, colorClass = "text-primary" }: StatCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-primary/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <h3 className="text-3xl font-display font-bold text-foreground">{value}</h3>
          </div>
          <div className={`p-4 rounded-full bg-secondary/50 ${colorClass}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
