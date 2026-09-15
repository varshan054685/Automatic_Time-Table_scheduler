import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { clearInstitutionIdCache } from "@/lib/desktop-api";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, Trash2, Loader2, ShieldAlert } from "lucide-react";

/**
 * Danger Zone — offline edition. "Delete Workspace" becomes "Reset All Data":
 * a verified safety backup is created first, then all academic rows are wiped.
 * Visual design is unchanged from the original.
 */
export function DangerZoneSection() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";

  const [expanded, setExpanded] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const workspaceName = user?.workspace?.workspaceName || "";

  const resetMutation = useMutation({
    mutationFn: async () => {
      // Safety backup before the destructive operation (spec §13).
      await window.api.backup.create("before-reset");
      // Wipe all academic data. The IPC handler clears rows inside one
      // transaction (see api:data:resetAll in electron/ipc/register.ts).
      return window.api.data.resetAll();
    },
    onSuccess: () => {
      clearInstitutionIdCache();
      queryClient.invalidateQueries();
      toast({ title: "All data has been reset. A safety backup was saved first." });
    },
    onError: (err) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const isPending = resetMutation.isPending;
  const canDelete = isOwner && confirmName.trim() === workspaceName.trim();

  const handleDelete = () => {
    if (!canDelete) return;
    if (
      confirm(
        "WARNING: This will permanently delete ALL data (Timetables, Departments, Faculty, etc). A safety backup will be saved first. This action cannot be undone. Are you sure?"
      )
    ) {
      resetMutation.mutate();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <ContentCard className="border-rose-100">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-6 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="text-[15px] font-display font-black text-slate-900">Advanced Settings</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Destructive actions — proceed with caution.
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 pt-0 border-t border-rose-50">
                <div className="mt-6 p-5 rounded-xl bg-rose-50/80 border border-rose-100 relative">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-black text-rose-900">Reset All Data</h4>
                      <p className="text-sm text-rose-700/80 mt-1 font-medium leading-relaxed">
                        Permanently delete all data including timetables, departments, faculty, and
                        schedules. A verified safety backup is created first so you can restore later
                        from Settings → Data. This cannot be undone.
                      </p>

                      {isOwner && (
                        <div className="mt-4 space-y-2">
                          <label className="text-[11px] font-black uppercase tracking-wider text-rose-800/70">
                            Type <span className="font-mono">{workspaceName}</span> to confirm
                          </label>
                          <Input
                            className="h-11 rounded-xl border-rose-200 bg-white focus:border-rose-400 font-medium"
                            value={confirmName}
                            onChange={(e) => setConfirmName(e.target.value)}
                            placeholder={workspaceName}

                          />
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="destructive"
                        className="mt-4 h-10 px-5 rounded-xl font-bold flex items-center gap-2"
                        disabled={isPending || (isOwner && !canDelete)}
                        onClick={handleDelete}
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {isPending ? "Processing..." : "Reset All Data"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ContentCard>
    </motion.div>
  );
}
