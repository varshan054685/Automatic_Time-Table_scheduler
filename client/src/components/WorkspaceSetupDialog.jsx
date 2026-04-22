import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Users, ArrowRight, Sparkles, KeyRound, LogOut } from "lucide-react";
import { useLogout } from "@/hooks/use-auth";

export function WorkspaceSetupDialog() {
  const [mode, setMode] = useState(null); // null, 'create', 'join'
  const [workspaceName, setWorkspaceName] = useState("");
  const [referralCode, setReferralCode] = useState("");
   const queryClient = useQueryClient();
   const logoutMutation = useLogout();

  const createMutation = useMutation({
    mutationFn: async (name) => {
      const res = await fetch(apiUrl(api.workspaces.create.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create workspace");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (code) => {
      const res = await fetch(apiUrl(api.workspaces.join.path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: code }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Invalid referral code");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });

  if (!mode) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6 select-none cursor-default">
             <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-3 shadow-lg">
               <Sparkles className="w-7 h-7" />
             </div>
             <h2 className="text-2xl font-bold text-white">Welcome! Let's get started</h2>
             <p className="text-slate-400 mt-1">Choose how you'd like to begin</p>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
             <Card 
               className="cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all bg-white/5 backdrop-blur border-white/10 group select-none"
               onClick={() => setMode("create")}
             >
               <CardContent className="p-6 text-center">
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 mb-4 group-hover:bg-indigo-500/30 transition-colors">
                   <Plus className="w-6 h-6" />
                 </div>
                 <h3 className="font-semibold text-white text-lg">Create Workspace</h3>
                 <p className="text-sm text-slate-400 mt-1">Set up a new workspace and invite members</p>
               </CardContent>
             </Card>

             <Card 
               className="cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all bg-white/5 backdrop-blur border-white/10 group select-none"
               onClick={() => setMode("join")}
             >
               <CardContent className="p-6 text-center">
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 mb-4 group-hover:bg-purple-500/30 transition-colors">
                   <Users className="w-6 h-6" />
                 </div>
                 <h3 className="font-semibold text-white text-lg">Join via Referral</h3>
                 <p className="text-sm text-slate-400 mt-1">Enter a code to join an existing workspace</p>
               </CardContent>
             </Card>
           </div>

           <div className="text-center">
             <Button 
               variant="ghost" 
               className="text-slate-400 hover:text-rose-400 gap-2"
               onClick={() => logoutMutation.mutate()}
               disabled={logoutMutation.isPending}
             >
               <LogOut className="w-4 h-4" />
               {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
             </Button>
           </div>
         </div>
       </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader className="select-none cursor-default">
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Create Workspace
            </CardTitle>
            <CardDescription className="text-slate-400">Give your workspace a name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
               placeholder="e.g., ABC College Scheduler"
               value={workspaceName}
               onChange={(e) => setWorkspaceName(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === "Enter" && workspaceName.trim() && !createMutation.isPending) {
                   createMutation.mutate(workspaceName);
                 }
               }}
               className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
             />
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                className="text-slate-400 hover:text-white"
                onClick={() => setMode(null)}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-0"
                disabled={!workspaceName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(workspaceName)}
              >
                {createMutation.isPending ? "Creating..." : (
                  <span className="flex items-center gap-2">Create <ArrowRight className="w-4 h-4" /></span>
                )}
              </Button>
            </div>
            {createMutation.error && (
              <p className="text-sm text-red-400 text-center">{createMutation.error.message}</p>
            )}
            <div className="pt-2 border-t border-white/5">
               <Button 
                 variant="ghost" 
                 size="sm"
                 className="w-full text-slate-500 hover:text-rose-400 gap-2 h-8"
                 onClick={() => logoutMutation.mutate()}
                 disabled={logoutMutation.isPending}
               >
                 <LogOut className="w-3 h-3" />
                 Sign Out
               </Button>
             </div>
           </CardContent>
        </Card>
      </div>
    );
  }

  // Join mode
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader className="select-none cursor-default">
          <CardTitle className="text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-purple-400" /> Join via Referral
          </CardTitle>
          <CardDescription className="text-slate-400">Enter the referral code shared with you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
             placeholder="Enter referral code"
             value={referralCode}
             onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
             onKeyDown={(e) => {
               if (e.key === "Enter" && referralCode.trim() && !joinMutation.isPending) {
                 joinMutation.mutate(referralCode);
               }
             }}
             className="h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 tracking-widest text-center font-mono text-lg"
           />
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              className="text-slate-400 hover:text-white"
              onClick={() => setMode(null)}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0"
              disabled={!referralCode.trim() || joinMutation.isPending}
              onClick={() => joinMutation.mutate(referralCode)}
            >
              {joinMutation.isPending ? "Joining..." : (
                <span className="flex items-center gap-2">Join Workspace <ArrowRight className="w-4 h-4" /></span>
              )}
            </Button>
          </div>
          {joinMutation.error && (
            <p className="text-sm text-red-400 text-center">{joinMutation.error.message}</p>
          )}
          <div className="pt-2 border-t border-white/5">
            <Button 
              variant="ghost" 
              size="sm"
              className="w-full text-slate-500 hover:text-rose-400 gap-2 h-8"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
