import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { ReferralContent } from "./ReferralPage";
import { RequestsContent } from "./RequestsPage";
import { User, Building2, Link2, ClipboardList, Trash2, LogOut, AlertTriangle, Pencil, Phone, Calendar, Mail, Settings2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Settings() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    avatar: user?.avatar || ""
  });

  // Sync state when user data is loaded
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        avatar: user.avatar || ""
      });
    }
  }, [user]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        toast({ title: "Image too large", description: "Please upload an image smaller than 500KB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({ ...profileData, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false);
  const [workspaceData, setWorkspaceData] = useState({
    name: user?.workspace?.workspaceName || "",
    academicYear: user?.workspace?.academicYear || "2024-2025"
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.auth.updateProfile.path), {
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
      const res = await fetch(apiUrl(api.changeRequests.list.path), { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
    enabled: isOwner,
    refetchInterval: 5000,
  });
  
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const updateWsMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.workspaces.current.path), {
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
      const res = await fetch(apiUrl(api.workspaces.delete.path), { method: "DELETE", credentials: "include" });
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
      const res = await fetch(apiUrl(api.workspaces.leave.path), { method: "POST", credentials: "include" });
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
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8 mt-12 lg:mt-0">
          
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Settings2 className="w-10 h-10 text-indigo-600" />
              Settings
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Manage your personal account and workspace configuration.</p>
          </motion.div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="flex w-full md:w-fit bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 gap-1 overflow-x-auto no-scrollbar">
              <TabsTrigger value="profile" className="flex-1 md:flex-none items-center gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all font-semibold">
                <User className="w-4 h-4" /> <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="workspace" className="flex-1 md:flex-none items-center gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all font-semibold">
                <Building2 className="w-4 h-4" /> <span>Workspace</span>
              </TabsTrigger>
              <TabsTrigger value="referral" className="flex-1 md:flex-none items-center gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all font-semibold">
                <Link2 className="w-4 h-4" /> <span>Referral</span>
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex-1 md:flex-none items-center gap-2 px-6 py-2.5 rounded-xl data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all font-semibold">
                <ClipboardList className="w-4 h-4" /> 
                <span>Requests</span>
                {isOwner && pendingCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            
            <AnimatePresence mode="wait">
                <TabsContent value="profile" className="mt-8">
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    <Card className="border-0 shadow-sm border border-slate-100 rounded-3xl overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/30 p-8">
                        <div>
                            <CardTitle className="text-2xl font-bold">Account Information</CardTitle>
                            <CardDescription className="text-slate-500 mt-1">Update your personal identification and details.</CardDescription>
                        </div>
                        <Button 
                            variant={isEditingProfile ? "outline" : "default"} 
                            size="sm" 
                            onClick={() => setIsEditingProfile(!isEditingProfile)}
                            className={`gap-2 h-10 px-6 rounded-xl transition-all ${!isEditingProfile ? 'premium-gradient shadow-lg shadow-indigo-500/20' : ''}`}
                        >
                            {isEditingProfile ? "Cancel" : <><Pencil className="w-4 h-4" /> Edit Details</>}
                        </Button>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                        {isEditingProfile ? (
                            <form className="space-y-6 max-w-lg">
                            <div className="flex flex-col items-center gap-4 mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center">
                                        {profileData.avatar ? (
                                            <img src={profileData.avatar} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-10 h-10 text-slate-300" />
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                        <Pencil className="w-5 h-5" />
                                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                                    </label>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profile Photo</p>
                            </div>
                            <div className="grid gap-2.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        className="h-12 pl-10 rounded-xl bg-white border-slate-200 focus:border-indigo-500 transition-all font-medium"
                                        value={profileData.name}
                                        onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                                        placeholder="Enter your name"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        className="h-12 pl-10 rounded-xl bg-white border-slate-200 focus:border-indigo-500 transition-all font-medium"
                                        value={profileData.email}
                                        onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                                        placeholder="Enter your email"
                                        type="email"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        className="h-12 pl-10 rounded-xl bg-white border-slate-200 focus:border-indigo-500 transition-all font-medium"
                                        value={profileData.phoneNumber}
                                        onChange={(e) => setProfileData({...profileData, phoneNumber: e.target.value})}
                                        placeholder="Enter your phone number"
                                        type="tel"
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={() => updateProfileMutation.mutate(profileData)}
                                disabled={updateProfileMutation.isPending}
                                className="w-full h-12 premium-gradient shadow-xl shadow-indigo-500/20 rounded-xl text-base font-bold transition-all hover:scale-[1.02]"
                            >
                                {updateProfileMutation.isPending ? "Updating..." : "Update Account"}
                            </Button>
                            </form>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Identity</label>
                                    <p className="text-lg font-bold text-slate-900">{user?.name || "Unspecified User"}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Communication</label>
                                    <p className="text-lg font-bold text-slate-900 underline decoration-indigo-200 decoration-4 underline-offset-4">{user?.email}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Number</label>
                                    <p className="text-lg font-bold text-slate-900">{user?.phoneNumber || <span className="text-slate-300 italic">Not integrated</span>}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Member Since</label>
                                    <p className="text-lg font-bold text-slate-900">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                        )}
                        </CardContent>
                    </Card>
                    </motion.div>
                </TabsContent>

                <TabsContent value="workspace" className="mt-8">
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    <Card className="border-0 shadow-sm border border-slate-100 rounded-3xl overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/30 p-8">
                        <div>
                            <CardTitle className="text-2xl font-bold">Workspace Configuration</CardTitle>
                            <CardDescription className="text-slate-500 mt-1">Manage institutional settings and academic boundaries.</CardDescription>
                        </div>
                        {isOwner && (
                            <Button 
                                variant={isEditingWorkspace ? "outline" : "default"} 
                                size="sm" 
                                onClick={() => setIsEditingWorkspace(!isEditingWorkspace)}
                                className={`gap-2 h-10 px-6 rounded-xl transition-all ${!isEditingWorkspace ? 'premium-gradient shadow-lg shadow-indigo-500/20' : ''}`}
                            >
                                {isEditingWorkspace ? "Cancel" : <><Pencil className="w-4 h-4" /> Customize</>}
                            </Button>
                        )}
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                        {isEditingWorkspace ? (
                            <form className="space-y-6 max-w-lg">
                            <div className="grid gap-2.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Institute/Workspace Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        className="h-12 pl-10 rounded-xl bg-white border-slate-200 focus:border-indigo-500 transition-all font-medium"
                                        value={workspaceData.name}
                                        onChange={(e) => setWorkspaceData({...workspaceData, name: e.target.value})}
                                        placeholder="Enter workspace name"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2.5">
                                <label className="text-sm font-bold text-slate-700 ml-1">Academic Cycle</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input 
                                        className="h-12 pl-10 rounded-xl bg-white border-slate-200 focus:border-indigo-500 transition-all font-medium"
                                        value={workspaceData.academicYear}
                                        onChange={(e) => setWorkspaceData({...workspaceData, academicYear: e.target.value})}
                                        placeholder="e.g. 2024-2025"
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={() => updateWsMutation.mutate(workspaceData)}
                                disabled={updateWsMutation.isPending}
                                className="w-full h-12 premium-gradient shadow-xl shadow-indigo-500/20 rounded-xl text-base font-bold"
                            >
                                {updateWsMutation.isPending ? "Synchronizing..." : "Apply Changes"}
                            </Button>
                            </form>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Institution Name</label>
                                    <div className="flex items-center gap-3">
                                        <p className="text-xl font-bold text-slate-900">{user?.workspace?.workspaceName}</p>
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${isOwner ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {isOwner ? "Owner" : "Collaborator"}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Academic Horizon</label>
                                    <p className="text-xl font-bold text-slate-900">{user?.workspace?.academicYear || "Unscheduled"}</p>
                                </div>
                            </div>
                        )}

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.98 }} 
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-card-border bg-rose-50/50 p-8 rounded-[2.5rem] border border-rose-100 mt-6 relative overflow-hidden"
                        >
                            <div className="absolute right-[-2rem] top-[-2rem] text-rose-100/30 rotate-12">
                                <ShieldAlert className="w-32 h-32" />
                            </div>
                            
                            <div className="relative z-10">
                                <h3 className="text-rose-900 text-2xl font-black flex items-center gap-3 mb-4">
                                    <AlertTriangle className="w-7 h-7" />
                                    Critical Zone
                                </h3>
                                <p className="text-rose-700/80 font-medium text-lg leading-relaxed mb-8 max-w-xl">
                                    {isOwner 
                                        ? "Obliterate this workspace permanently. This will wipe all data across every module including timetables, faculty records, and classroom configurations."
                                        : "Resign from this workspace. Access to shared resources will be terminated immediately. A new invitation from the owner will be required for restoration."}
                                </p>
                                <Button 
                                    variant="destructive" 
                                    className={`h-14 px-8 rounded-2xl text-base font-bold shadow-xl transition-all hover:scale-[1.05] flex items-center gap-3 ${isOwner ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-400/20'}`}
                                    disabled={deleteWsMutation.isPending || leaveWsMutation.isPending}
                                    onClick={handleAction}
                                >
                                    {isOwner ? <Trash2 className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                                    {deleteWsMutation.isPending || leaveWsMutation.isPending 
                                        ? "Execution in progress..." 
                                        : isOwner ? "Terminate Workspace" : "Resign Access"}
                                </Button>
                            </div>
                        </motion.div>
                        </CardContent>
                    </Card>
                    </motion.div>
                </TabsContent>

                <TabsContent value="referral" className="mt-8">
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                    <Card className="border-0 shadow-sm border border-slate-100 rounded-3xl overflow-hidden">
                        <CardContent className="p-0">
                        <ReferralContent className="p-8" />
                        </CardContent>
                    </Card>
                    </motion.div>
                </TabsContent>

                <TabsContent value="requests" className="mt-8">
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                    <Card className="border-0 shadow-sm border border-slate-100 rounded-3xl overflow-hidden">
                        <CardContent className="p-0">
                        <RequestsContent className="p-8" />
                        </CardContent>
                    </Card>
                    </motion.div>
                </TabsContent>
            </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
