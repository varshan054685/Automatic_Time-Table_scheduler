import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { ReferralContent } from "./ReferralPage";
import { RequestsContent } from "./RequestsPage";
import { User, Building2, Link2, ClipboardList, Trash2, LogOut, AlertTriangle, Pencil, Phone, Calendar } from "lucide-react";

export default function Settings() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || ""
  });
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [workspaceData, setWorkspaceData] = useState({
    name: user?.workspace?.workspaceName || "",
    academicYear: user?.workspace?.academicYear || "2024-2025"
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(api.auth.updateProfile.path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Profile updated successfully" });
      setIsEditingProfile(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  });

  const { data: requests = [] } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(api.changeRequests.list.path, { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
    enabled: isOwner,
    refetchInterval: 5000,
  });
  
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const updateWsMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(api.workspaces.current.path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update workspace");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Workspace updated successfully" });
      setIsEditingWorkspace(false);
    },
    onError: () => {
      toast({ title: "Failed to update workspace", variant: "destructive" });
    }
  });

  const deleteWsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.workspaces.delete.path, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete workspace");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Workspace deleted successfully." });
    }
  });

  const leaveWsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.workspaces.leave.path, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to leave workspace");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "You have left the workspace." });
    }
  });

  const handleAction = () => {
    if (isOwner) {
      if (confirm("WARNING: This will permanently delete the workspace and ALL associated data (Timetables, Departments, Faculty, etc). This action cannot be undone. Are you sure?")) {
        deleteWsMutation.mutate();
      }
    } else {
      if (confirm("Are you sure you want to leave this workspace?")) {
        leaveWsMutation.mutate();
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <main className="flex-1  p-4 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6 mt-12 lg:mt-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
            <p className="text-slate-500 mt-1">Manage your account and workspace preferences.</p>
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100/50 p-1">
              <TabsTrigger value="profile" className="flex items-center gap-2"><User className="w-4 h-4" /> <span className="hidden sm:inline">Profile</span></TabsTrigger>
              <TabsTrigger value="workspace" className="flex items-center gap-2"><Building2 className="w-4 h-4" /> <span className="hidden sm:inline">Workspace</span></TabsTrigger>
              <TabsTrigger value="referral" className="flex items-center gap-2"><Link2 className="w-4 h-4" /> <span className="hidden sm:inline">Referral</span></TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> 
                <span className="hidden sm:inline">Requests</span>
                {isOwner && pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm ml-1">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="mt-6">
              <Card className="border-0 shadow-sm border border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Profile Details</CardTitle>
                    <CardDescription>Your personal account information.</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    {isEditingProfile ? "Cancel" : "Edit"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditingProfile ? (
                    <>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500">Full Name</label>
                        <Input 
                          value={profileData.name}
                          onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                          placeholder="Enter your name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500">Email Address</label>
                        <Input 
                          value={profileData.email}
                          onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                          placeholder="Enter your email"
                          type="email"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone Number
                        </label>
                        <Input 
                          value={profileData.phone}
                          onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                          placeholder="Enter your phone number"
                          type="tel"
                        />
                      </div>
                      <Button 
                        onClick={() => updateProfileMutation.mutate(profileData)}
                        disabled={updateProfileMutation.isPending}
                        className="w-full"
                      >
                        {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500">Full Name</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-medium text-slate-900">{user?.name || "N/A"}</div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500">Email Address</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-medium text-slate-900">{user?.email}</div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone Number
                        </label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-medium text-slate-900">{user?.phone || "Not set"}</div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workspace" className="mt-6">
              <Card className="border-0 shadow-sm border border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Workspace</CardTitle>
                    <CardDescription>View and manage your current workspace.</CardDescription>
                  </div>
                  {isOwner && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsEditingWorkspace(!isEditingWorkspace)}
                      className="gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      {isEditingWorkspace ? "Cancel" : "Edit"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {isEditingWorkspace ? (
                    <>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500">Workspace Name</label>
                        <Input 
                          value={workspaceData.name}
                          onChange={(e) => setWorkspaceData({...workspaceData, name: e.target.value})}
                          placeholder="Enter workspace name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Academic Year
                        </label>
                        <Input 
                          value={workspaceData.academicYear}
                          onChange={(e) => setWorkspaceData({...workspaceData, academicYear: e.target.value})}
                          placeholder="e.g. 2024-2025"
                        />
                      </div>
                      <Button 
                        onClick={() => updateWsMutation.mutate(workspaceData)}
                        disabled={updateWsMutation.isPending}
                        className="w-full"
                      >
                        {updateWsMutation.isPending ? "Saving..." : "Save Workspace"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500">Workspace Name</label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-medium text-slate-900 flex items-center justify-between">
                          {user?.workspace?.workspaceName}
                          <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">{isOwner ? "Admin" : "Viewer"}</span>
                        </div>
                      </div>
                      
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Academic Year
                        </label>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-medium text-slate-900">
                          {user?.workspace?.academicYear || "Not specified"}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="border border-red-200 bg-red-50/50 rounded-xl p-5 border-dashed mt-4">
                    <h3 className="text-red-800 font-semibold flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5" />
                      Danger Zone
                    </h3>
                    <p className="text-red-600/80 text-sm mb-4">
                      {isOwner 
                        ? "Permanently delete this workspace and all associated timetables, classrooms, and faculty. This action cannot be undone."
                        : "Leave this workspace. You will need a new referral code from the owner to rejoin."}
                    </p>
                    <Button 
                      variant="destructive" 
                      className={`gap-2 ${isOwner ? 'bg-red-600' : 'bg-red-500'}`}
                      disabled={deleteWsMutation.isPending || leaveWsMutation.isPending}
                      onClick={handleAction}
                    >
                      {isOwner ? <Trash2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                      {deleteWsMutation.isPending || leaveWsMutation.isPending 
                        ? "Processing..." 
                        : isOwner ? "Delete Workspace" : "Leave Workspace"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="referral" className="mt-6">
              <Card className="border-0 shadow-sm border border-slate-200">
                <CardContent className="p-6">
                  <ReferralContent />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requests" className="mt-6">
              <Card className="border-0 shadow-sm border border-slate-200">
                <CardContent className="p-6">
                  <RequestsContent />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
