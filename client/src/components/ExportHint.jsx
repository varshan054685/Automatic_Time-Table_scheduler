import { useState } from "react";
import { X, Lightbulb } from "lucide-react";
import { useUser } from "@/hooks/use-auth";

export function ExportHint() {
  const { user } = useUser();
  const isOwner = user?.workspace?.role === "owner";
  const [dismissed, setDismissed] = useState(false);

  // Only show to admins who haven't exported yet
  if (!isOwner) return null;
  if (dismissed) return null;
  if (localStorage.getItem("hasExportedOnce") === "true") return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 shadow-sm">
      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="flex-1">
        <span className="font-semibold">Tip:</span> Export Excel to get a pre-filled template with reference data for easy import.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-amber-100 transition-colors"
      >
        <X className="w-3.5 h-3.5 text-amber-500" />
      </button>
    </div>
  );
}
