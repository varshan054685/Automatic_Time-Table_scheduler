import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, AlertCircle, Clock, FileEdit, Trash2, X, ClipboardList, Activity, History, ChevronRight, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export function RequestsContent() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";

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
      toast({ title: "Authorization Approved", description: "The requested modification has been merged into the central database." });
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
      toast({ title: "Modification Denied", description: "The change request has been successfully rejected." });
    },
  });

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-10"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-50 rounded-xl">
                    <ClipboardList className="w-6 h-6 text-indigo-600" />
                </div>
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">Audit Pipeline</h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">
                {isOwner ? "Review and approve synchronization requests from the observation layer." : "Trace the status of your submitted modification requests."}
            </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            <Card className="border-0 shadow-2xl shadow-indigo-500/5 rounded-[2.5rem] overflow-hidden bg-white border border-slate-100">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                <Clock className="w-5 h-5" />
                            </div>
                            <CardTitle className="text-2xl font-black text-slate-900">Pending Execution</CardTitle>
                        </div>
                        {pending.length > 0 && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{pending.length} Requests</span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                {pending.length === 0 ? (
                    <div className="text-center py-12">
                        <motion.div 
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100"
                        >
                            <Activity className="w-10 h-10 text-slate-200" />
                        </motion.div>
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">Pipeline Empty • All Operations Synchronized</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {pending.map((req) => {
                            const data = req.data || {};
                            return (
                            <motion.div 
                                key={req.id} 
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-white border-2 border-slate-50 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 rounded-[1.5rem] transition-all gap-6"
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${req.type === "edit" ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {req.type === "edit" ? <FileEdit className="w-7 h-7" /> : <Trash2 className="w-7 h-7" />}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                            {req.type === "edit" ? "Mutation" : "Erasure"} <span className="text-slate-300">→</span> {data.table}
                                            {data.id && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">#{data.id}</span>}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-1">
                                            <User className="w-3 h-3" /> {req.requesterName || req.requesterEmail.split('@')[0]} <span className="text-slate-300">•</span> {new Date(req.createdAt).toLocaleDateString()}
                                        </p>
                                        {req.type === "edit" && data.changes && (
                                            <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                                                <p className="text-[10px] text-slate-500 font-mono line-clamp-1 leading-relaxed">
                                                    {Object.entries(data.changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {isOwner && (
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-12 px-6 rounded-xl text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-black uppercase tracking-widest text-[10px] group/btn"
                                            onClick={() => approveMutation.mutate(req.id)}
                                            disabled={approveMutation.isPending}
                                        >
                                            <Check className="w-4 h-4 mr-2 group-hover/btn:scale-125 transition-transform" /> Commit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-12 px-6 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase tracking-widest text-[10px] group/btn"
                                            onClick={() => rejectMutation.mutate(req.id)}
                                            disabled={rejectMutation.isPending}
                                        >
                                            <X className="w-4 h-4 mr-2 group-hover/btn:scale-125 transition-transform" /> Discard
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    </div>
                )}
                </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
            <Card className="border-0 shadow-2xl shadow-indigo-500/5 rounded-[2.5rem] overflow-hidden bg-white border border-slate-100">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                    <div className="flex items-center gap-3">
                        <History className="w-5 h-5 text-indigo-400" />
                        <CardTitle className="text-xl font-black text-slate-900">Audit History</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    {processed.length === 0 ? (
                        <p className="text-center py-6 text-slate-300 font-bold uppercase tracking-tight text-[10px]">Registry Empty</p>
                    ) : (
                        <div className="space-y-3">
                            {processed.slice(0, 10).map((req) => {
                                const data = req.data || {};
                                return (
                                    <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 border border-transparent hover:border-slate-100 rounded-2xl transition-all cursor-default group">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                                {req.status === 'approved' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                                    {data.table} <ChevronRight className="w-2.5 h-2.5 opacity-30" /> <span className="opacity-50">{req.type}</span>
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{req.requesterName?.split(' ')[0] || "Observer"} • {new Date(req.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'text-emerald-600' : 'text-rose-400'}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </motion.div>
  );
}
