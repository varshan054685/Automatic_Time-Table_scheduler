import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Download,
  RotateCw,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  HardDriveDownload,
  Loader2,
} from "lucide-react";
import { updaterApi } from "@/lib/desktop-api";

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

export function UpdateBanner() {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await updaterApi.status();
      if (res) {
        setStatus(res);
      }
    } catch {
      // Offline or dev mode — ignore
    }
  };

  useEffect(() => {
    fetchStatus();

    // Subscribe to real-time push events from Electron
    const unsubscribe = updaterApi.onEvent((newStatus) => {
      setStatus(newStatus);
      // If a downloaded update arrives, un-dismiss to let user know
      if (newStatus?.state === "downloaded") {
        setDismissed(false);
      }
    });

    // 60-second background polling
    const interval = setInterval(fetchStatus, 60_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!status || dismissed) return null;

  const { state, latestVersion, releaseName, progress, message, updateSupported } = status;

  // Only show banner for active states that need user attention
  const shouldShow =
    updateSupported &&
    (state === "available" ||
      state === "downloading" ||
      state === "downloaded" ||
      state === "postponed" ||
      (state === "error" && !status.silent));

  if (!shouldShow) return null;

  const handleDownload = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await updaterApi.download();
      setStatus(res);
    } catch (err) {
      setErrorMsg(err?.message || "Failed to start download");
    } finally {
      setActionLoading(false);
    }
  };

  const handleInstall = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await updaterApi.install();
      if (res && !res.ok) {
        setErrorMsg(res.message || "Update installation was postponed to protect your data.");
        if (res.status) setStatus(res.status);
      }
    } catch (err) {
      setErrorMsg(err?.message || "Failed to install update");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/80 p-4 text-slate-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status Icon */}
            {state === "available" && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
            )}

            {state === "downloading" && (
              <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <HardDriveDownload className="w-5 h-5" />
              </div>
            )}

            {state === "downloaded" && (
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}

            {(state === "postponed" || state === "error") && (
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Header Title */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {state === "available" && "New Update"}
                  {state === "downloading" && "Downloading"}
                  {state === "downloaded" && "Ready to Apply"}
                  {state === "postponed" && "Update Postponed"}
                  {state === "error" && "Update Issue"}
                </span>
                {latestVersion && (
                  <span className="bg-teal-50 text-teal-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-teal-200/60">
                    v{latestVersion}
                  </span>
                )}
              </div>

              {/* Title & Description */}
              <h4 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                {state === "available" && (releaseName || `Version ${latestVersion} is available`)}
                {state === "downloading" && "Downloading update package..."}
                {state === "downloaded" && "Update downloaded & verified"}
                {state === "postponed" && "Installation safety hold"}
                {state === "error" && "Unable to complete update"}
              </h4>

              {/* State-specific Body & Actions */}
              {state === "available" && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  A new version is ready for installation. Download now to get the latest features and improvements.
                </p>
              )}

              {state === "downloading" && (
                <div className="mt-2 space-y-1.5">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress?.percent || 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>{progress?.percent || 0}%</span>
                    <span>
                      {formatBytes(progress?.transferred)} / {formatBytes(progress?.total)}
                      {progress?.bytesPerSecond > 0 && ` (${formatBytes(progress.bytesPerSecond)}/s)`}
                    </span>
                  </div>
                </div>
              )}

              {state === "downloaded" && (
                <div className="mt-1">
                  <p className="text-xs text-slate-600">
                    Restart the application to install. Your local SQLite database will be automatically backed up first.
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Data safety verification guaranteed</span>
                  </div>
                </div>
              )}

              {(state === "postponed" || state === "error" || errorMsg) && (
                <p className="text-xs text-rose-600 mt-1 font-medium">
                  {errorMsg || message || "Update could not proceed safely at this time."}
                </p>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          {state === "available" && (
            <button
              onClick={handleDownload}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download Update</span>
            </button>
          )}

          {state === "downloaded" && (
            <button
              onClick={handleInstall}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              <span>Restart & Update</span>
            </button>
          )}

          {(state === "postponed" || state === "error") && (
            <button
              onClick={handleInstall}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              <span>Retry Installation</span>
            </button>
          )}

          <a
            href="#/settings?tab=updates"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <span>Details</span>
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
