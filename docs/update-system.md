# Auto-Update System Design

> Phase 2 deliverable. Covers the update pipeline, safety gates, and failure behavior per spec §14–17.

## 1. Stack

- **electron-updater** with the **GitHub Releases** provider (`owner/repo` configured in electron-builder).
- The updater is fully decoupled from everything else: `UpdateService` is an isolated main-process module; no update failure can affect the database, scheduler, or UI.

## 2. Architecture

```text
React (Settings → Updates; small banner)
   ↓ IPC: window.api.updater.{status,check,download,install} + onUpdateEvent(cb)
Electron main — UpdateService (electron-updater autoUpdater)
   ↓
GitHub Releases (latest.yml + installers)
```

## 3. Update states (spec §14)

`idle → checking → up-to-date | available → downloading (progress %) → downloaded → installing | error`

Rendered in Settings → Updates:

```text
Current version: 1.0.0        Latest: 1.1.0
[Check for Updates]  [Download Update]  [Restart & Update]
```

Plus a small non-blocking banner when a downloaded update is pending install.

## 4. Behavior rules

- Check ~15 s after startup (async, never blocks window paint) and every 6 h afterwards.
- Manual "Check for Updates" button; settings toggles: `updates.autoCheck`, `updates.autoDownload` (default: check on, download off).
- **Never** auto-restart; `install()` is user-initiated only.
- Offline / no DNS / GitHub unreachable → event `up-to-date|error(silent)` → app continues normally; no scary dialogs (spec §17).

## 5. Critical pre-install safety gate (spec §15)

`quitAndInstall()` is intercepted — the app never calls it directly:

1. Flush DB writes (WAL checkpoint, close all statements).
2. `BackupService.create("pre-update")`.
3. Verify backup exists, size > 0, opens (`PRAGMA integrity_check`).
4. Run pre-update validation (schema version known, no pending generation job running).
5. Only then `autoUpdater.quitAndInstall()`.

**If any step fails** → do not install; UI shows:

```text
Update postponed — We could not safely back up your data.
Your application will continue running normally. [OK]
```

A generation job in progress also postpones install until it finishes or is cancelled.

## 6. Update + database migration (spec §16)

```text
App starts (new version)
  → read schema version
  → run pending migrations (backup taken automatically first)
  → verify (integrity_check + expected tables present)
  → open app
```

On migration failure: keep DB read-only, offer **Restore from automatic pre-migration backup**, never reset/delete. Diagnostics written to `db.log` for support.

## 7. Testing checklist (§26)
- Packaged app v1.0.0 → publish v1.0.1 draft → verify detection, download progress, install, relaunch.
- Backup-present + backup-successful assertions before install (simulate backup failure by read-only userData dir).
- Offline: update check fails silently; every core feature works.
- Migration v1→v2 against a populated v1 fixture DB; verify data intact, backup created, rollback path works.
