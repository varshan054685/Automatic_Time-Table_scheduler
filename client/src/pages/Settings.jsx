import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/AppShell";
import { SettingsNav, SETTINGS_SECTIONS } from "./settings/SettingsNav";
import { ProfileSection } from "./settings/ProfileSection";
import { WorkspaceSection } from "./settings/WorkspaceSection";
import { DangerZoneSection } from "./settings/DangerZoneSection";
import { useUser } from "@/hooks/use-auth";
import { AnimatePresence } from "framer-motion";

const VALID_SECTIONS = SETTINGS_SECTIONS.map((s) => s.id);

function getSectionFromUrl() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab && VALID_SECTIONS.includes(tab) ? tab : "profile";
}

export default function Settings() {
  const [, navigate] = useLocation();
  const [section, setSection] = useState(getSectionFromUrl);

  // Referrals & change requests were multi-user cloud features — removed.
  const pendingCount = 0;

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
      case "danger":
        return <DangerZoneSection key="danger" />;
      default:
        return <ProfileSection key="profile" onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppShell
      pageTitle="Settings"      pageSubtitle="Manage your profile, institution and data.">
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
