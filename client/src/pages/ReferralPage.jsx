import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useUser } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, RefreshCw, Users, Shield, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ReferralContent() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const workspace = user?.workspace;
  const isOwner = workspace?.role === "owner";

  const { data: wsData } = useQuery({
    queryKey: [api.workspaces.current.path],
    queryFn: async () => {
      const res = await fetch(api.workspaces.current.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    },
    enabled: !!workspace,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.workspaces.regenerateCode.path, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to regenerate");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.workspaces.current.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "New referral code generated!" });
    },
  });

  const referralCode = wsData?.referralCode || workspace?.referralCode || "--------";
  const members = wsData?.members || [];

  function copyCode() {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: "Referral code copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Referral Code</h1>
        <p className="text-slate-500 mt-1">Share your workspace with others</p>
      </div>

      <Card className="border-0 shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            Your Workspace Code
          </CardTitle>
          <CardDescription>Anyone with this code can join your workspace as a viewer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-xl px-6 py-4 text-center">
              <span className="text-2xl font-mono font-bold tracking-[0.3em] text-indigo-600">
                {referralCode}
              </span>
            </div>
            <Button variant="outline" size="icon" className="h-14 w-14 shadow-sm border-slate-200" onClick={copyCode}>
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>

          {isOwner && (
            <Button
              variant="outline"
              className="mt-4 w-full border-slate-200 shadow-sm hover:bg-slate-50"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
              {regenerateMutation.isPending ? "Generating..." : "Generate New Code"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Workspace Members
          </CardTitle>
          <CardDescription>{members.length} member(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 shadow-sm rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">{member.name}</p>
                  <p className="text-sm text-slate-500">{member.email}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border ${
                  member.role === "owner" 
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}>
                  {member.role === "owner" ? "Owner" : "Viewer"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
