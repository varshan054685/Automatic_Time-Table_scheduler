import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
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
      toast({ title: `New ${data.type} referral code generated!` });
    },
  });

  const referralCode = wsData?.referralCode || workspace?.referralCode || "--------";
  const adminReferralCode = wsData?.adminReferralCode || workspace?.adminReferralCode || "--------";
  const members = wsData?.members || [];

  function copyCode(code, type) {
    navigator.clipboard.writeText(code);
    setCopied({ ...copied, [type]: true });
    toast({ title: `${type === 'admin' ? 'Admin' : 'Viewer'} referral code copied!` });
    setTimeout(() => setCopied({ ...copied, [type]: false }), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Referral Code</h1>
        <p className="text-slate-500 mt-1">Share your workspace with others</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Viewer Code
            </CardTitle>
            <CardDescription>Share this code to invite Viewers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-100 rounded-xl px-4 py-3 text-center">
                <span className="text-xl font-mono font-bold tracking-[0.2em] text-indigo-600">
                  {referralCode}
                </span>
              </div>
              <Button variant="outline" size="icon" className="h-12 w-12 shadow-sm border-slate-200" onClick={() => copyCode(referralCode, 'viewer')}>
                {copied['viewer'] ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </Button>
            </div>

            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full border-slate-200 shadow-sm disabled:opacity-50"
                onClick={() => isOwner && regenerateMutation.mutate('viewer')}
                disabled={!isOwner || regenerateMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(regenerateMutation.isPending && regenerateMutation.variables === 'viewer') ? "animate-spin" : ""}`} />
                {(regenerateMutation.isPending && regenerateMutation.variables === 'viewer') ? "Generating..." : "Generate New"}
              </Button>
              {!isOwner && (
                <p className="text-xs text-center text-slate-500 mt-2">
                  Only admins can generate a new code
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-500" />
              Admin Code
            </CardTitle>
            <CardDescription>Share this code to invite other Admins</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-rose-50 rounded-xl px-4 py-3 text-center">
                <span className="text-xl font-mono font-bold tracking-[0.2em] text-rose-600">
                  {adminReferralCode}
                </span>
              </div>
              <Button variant="outline" size="icon" className="h-12 w-12 shadow-sm border-slate-200" onClick={() => copyCode(adminReferralCode, 'admin')}>
                {copied['admin'] ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </Button>
            </div>

            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full border-slate-200 shadow-sm disabled:opacity-50"
                onClick={() => isOwner && regenerateMutation.mutate('admin')}
                disabled={!isOwner || regenerateMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${(regenerateMutation.isPending && regenerateMutation.variables === 'admin') ? "animate-spin" : ""}`} />
                {(regenerateMutation.isPending && regenerateMutation.variables === 'admin') ? "Generating..." : "Generate New"}
              </Button>
              {!isOwner && (
                <p className="text-xs text-center text-slate-500 mt-2">
                  Only admins can generate a new code
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  {member.role === "owner" ? "Admin" : "Viewer"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
