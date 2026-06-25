import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContentCard } from "@/components/layout/ContentCard";
import { StatsRow } from "@/components/layout/StatsRow";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  UserMinus,
  Shield,
  Mail,
  Lightbulb,
  Link2,
} from "lucide-react";

export function ReferralsSection() {
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
      toast({
        title: "Invite link updated",
        description: `A new ${data.type === "admin" ? "admin" : "observer"} code has been generated.`,
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId) => {
      const res = await fetch(apiUrl(buildUrl(api.workspaces.removeMember.path, { id: memberId })), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to remove member");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workspaces.current.path] });
      toast({ title: "Member removed", description: "Access has been revoked for this member." });
      setRemovingMember(null);
    },
    onError: (error) => {
      toast({ title: "Could not remove member", description: error.message, variant: "destructive" });
      setRemovingMember(null);
    },
  });

  const referralCode = wsData?.referralCode || workspace?.referralCode || "--------";
  const adminReferralCode = wsData?.adminReferralCode || workspace?.adminReferralCode || "--------";
  const members = wsData?.members || [];

  const observersJoined = members.filter((m) => m.role !== "owner").length;
  const adminsJoined = members.filter((m) => m.role === "owner").length;
  const totalInvitations = Math.max(0, members.length - 1);

  function copyCode(code, type) {
    navigator.clipboard.writeText(code);
    setCopied({ ...copied, [type]: true });
    toast({
      title: "Copied to clipboard",
      description: `${type === "admin" ? "Admin" : "Observer"} invite link copied.`,
    });
    setTimeout(() => setCopied({ ...copied, [type]: false }), 2000);
  }

  const InviteCard = ({ type, code, title, description, icon: Icon }) => (
    <ContentCard
      header={
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-[15px] font-display font-black text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 font-medium">{description}</p>
          </div>
        </div>
      }
    >
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-lg font-mono font-bold text-slate-800 tracking-wider break-all">{code}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border-slate-200"
            onClick={() => copyCode(code, type)}
          >
            {copied[type] ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 rounded-xl font-semibold text-sm border-slate-200 text-slate-600 hover:text-teal-700 hover:border-teal-200"
        onClick={() => isOwner && regenerateMutation.mutate(type === "admin" ? "admin" : "viewer")}
        disabled={!isOwner || regenerateMutation.isPending}
      >
        <RefreshCw
          className={`w-4 h-4 mr-2 ${regenerateMutation.isPending && regenerateMutation.variables === (type === "admin" ? "admin" : "viewer") ? "animate-spin" : ""}`}
        />
        Regenerate Code
      </Button>
      {!isOwner && (
        <p className="text-[11px] text-center text-slate-400 font-medium mt-3">
          Only workspace owners can regenerate invite codes.
        </p>
      )}
    </ContentCard>
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
          { label: "Observers Joined", value: observersJoined, icon: Users, colorClass: "text-teal-600" },
          { label: "Admins Joined", value: adminsJoined, icon: ShieldCheck, colorClass: "text-cyan-600" },
          { label: "Total Invitations", value: totalInvitations, icon: Link2, colorClass: "text-emerald-600" },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InviteCard
          type="viewer"
          code={referralCode}
          title="Observer Invite Link"
          description="Read-only access to schedules and data."
          icon={Users}
        />
        <InviteCard
          type="admin"
          code={adminReferralCode}
          title="Admin Invite Link"
          description="Full management capabilities for the workspace."
          icon={ShieldCheck}
        />
      </div>

      <ContentCard title="Sharing Tips" description="Best practices for growing your workspace team.">
        <div className="space-y-3">
          {[
            "Share the Observer link with faculty who need to view timetables without making changes.",
            "Use the Admin link only for trusted coordinators who will manage departments, faculty, and schedules.",
            "Regenerate codes if a link was shared with the wrong person — old codes will stop working.",
            "Review the member list regularly and remove access for users who no longer need it.",
          ].map((tip, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600 font-medium">{tip}</p>
            </div>
          ))}
        </div>
      </ContentCard>

      <ContentCard
        title="Workspace Members"
        description={`${members.length} active member${members.length === 1 ? "" : "s"} in this workspace.`}
      >
        {members.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No members found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {members.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 hover:border-teal-100 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black uppercase shrink-0 ${
                        member.role === "owner" ? "bg-teal-600 text-white" : "bg-white text-slate-500 border border-slate-200"
                      }`}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{member.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {member.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                        member.role === "owner"
                          ? "bg-teal-50 text-teal-700 border border-teal-100"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {member.role === "owner" ? "Admin" : "Observer"}
                    </span>
                    {isOwner && member.userId !== user?.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => setRemovingMember(member)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ContentCard>

      <Dialog open={!!removingMember} onOpenChange={(v) => !v && setRemovingMember(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900">Remove member</DialogTitle>
            <DialogDescription className="text-slate-500 pt-1">
              Remove <span className="font-bold text-slate-800">{removingMember?.name}</span> from this workspace?
              They will lose access to all shared resources immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setRemovingMember(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeMemberMutation.mutate(removingMember?.id)}
              disabled={removeMemberMutation.isPending}
              className="rounded-xl font-bold"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Backward-compatible export
export { ReferralsSection as ReferralContent };
