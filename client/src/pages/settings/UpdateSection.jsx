import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { updaterApi } from "@/lib/desktop-api";
import {
  Sparkles,
  RefreshCw,
  Download,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  HardDriveDownload,
  Info,
  Calendar,
  Tag,
  Radio,
  Clock,
  FileText,
  Loader2,
  Database,
  Lock,
} from "lucide-react";

function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let unitIdx = 0;
  while (val >= 1024 && unitIdx < units.length - 1) {
    val /= 1024;
    unitIdx++;
  }
  return `${unitIdx === 0 ? Math.round(val) : val.toFixed(1)} ${units[unitIdx]}`;
}

export function UpdateSection() {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await updaterApi.status();
      if (res) {
        setStatus(res);
      }
    } catch (err) {
      console.error("Error fetching updater status:", err);
    }
  };

  useEffect(() => {
    fetchStatus();

    const unsubscribe = updaterApi.onEvent((newStatus) => {
      setStatus(newStatus);
      if (newStatus?.state === "checking") setChecking(true);
      else setChecking(false);

      if (newStatus?.state === "downloading") setDownloading(true);
      else setDownloading(false);

      if (newStatus?.state === "installing") setInstalling(true);
      else setInstalling(false);
    });

    const interval = setInterval(fetchStatus, 30_000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await updaterApi.check();
      setStatus(res);
      setLastCheckedTime(new Date());
      if (res.state === "up-to-date") {
        toast({
          title: "Application Up to Date",
          description: `You are running the latest version (v${res.currentVersion}).`,
        });
      } else if (res.state === "available") {
        toast({
          title: "Update Found",
          description: `Version v${res.latestVersion} is available for download.`,
        });
      } else if (res.state === "error") {
        toast({
          variant: "destructive",
          title: "Update Check Failed",
          description: res.message || "Could not connect to update servers.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Check Failed",
        description: err?.message || "Failed to check for updates.",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await updaterApi.download();
      setStatus(res);
      toast({
        title: "Download Started",
        description: `Downloading update v${res.latestVersion}...`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: err?.message || "Could not download the update package.",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const res = await updaterApi.install();
      if (res && !res.ok) {
        toast({
          variant: "destructive",
          title: "Update Postponed",
          description: res.message || "Update installation was safely postponed to protect your data.",
        });
        if (res.status) setStatus(res.status);
      } else {
        toast({
          title: "Restarting Application",
          description: "Database verified & backed up. Restarting to apply update...",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Installation Error",
        description: err?.message || "Could not install the update.",
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleToggleAutoCheck = async (checked) => {
    try {
      const updated = await updaterApi.setAutoOption("autoCheck", checked);
      setStatus(updated);
      toast({
        title: "Preference Updated",
        description: checked
          ? "Automatic background update checks enabled."
          : "Automatic update checks disabled.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update preference",
        description: err?.message,
      });
    }
  };

  const handleToggleAutoDownload = async (checked) => {
    try {
      const updated = await updaterApi.setAutoOption("autoDownload", checked);
      setStatus(updated);
      toast({
        title: "Preference Updated",
        description: checked
          ? "Updates will download automatically when discovered."
          : "Updates will require manual download confirmation.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to update preference",
        description: err?.message,
      });
    }
  };

  const state = status?.state || "idle";
  const currentVersion = status?.currentVersion || "1.0.0";
  const latestVersion = status?.latestVersion;
  const releaseName = status?.releaseName;
  const releaseDate = status?.releaseDate;
  const releaseNotes = status?.releaseNotes;
  const progress = status?.progress;
  const autoCheck = status?.autoCheck ?? true;
  const autoDownload = status?.autoDownload ?? false;
  const updateSupported = status?.updateSupported ?? true;
  const unsupportedReason = status?.unsupportedReason;

  const isBusy = checking || downloading || installing || state === "checking" || state === "downloading" || state === "installing";

  return (
    <div className="space-y-6">
      {/* Overview & Live Status Card */}
      <ContentCard
        title="Application Updates"
        description="Check for new releases, manage background checks, and safely update your system."
      >
        <div className="space-y-6">
          {/* Version and State Badge Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Current Version */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Current Version
                </span>
                <div className="text-xl font-display font-black text-slate-900 mt-0.5">
                  v{currentVersion}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-black">
                <Tag className="w-5 h-5" />
              </div>
            </div>

            {/* Update Status */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Status
                </span>
                <div className="flex items-center gap-2 mt-1">
                  {state === "up-to-date" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Up to date
                    </span>
                  )}
                  {state === "checking" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Checking feed...
                    </span>
                  )}
                  {state === "available" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-100 px-2.5 py-1 rounded-full">
                      <Sparkles className="w-3.5 h-3.5" />
                      Update available
                    </span>
                  )}
                  {state === "downloading" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      Downloading ({progress?.percent || 0}%)
                    </span>
                  )}
                  {state === "downloaded" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready to install
                    </span>
                  )}
                  {state === "postponed" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Postponed (Safety)
                    </span>
                  )}
                  {state === "error" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {status?.code === "OFFLINE" ? "Offline" : "Check failed"}
                    </span>
                  )}
                  {state === "unsupported" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-full">
                      <Info className="w-3.5 h-3.5" />
                      Development Mode
                    </span>
                  )}
                  {state === "idle" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-full">
                      Idle
                    </span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-700 flex items-center justify-center font-black">
                <Radio className="w-5 h-5" />
              </div>
            </div>

            {/* Target / Latest Version */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between sm:col-span-2 lg:col-span-1">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Target Release
                </span>
                <div className="text-xl font-display font-black text-slate-900 mt-0.5">
                  {latestVersion ? `v${latestVersion}` : "—"}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Unsupported notice in Dev mode */}
          {!updateSupported && unsupportedReason && (
            <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-slate-600 text-xs">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700">Notice: </span>
                {unsupportedReason}
              </div>
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={handleCheck}
              disabled={isBusy || !updateSupported}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm px-5"
            >
              {checking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{checking ? "Checking for updates..." : "Check for Updates"}</span>
            </Button>

            {state === "available" && (
              <Button
                onClick={handleDownload}
                disabled={isBusy}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm px-5"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download v{latestVersion}</span>
              </Button>
            )}

            {(state === "downloaded" || state === "postponed") && (
              <Button
                onClick={handleInstall}
                disabled={isBusy}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm px-5"
              >
                {installing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCw className="w-4 h-4" />
                )}
                <span>Restart & Apply Update</span>
              </Button>
            )}

            {lastCheckedTime && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5 ml-auto">
                <Clock className="w-3.5 h-3.5" />
                Last checked: {lastCheckedTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </ContentCard>

      {/* Live Download Progress Panel (if downloading) */}
      {state === "downloading" && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-blue-200 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center animate-bounce">
                <HardDriveDownload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Downloading Update v{latestVersion}
                </h4>
                <p className="text-xs text-slate-500">
                  Fetching installer payload securely from GitHub Releases.
                </p>
              </div>
            </div>
            <span className="text-lg font-black text-blue-600 font-mono">
              {progress?.percent || 0}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress?.percent || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-500 font-mono">
              <span>
                {formatBytes(progress?.transferred)} of {formatBytes(progress?.total)}
              </span>
              <span>
                {progress?.bytesPerSecond > 0 ? `${formatBytes(progress.bytesPerSecond)}/s` : "Calculating..."}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Release Notes Panel (if available) */}
      {(latestVersion || releaseNotes) && (
        <ContentCard
          title={`Release Notes ${latestVersion ? `(v${latestVersion})` : ""}`}
          description={releaseName || "Highlights and changelog for this release"}
        >
          <div className="space-y-4">
            {releaseDate && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Published on: {new Date(releaseDate).toLocaleDateString()}</span>
              </div>
            )}

            {releaseNotes ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                {releaseNotes}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No specific release notes provided for this version.
              </p>
            )}
          </div>
        </ContentCard>
      )}

      {/* Pre-Install Data Protection & Backup Safety Card */}
      <ContentCard
        title="Pre-Install Data Safety Protection"
        description="How the scheduler safeguards your data during update installations."
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-emerald-950">
                Zero Data-Loss Pre-Update Gate
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Before applying any software update, the system automatically flushes the SQLite write-ahead log (WAL), takes a verified full database snapshot, and verifies file integrity. If a timetable solver run is active or backup verification encounters an anomaly, the update is safely postponed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Database className="w-4 h-4 text-teal-600" />
                <span>1. Memory & WAL Flush</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Pending transactions and in-memory caches are completely synchronized to disk.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Lock className="w-4 h-4 text-teal-600" />
                <span>2. Verified Snapshot</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                A pre-update timestamped backup is generated and verified with header integrity checks.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>3. Atomic Restart</span>
              </div>
              <p className="text-slate-500 text-[11px]">
                The application restarts cleanly to replace binaries while preserving your configuration.
              </p>
            </div>
          </div>
        </div>
      </ContentCard>

      {/* Preferences & Automatic Toggles Card */}
      <ContentCard
        title="Update Preferences"
        description="Configure automated background checks and download behavior."
      >
        <div className="divide-y divide-slate-100">
          {/* Auto check toggle */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label
                htmlFor="auto-check-switch"
                className="text-sm font-bold text-slate-900 cursor-pointer"
              >
                Automatic update checks
              </label>
              <p className="text-xs text-slate-500">
                Periodically check for new releases in the background (every 6 hours) without interrupting your work.
              </p>
            </div>
            <Switch
              id="auto-check-switch"
              checked={autoCheck}
              onCheckedChange={handleToggleAutoCheck}
              disabled={!updateSupported}
            />
          </div>

          {/* Auto download toggle */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <label
                htmlFor="auto-download-switch"
                className="text-sm font-bold text-slate-900 cursor-pointer"
              >
                Automatic download
              </label>
              <p className="text-xs text-slate-500">
                Automatically download new release packages when discovered so they are ready for one-click restart.
              </p>
            </div>
            <Switch
              id="auto-download-switch"
              checked={autoDownload}
              onCheckedChange={handleToggleAutoDownload}
              disabled={!updateSupported}
            />
          </div>

          {/* Distribution provider */}
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-900">
                Release Channel
              </span>
              <p className="text-xs text-slate-500">
                GitHub Releases feed (varshan054685/Automatic_Time-Table_scheduler).
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
              Stable
            </span>
          </div>
        </div>
      </ContentCard>
    </div>
  );
}
