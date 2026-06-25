import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown, Trash2, LogOut, Loader2, ShieldAlert } from "lucide-react";

export function DangerZoneSection() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";

  const [expanded, setExpanded] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const workspaceName = user?.workspace?.workspaceName || "";

  const deleteWsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(api.workspaces.delete.path), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete workspace");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Workspace deleted successfully." });
    },
  });

  const leaveWsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(api.workspaces.leave.path), { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to leave workspace");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "You have left the workspace." });
    },
  });

  const isPending = deleteWsMutation.isPending || leaveWsMutation.isPending;
  const canDelete = isOwner && confirmName.trim() === workspaceName.trim();

  const handleLeave = () => {
    if (confirm("Are you sure you want to leave this workspace?")) {
      leaveWsMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (
      confirm(
        "WARNING: This will permanently delete the workspace and ALL associated data (Timetables, Departments, Faculty, etc). This action cannot be undone. Are you sure?"
      )
    ) {
      deleteWsMutation.mutate();
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
                      <h4 className="text-sm font-black text-rose-900">
                        {isOwner ? "Delete Workspace" : "Leave Workspace"}
                      </h4>
                      <p className="text-sm text-rose-700/80 mt-1 font-medium leading-relaxed">
                        {isOwner
                          ? "Permanently delete this workspace and all associated data including timetables, departments, faculty, and schedules. This cannot be undone."
                          : "Leave this workspace and lose access to all shared resources. You can rejoin with an invite code."}
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
                        onClick={isOwner ? handleDelete : handleLeave}
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isOwner ? (
                          <Trash2 className="w-4 h-4" />
                        ) : (
                          <LogOut className="w-4 h-4" />
                        )}
                        {isPending
                          ? "Processing..."
                          : isOwner
                            ? "Delete Workspace"
                            : "Leave Workspace"}
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
