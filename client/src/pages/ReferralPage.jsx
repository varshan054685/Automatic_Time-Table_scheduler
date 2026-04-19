import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, RefreshCw, Users, Shield, Check, UserMinus, AlertTriangle, Fingerprint, Share2, ShieldCheck, Mail, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export function ReferralContent() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState({});
  const [removingMember, setRemovingMember] = useState(null);

  const workspace = user?.workspace;
  const isOwner = workspace?.role === "owner";

  const { data: wsData } = useQuery({
    queryKey: [api.workspaces.current.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.workspaces.current.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    },
    enabled: !!workspace,
  });

  const regenerateMutation = useMutation({
    mutationFn: async (type) => {
      const res = await fetch(apiUrl(api.workspaces.regenerateCode.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to regenerate ${type} code`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.workspaces.current.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: `Architecture Updated`, description: `A new ${data.type} gateway code has been encrypted and deployed.` });
    },
  });

  const referralCode = wsData?.referralCode || workspace?.referralCode || "--------";
  const adminReferralCode = wsData?.adminReferralCode || workspace?.adminReferralCode || "--------";
  const members = wsData?.members || [];

  function copyCode(code, type) {
    navigator.clipboard.writeText(code);
    setCopied({ ...copied, [type]: true });
    toast({ title: "Authorization Copied", description: `The ${type === 'admin' ? 'Administrative' : 'Observer'} token is on your clipboard.` });
    setTimeout(() => setCopied({ ...copied, [type]: false }), 2000);
  }

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const res = await fetch(apiUrl(buildUrl(api.workspaces.removeMember.path, { id: memberId })), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Termination failed");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workspaces.current.path] });
      toast({ title: "Access Revoked", description: "The member has been successfully purged from the workspace." });
      setRemovingMember(null);
    },
    onError: (error) => {
      toast({ title: "Protocol Refused", description: error.message, variant: "destructive" });
      setRemovingMember(null);
    },
  });

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
                    <Share2 className="w-6 h-6 text-indigo-600" />
                </div>
                <h1 className="text-3xl font-display font-black text-slate-900 tracking-tight">Access Control</h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">Distribute encrypted gateways to orchestrate your workspace collaboration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", damping: 15 }}>
            <Card className="border-0 shadow-2xl shadow-indigo-500/5 rounded-[2.5rem] overflow-hidden bg-white group border border-slate-100">
                <div className="h-1 bg-indigo-500" />
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Observer Gateway</span>
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 mt-4">Viewer Protocol</CardTitle>
                    <CardDescription className="font-medium text-slate-400">Authorize users with read-only access to schedules.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-6 mb-6">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-2xl font-mono font-black tracking-[0.3em] text-indigo-600 break-all">
                                {referralCode}
                            </span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-14 w-14 shrink-0 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" 
                                onClick={() => copyCode(referralCode, 'viewer')}
                            >
                                {copied['viewer'] ? <Check className="w-6 h-6 text-emerald-500" /> : <Copy className="w-6 h-6" />}
                            </Button>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full h-12 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all disabled:opacity-30"
                        onClick={() => isOwner && regenerateMutation.mutate('viewer')}
                        disabled={!isOwner || regenerateMutation.isPending}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${(regenerateMutation.isPending && regenerateMutation.variables === 'viewer') ? "animate-spin" : ""}`} />
                        {(regenerateMutation.isPending && regenerateMutation.variables === 'viewer') ? "Generating Token..." : "Regenerate Gateway"}
                    </Button>
                    {!isOwner && (
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight mt-4 italic">
                            Authorization restricted to administrators
                        </p>
                    )}
                </CardContent>
            </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", damping: 15 }}>
            <Card className="border-0 shadow-2xl shadow-rose-500/5 rounded-[2.5rem] overflow-hidden bg-white group border border-slate-100">
                <div className="h-1 bg-rose-500" />
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full">Admin Gateway</span>
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 mt-4">Administrative Protocol</CardTitle>
                    <CardDescription className="font-medium text-slate-400">Authorize full read/write management capabilities.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-rose-50/30 border-2 border-rose-100/50 rounded-[1.5rem] p-6 mb-6">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-2xl font-mono font-black tracking-[0.3em] text-rose-600 break-all">
                                {adminReferralCode}
                            </span>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-14 w-14 shrink-0 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" 
                                onClick={() => copyCode(adminReferralCode, 'admin')}
                            >
                                {copied['admin'] ? <Check className="w-6 h-6 text-emerald-500" /> : <Copy className="w-6 h-6" />}
                            </Button>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full h-12 border-2 border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-rose-600 hover:border-rose-100 transition-all disabled:opacity-30"
                        onClick={() => isOwner && regenerateMutation.mutate('admin')}
                        disabled={!isOwner || regenerateMutation.isPending}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${(regenerateMutation.isPending && regenerateMutation.variables === 'admin') ? "animate-spin" : ""}`} />
                        {(regenerateMutation.isPending && regenerateMutation.variables === 'admin') ? "Generating Token..." : "Regenerate Gateway"}
                    </Button>
                    {!isOwner && (
                        <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight mt-4 italic">
                            Authorization restricted to administrators
                        </p>
                    )}
                </CardContent>
            </Card>
        </motion.div>
      </div>

      <Card className="border-0 shadow-2xl shadow-indigo-500/5 rounded-[2.5rem] overflow-hidden bg-white border border-slate-100 mb-10">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <Users className="w-7 h-7 text-indigo-600" />
                        Workspace Synchronicity
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium mt-1">Currently synchronizing {members.length} active session(s).</CardDescription>
                </div>
                <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm">
                    <Fingerprint className="w-6 h-6 text-slate-400" />
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
                {members.map((member) => (
                <motion.div 
                    key={member.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex items-center justify-between p-5 bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/5 rounded-2xl transition-all group"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black uppercase ${member.role === 'owner' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {member.name.charAt(0)}
                        </div>
                        <div>
                            <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{member.name}</p>
                            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5"><Mail className="w-3 h-3" /> {member.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                        member.role === "owner" 
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                        : "bg-slate-50 text-slate-400 border-slate-200"
                    }`}>
                        {member.role === "owner" ? "ADMIN" : "VIEWER"}
                    </span>
                    {isOwner && member.userId !== user?.id && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 h-10 w-10 rounded-xl transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                            onClick={() => setRemovingMember(member)}
                        >
                        <UserMinus className="w-5 h-5" />
                        </Button>
                    )}
                    </div>
                </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!removingMember} onOpenChange={(v) => !v && setRemovingMember(null)}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-0 p-8 shadow-2xl">
          <DialogHeader className="mb-6">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-rose-100/50">
                <Shield className="w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                Revoke Protocol Access
            </DialogTitle>
            <DialogDescription className="text-lg font-medium text-slate-500 pt-2 leading-relaxed">
              Confirm termination for <span className="font-black text-rose-600">{removingMember?.name}</span>? 
              This will immediately collapse their access to all workspace resources and encrypted schedules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-0 mt-4">
            <Button variant="ghost" className="h-12 px-6 rounded-xl font-bold text-slate-400 hover:text-slate-900 hover:bg-slate-50" onClick={() => setRemovingMember(null)}>
              Abort Protocol
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeMemberMutation.mutate(removingMember?.id)}
              disabled={removeMemberMutation.isPending}
              className="h-12 px-8 rounded-xl font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700 shadow-xl shadow-rose-500/20"
            >
              <UserMinus className="w-4 h-4 mr-2" />
              {removeMemberMutation.isPending ? "Executing..." : "Confirm Purge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
