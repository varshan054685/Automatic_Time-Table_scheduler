import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ContentCard } from "@/components/layout/ContentCard";
import { StatsRow } from "@/components/layout/StatsRow";
import { CircularProgress } from "./CircularProgress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import {
  useDepartments,
  useFaculty,
  useSubjects,
  useSections,
  useClassrooms,
  useTimeSlots,
} from "@/hooks/use-master-data";
import { useTimetable } from "@/hooks/use-timetable";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Pencil,
  Trash2,
  CalendarDays,
  GraduationCap,
  BookOpen,
  LayoutGrid,
  School,
  Clock,
  Check,
  X,
  Zap,
  ClipboardList,
  Activity,
  Loader2,
} from "lucide-react";
import {
  calcProfileCompletion,
  calcTimetableHealth,
  getRoleLabel,
  getPermissions,
  buildActivityFeed,
} from "./helpers";

export function ProfileSection({ onNavigate }) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isOwner = user?.workspace?.role === "owner";

  const { data: departments } = useDepartments();
  const { data: faculty } = useFaculty();
  const { data: subjects } = useSubjects();
  const { data: sections } = useSections();
  const { data: classrooms } = useClassrooms();
  const { data: timeSlots } = useTimeSlots();
  const { data: timetable = [] } = useTimetable({});

  const { data: requests = [] } = useQuery({
    queryKey: [api.changeRequests.list.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.changeRequests.list.path), { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
    refetchInterval: 5000,
  });

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    avatar: "",
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        avatar: user.avatar || "",
      });
    }
  }, [user]);

  const savedSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: user?.name || "",
        email: user?.email || "",
        phoneNumber: user?.phoneNumber || "",
        avatar: user?.avatar || "",
      }),
    [user]
  );

  const hasChanges = JSON.stringify(profileData) !== savedSnapshot;

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.auth.updateProfile.path), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      toast({ title: "Image too large", description: "Please upload an image smaller than 500KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileData((prev) => ({ ...prev, avatar: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        avatar: user.avatar || "",
      });
    }
  };

  const handleSave = () => {
    updateProfileMutation.mutate(profileData);
  };

  const completionPct = calcProfileCompletion(user);
  const roleLabel = getRoleLabel(isOwner);
  const permissions = getPermissions(isOwner);
  const { score: healthScore, sectionsScheduled } = calcTimetableHealth({
    faculty,
    subjects,
    sections,
    timeSlots,
    timetable,
  });

  const activityFeed = buildActivityFeed(requests, timetable.length);

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const avatarColors = [
    "from-teal-500 to-cyan-600",
    "from-emerald-500 to-teal-600",
    "from-cyan-500 to-blue-600",
    "from-amber-500 to-orange-500",
  ];
  const colorIndex = (user?.name?.charCodeAt(0) || 0) % avatarColors.length;

  const departmentDisplay = departments?.length
    ? `${departments.length} department${departments.length === 1 ? "" : "s"} in workspace`
    : user?.workspace?.workspaceName || "Not assigned";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-20"
    >
      {/* Profile Overview */}
      <ContentCard className="overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative group shrink-0">
              <div
                className={`w-20 h-20 rounded-2xl border-2 border-white shadow-md overflow-hidden flex items-center justify-center bg-gradient-to-br ${avatarColors[colorIndex]}`}
              >
                {profileData.avatar ? (
                  <img src={profileData.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-white">{initials}</span>
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Pencil className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-display font-black text-slate-900 truncate">
                  {user?.name || "Unnamed User"}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    isOwner ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
              {user?.createdAt && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" />
                  Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center sm:items-end gap-1 shrink-0">
              <CircularProgress value={completionPct} size={76} />
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Profile Completion</p>
            </div>
          </div>
        </div>
      </ContentCard>

      {/* Account Details — inline editing */}
      <ContentCard title="Account Details" description="Update your personal information. Changes are saved when you click Save.">
        <div className="space-y-4 max-w-xl">
          <div className="grid gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="h-11 pl-10 rounded-xl border-slate-200 focus:border-teal-400 font-medium"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="h-11 pl-10 rounded-xl border-slate-200 focus:border-teal-400 font-medium"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="h-11 pl-10 rounded-xl border-slate-200 focus:border-teal-400 font-medium"
                type="tel"
                value={profileData.phoneNumber}
                onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Department</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-600 font-medium cursor-default"
                value={departmentDisplay}
                readOnly
                tabIndex={-1}
              />
            </div>
            <p className="text-[11px] text-slate-400">Derived from your workspace configuration.</p>
          </div>
          <div className="grid gap-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Designation</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="h-11 pl-10 rounded-xl border-slate-200 bg-slate-50 text-slate-600 font-medium cursor-default"
                value={roleLabel}
                readOnly
                tabIndex={-1}
              />
            </div>
            <p className="text-[11px] text-slate-400">Based on your workspace role.</p>
          </div>
          {profileData.avatar && (
            <button
              type="button"
              onClick={() => setProfileData({ ...profileData, avatar: "" })}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove profile photo
            </button>
          )}
        </div>
      </ContentCard>

      {/* Account Statistics */}
      <div>
        <h3 className="text-[13px] font-display font-black text-slate-900 mb-3">Account Statistics</h3>
        <StatsRow
          items={[
            { label: "Timetables Generated", value: timetable.length, icon: CalendarDays, colorClass: "text-teal-600" },
            { label: "Departments Managed", value: departments?.length || 0, icon: Building2, colorClass: "text-cyan-600" },
            { label: "Faculty Records", value: faculty?.length || 0, icon: GraduationCap, colorClass: "text-emerald-600" },
            { label: "Subjects Managed", value: subjects?.length || 0, icon: BookOpen, colorClass: "text-orange-600" },
          ]}
        />
      </div>

      {/* Scheduling Impact */}
      <ContentCard title="Scheduling Impact" description="Your workspace scheduling footprint and health.">
        <StatsRow
          items={[
            { label: "Faculty Assigned", value: faculty?.length || 0, icon: GraduationCap, colorClass: "text-teal-600" },
            { label: "Classrooms Managed", value: classrooms?.length || 0, icon: School, colorClass: "text-cyan-600" },
            { label: "Sections Scheduled", value: sectionsScheduled, icon: LayoutGrid, colorClass: "text-emerald-600" },
            { label: "Health Score", value: `${healthScore}/100`, icon: Activity, colorClass: "text-amber-600" },
          ]}
        />
      </ContentCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Permissions */}
        <ContentCard title="Permissions" description="Capabilities granted to your account.">
          <div className="space-y-2">
            {permissions.map(({ label, allowed }) => (
              <div
                key={label}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  allowed ? "bg-teal-50/50 border-teal-100" : "bg-slate-50 border-slate-100"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    allowed ? "bg-teal-100 text-teal-600" : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {allowed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-sm font-semibold ${allowed ? "text-slate-800" : "text-slate-400"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </ContentCard>

        {/* Quick Actions */}
        <ContentCard title="Quick Actions" description="Common account and workspace tasks.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Pencil, label: "Edit Profile", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
              { icon: Building2, label: "View Workspace", action: () => onNavigate("workspace") },
              { icon: Zap, label: "Generate Timetable", action: () => navigate("/timetable") },
              { icon: ClipboardList, label: "Manage Requests", action: () => onNavigate("requests") },
            ].map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className="flex flex-col items-start gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-teal-100 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="w-4 h-4 text-teal-600" />
                </div>
                <span className="text-[12px] font-bold text-slate-800 group-hover:text-teal-700">{label}</span>
              </button>
            ))}
          </div>
        </ContentCard>
      </div>

      {/* Recent Activity */}
      <ContentCard title="Recent Activity" description="Latest actions across your workspace.">
        {activityFeed.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">No recent activity</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Activity from timetables, requests, and workspace changes will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {activityFeed.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{item.action}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {item.detail} · <span className="text-teal-600">{item.actor}</span>
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 font-medium shrink-0">
                  {new Date(item.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Sticky save bar */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-700">
            <span className="text-sm font-semibold">Unsaved changes</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl"
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
