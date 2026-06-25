import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContentCard } from "@/components/layout/ContentCard";
import { StatsRow } from "@/components/layout/StatsRow";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Check,
  X,
  FileEdit,
  Trash2,
  User,
  ClipboardList,
  Filter,
} from "lucide-react";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-600 border-rose-200",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${styles[status] || "bg-slate-50 text-slate-500 border-slate-200"}`}
    >
      {status}
    </span>
  );
}

export function RequestsSection() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";
  const [filter, setFilter] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.changeRequests.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    },
    refetchInterval: 5000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(apiUrl(buildUrl(api.changeRequests.approve.path, { id })), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.changeRequests.list.path] });
      toast({ title: "Request approved", description: "The change has been applied." });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(apiUrl(buildUrl(api.changeRequests.reject.path, { id })), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reject");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.changeRequests.list.path] });
      toast({ title: "Request rejected", description: "The change request was declined." });
    },
  });

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const rejected = requests.filter((r) => r.status === "rejected");

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }),
    [filtered]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <StatsRow
        items={[
          { label: "Pending", value: pending.length, icon: Clock, colorClass: "text-amber-600" },
          { label: "Approved", value: approved.length, icon: Check, colorClass: "text-emerald-600" },
          { label: "Rejected", value: rejected.length, icon: X, colorClass: "text-rose-600" },
        ]}
      />

      <ContentCard
        header={
          <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-display font-black text-slate-900">Requests Inbox</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isOwner ? "Review and approve change requests from team members." : "Track the status of your submitted requests."}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    filter === id
                      ? "bg-teal-50 text-teal-700 border-teal-200"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-slate-500 text-center py-10">Loading requests...</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center text-center py-12 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No requests found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {filter === "all"
                  ? "Change requests from team members will appear here for review."
                  : `No ${filter} requests at the moment.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {sorted.map((req) => {
                const data = req.data || {};
                const requestType = req.type === "edit" ? "Edit Request" : "Delete Request";
                return (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-teal-100 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          req.type === "edit" ? "bg-cyan-50 text-cyan-600" : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {req.type === "edit" ? <FileEdit className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-slate-900">{requestType}</p>
                          <StatusBadge status={req.status} />
                        </div>
                        <p className="text-sm text-slate-600 font-medium">
                          {data.table}
                          {data.id ? ` #${data.id}` : ""}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          {req.requesterName || req.requesterEmail?.split("@")[0] || "Unknown"}
                          <span>·</span>
                          {new Date(req.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        {req.type === "edit" && data.changes && (
                          <p className="text-[11px] text-slate-500 font-mono mt-2 line-clamp-2 bg-white px-2 py-1 rounded-lg border border-slate-100">
                            {Object.entries(data.changes)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwner && req.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-bold text-xs"
                          onClick={() => approveMutation.mutate(req.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 px-4 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 font-bold text-xs"
                          onClick={() => rejectMutation.mutate(req.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5 mr-1.5" /> Reject
                        </Button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ContentCard>
    </motion.div>
  );
}

export { RequestsSection as RequestsContent };
