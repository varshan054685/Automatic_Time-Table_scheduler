import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentCard } from "@/components/layout/ContentCard";
import { StatCard } from "@/components/StatCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { motion } from "framer-motion";
import { Building2, Calendar, Copy, Check, Pencil, Loader2, GraduationCap, BookOpen, LayoutGrid, School } from "lucide-react";
import { calcWorkspaceHealth } from "./helpers";

export function WorkspaceSection() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isOwner = user?.workspace?.role === "owner";

  const { data: departments } = useDepartments();
  const { data: faculty } = useFaculty();
  const { data: subjects } = useSubjects();
  const { data: sections } = useSections();
  const { data: classrooms } = useClassrooms();
  const { data: timeSlots } = useTimeSlots();

  const { data: wsData } = useQuery({
    queryKey: [api.workspaces.current.path],
    queryFn: async () => {
      const res = await fetch(apiUrl(api.workspaces.current.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    },
    enabled: !!user?.workspace,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [workspaceData, setWorkspaceData] = useState({
    name: "",
    academicYear: "2024-2025",
  });
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (user?.workspace) {
      setWorkspaceData({
        name: user.workspace.workspaceName || wsData?.name || "",
        academicYear: user.workspace.academicYear || wsData?.academicYear || "2024-2025",
      });
    }
  }, [user, wsData]);

  const updateWsMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(apiUrl(api.workspaces.current.path), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update workspace");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.workspaces.current.path] });
      toast({ title: "Workspace updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update workspace", variant: "destructive" });
    },
  });

  const workspaceId = wsData?.id ?? user?.workspace?.workspaceId;
  const { score: healthScore, checks: healthChecks } = calcWorkspaceHealth({
    faculty,
    subjects,
    classrooms,
    timeSlots,
  });

  const copyWorkspaceId = () => {
    if (!workspaceId) return;
    navigator.clipboard.writeText(String(workspaceId));
    setCopiedId(true);
    toast({ title: "Copied", description: "Workspace ID copied to clipboard." });
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Institution */}
      <ContentCard
        header={
          <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-display font-black text-slate-900">Institution</h3>
              <p className="text-sm text-slate-500 font-medium mt-0.5">Workspace name and academic year.</p>
            </div>
            {isOwner && (
              <Button
                variant={isEditing ? "outline" : "default"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className={`gap-2 h-9 px-4 rounded-xl text-sm font-bold ${!isEditing ? "premium-gradient shadow-md shadow-teal-500/20" : ""}`}
              >
                {isEditing ? "Cancel" : <><Pencil className="w-4 h-4" /> Edit</>}
              </Button>
            )}
          </div>
        }
      >
        {isEditing ? (
          <form
            className="space-y-4 max-w-lg"
            onSubmit={(e) => {
              e.preventDefault();
              updateWsMutation.mutate(workspaceData);
            }}
          >
            <div className="grid gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Workspace Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="h-11 pl-10 rounded-xl border-slate-200 focus:border-teal-400 font-medium"
                  value={workspaceData.name}
                  onChange={(e) => setWorkspaceData({ ...workspaceData, name: e.target.value })}
                  placeholder="Institution name"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Academic Year</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="h-11 pl-10 rounded-xl border-slate-200 focus:border-teal-400 font-medium"
                  value={workspaceData.academicYear}
                  onChange={(e) => setWorkspaceData({ ...workspaceData, academicYear: e.target.value })}
                  placeholder="e.g. 2024-2025"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={updateWsMutation.isPending}
              className="w-full h-11 premium-gradient rounded-xl font-bold shadow-md shadow-teal-500/20"
            >
              {updateWsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workspace Name</p>
              <p className="text-base font-black text-slate-900 mt-1">
                {user?.workspace?.workspaceName || wsData?.name || "—"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Academic Year</p>
              <p className="text-base font-black text-slate-900 mt-1">
                {user?.workspace?.academicYear || wsData?.academicYear || "Not set"}
              </p>
            </div>
          </div>
        )}
      </ContentCard>

      {/* Membership */}
      <ContentCard title="Membership" description="Your role and workspace identifier.">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Role</p>
            <p className="text-base font-black text-slate-900 mt-1 capitalize">
              {isOwner ? "Owner" : "Member"}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Workspace ID</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono font-bold text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 truncate">
                {workspaceId ?? "—"}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyWorkspaceId}
                disabled={!workspaceId}
                className="shrink-0 h-10 w-10 rounded-xl border-slate-200"
              >
                {copiedId ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              </Button>
            </div>
          </div>
          {(wsData?.createdAt || user?.workspace?.createdAt) && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workspace Created</p>
              <p className="text-base font-black text-slate-900 mt-1">
                {new Date(wsData?.createdAt || user?.workspace?.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      </ContentCard>

      {/* Workspace Analytics */}
      <div>
        <h3 className="text-[13px] font-display font-black text-slate-900 mb-3">Workspace Analytics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Departments", value: departments?.length || 0, icon: Building2, colorClass: "text-teal-600" },
            { label: "Faculty", value: faculty?.length || 0, icon: GraduationCap, colorClass: "text-cyan-600" },
            { label: "Subjects", value: subjects?.length || 0, icon: BookOpen, colorClass: "text-emerald-600" },
            { label: "Sections", value: sections?.length || 0, icon: LayoutGrid, colorClass: "text-orange-600" },
            { label: "Classrooms", value: classrooms?.length || 0, icon: School, colorClass: "text-amber-600" },
          ].map((item) => (
            <StatCard key={item.label} {...item} />
          ))}
        </div>
      </div>

      {/* Workspace Health */}
      <ContentCard title="Workspace Health" description="Configuration completeness across core scheduling resources.">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6">
          <div>
            <p className="text-4xl font-display font-black text-slate-900">{healthScore}<span className="text-xl text-slate-400">/100</span></p>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              {healthScore >= 100 ? "Fully configured" : healthScore >= 75 ? "Nearly ready" : healthScore >= 50 ? "In progress" : "Needs setup"}
            </p>
          </div>
          <div className="flex-1">
            <Progress value={healthScore} className="h-2.5 bg-slate-100 [&>div]:bg-teal-500" />
          </div>
        </div>
        <div className="space-y-4">
          {healthChecks.map(({ label, ok }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-slate-700">{label}</span>
                <span className={`text-xs font-bold ${ok ? "text-teal-600" : "text-slate-400"}`}>
                  {ok ? "Complete" : "Missing"}
                </span>
              </div>
              <Progress value={ok ? 100 : 0} className="h-1.5 bg-slate-100 [&>div]:bg-teal-500" />
            </div>
          ))}
        </div>
      </ContentCard>
    </motion.div>
  );
}
