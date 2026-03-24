import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useUser } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, X, Clock, FileEdit, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RequestsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";

  const { data: requests = [], isLoading } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(api.changeRequests.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(buildUrl(api.changeRequests.approve.path, { id }), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to approve");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.changeRequests.list.path] });
      toast({ title: "Change request approved!" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(buildUrl(api.changeRequests.reject.path, { id }), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reject");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.changeRequests.list.path] });
      toast({ title: "Change request rejected" });
    },
  });

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Change Requests</h1>
            <p className="text-slate-500 mt-1">
              {isOwner ? "Review and manage change requests from viewers" : "Track your submitted change requests"}
            </p>
          </div>

          {/* Pending Requests */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Pending Requests
                {pending.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((req) => {
                    const data = req.data || {};
                    return (
                      <div key={req.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-100">
                        <div className="flex items-center gap-3">
                          {req.type === "edit" ? (
                            <FileEdit className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Trash2 className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {req.type === "edit" ? "Edit" : "Delete"} → {data.table}
                              {data.id ? ` #${data.id}` : ""}
                            </p>
                            <p className="text-sm text-slate-500">
                              by {req.requesterName || req.requesterEmail} • {new Date(req.createdAt).toLocaleDateString()}
                            </p>
                            {req.type === "edit" && data.changes && (
                              <p className="text-xs text-slate-400 mt-1 font-mono">
                                {JSON.stringify(data.changes).slice(0, 100)}
                              </p>
                            )}
                          </div>
                        </div>
                        {isOwner && (
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => approveMutation.mutate(req.id)}
                              disabled={approveMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate(req.id)}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          {processed.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-slate-600">History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {processed.map((req) => {
                    const data = req.data || {};
                    return (
                      <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {req.type === "edit" ? (
                            <FileEdit className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-slate-400" />
                          )}
                          <div>
                            <p className="text-sm text-slate-700">
                              {req.type} → {data.table} #{data.id}
                            </p>
                            <p className="text-xs text-slate-400">by {req.requesterName || req.requesterEmail}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          req.status === "approved" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
