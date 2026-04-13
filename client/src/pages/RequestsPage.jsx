import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { useUser } from "@/hooks/use-auth";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Copy, RefreshCw, Users, Shield, Check, LayoutDashboard, Building2, AlertCircle, Clock, FileEdit, Trash2, ArrowLeft, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useState, useMemo } from "react";

export function RequestsContent() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";
  const [selectedDept, setSelectedDept] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      toast({ title: "Change request approved!" });
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
      toast({ title: "Change request rejected" });
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: [api.departments.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.departments.list.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return await res.json();
    },
  });

  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departments;
    const q = searchQuery.toLowerCase();
    return departments.filter(d => 
      d.name.toLowerCase().includes(q) || 
      (d.code && d.code.toLowerCase().includes(q))
    );
  }, [departments, searchQuery]);

  // Filter requests by selected department or show all
  const filteredPending = selectedDept
    ? requests.filter((r) => r.status === "pending" && r.departmentId === selectedDept.id)
    : requests.filter((r) => r.status === "pending");

  const pending = filteredPending;
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Change Requests</h1>
        <p className="text-slate-500 mt-1">
          {isOwner ? "Review and manage change requests from viewers" : "Track your submitted change requests"}
        </p>
      </div>

      {/* Workspace Info Card */}
      <Card className="border-0 shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-500" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-medium text-slate-900 flex items-center justify-between">
            <span>{user?.workspace?.workspaceName || "My Workspace"}</span>
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">{isOwner ? "Admin" : "Viewer"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Available Departments */}
      <Card className="border-0 shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Available Departments
          </CardTitle>
          <CardDescription>
            {selectedDept
              ? `Showing requests for ${selectedDept.name}`
              : "Click a department to filter requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search departments..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-slate-200 bg-slate-50 focus-visible:ring-primary/20"
            />
          </div>
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50 text-slate-300" />
              <p>No departments found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredDepartments.map((dept) => {
                const deptRequestCount = requests.filter(
                  (r) => r.status === "pending" && r.departmentId === dept.id
                ).length;
                const isSelected = selectedDept?.id === dept.id;

                return (
                  <div
                    key={dept.id}
                    onClick={() => setSelectedDept(isSelected ? null : dept)}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className={`w-4 h-4 ${isSelected ? "text-blue-500" : "text-slate-400"}`} />
                      <div>
                        <p className={`font-medium ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                          {dept.name}
                        </p>
                        <p className="text-xs text-slate-500">Code: {dept.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {deptRequestCount > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          {deptRequestCount} request{deptRequestCount > 1 ? "s" : ""}
                        </span>
                      )}
                      <span className={`text-xs ${isSelected ? "text-blue-500" : "text-slate-400"}`}>
                        {isSelected ? "Showing →" : "Filter →"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {selectedDept && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 gap-2 text-slate-500"
              onClick={() => setSelectedDept(null)}
            >
              <ArrowLeft className="w-4 h-4" />
              Show all departments
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pending Requests */}
      <Card className="border-0 shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            {selectedDept ? `Pending Requests - ${selectedDept.name}` : "All Pending Requests"}
            {pending.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{pending.length}</span>
            )}
          </CardTitle>
          <CardDescription>
            {selectedDept
              ? `Showing pending requests for ${selectedDept.name}`
              : "All pending change requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50 text-slate-300" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((req) => {
                const data = req.data || {};
                return (
                  <div key={req.id} className="flex items-center justify-between p-4 bg-white border border-amber-100 shadow-sm rounded-lg">
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
                          <p className="text-xs text-slate-400 mt-1 font-mono bg-slate-50 p-1 rounded inline-block">
                            {JSON.stringify(data.changes).slice(0, 100)}...
                          </p>
                        )}
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50 shadow-sm"
                          onClick={() => approveMutation.mutate(req.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 shadow-sm"
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
        <Card className="border-0 shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-600">History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {processed.map((req) => {
                const data = req.data || {};
                return (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      {req.type === "edit" ? (
                        <FileEdit className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {req.type} → {data.table} #{data.id}
                        </p>
                        <p className="text-xs text-slate-500">by {req.requesterName || req.requesterEmail}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm border ${
                      req.status === "approved" 
                        ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-red-50 text-red-700 border-red-200"
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
  );
}
