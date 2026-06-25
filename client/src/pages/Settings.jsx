import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { SettingsNav, SETTINGS_SECTIONS } from "./settings/SettingsNav";
import { ProfileSection } from "./settings/ProfileSection";
import { WorkspaceSection } from "./settings/WorkspaceSection";
import { ReferralsSection } from "./settings/ReferralsSection";
import { RequestsSection } from "./settings/RequestsSection";
import { DangerZoneSection } from "./settings/DangerZoneSection";
import { useUser } from "@/hooks/use-auth";
import { api } from "@shared/routes";
import { apiUrl } from "@/lib/api-base";
import { AnimatePresence } from "framer-motion";

const VALID_SECTIONS = SETTINGS_SECTIONS.map((s) => s.id);

function getSectionFromUrl() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab && VALID_SECTIONS.includes(tab) ? tab : "profile";
}

export default function Settings() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const [section, setSection] = useState(getSectionFromUrl);
  const isOwner = user?.workspace?.role === "owner";

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

  useEffect(() => {
    setSection(getSectionFromUrl());
  }, []);

  useEffect(() => {
    const sync = () => setSection(getSectionFromUrl());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const handleNavigate = (id) => {
    setSection(id);
    navigate(`/settings?tab=${id}`);
  };

  const renderSection = () => {
    switch (section) {
      case "profile":
        return <ProfileSection key="profile" onNavigate={handleNavigate} />;
      case "workspace":
        return <WorkspaceSection key="workspace" />;
      case "referrals":
        return <ReferralsSection key="referrals" />;
      case "requests":
        return <RequestsSection key="requests" />;
      case "danger":
        return <DangerZoneSection key="danger" />;
      default:
        return <ProfileSection key="profile" onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppShell
      pageTitle="Settings"
      pageSubtitle="Manage your account, workspace, permissions and platform activity."
    >
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <SettingsNav
          active={section}
          onChange={handleNavigate}
          pendingCount={pendingCount}
        />

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {renderSection()}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
