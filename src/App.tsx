import { useState, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, ExportData } from "./types";
import Profiles from "./pages/Profiles";
import { PageSkeleton } from "./components/Skeleton";
import { useAchievementToasts } from "./hooks/useAchievementToasts";
import UnlockToast from "./components/UnlockToast";

const RunTracker = lazy(() => import("./pages/RunTracker"));
const History = lazy(() => import("./pages/History"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Settings = lazy(() => import("./pages/Settings"));
const Comparison = lazy(() => import("./pages/Comparison"));
const DropCalculator = lazy(() => import("./pages/DropCalculator"));
const RouteEditor = lazy(() => import("./pages/RouteEditor"));
const HeraldTracker = lazy(() => import("./pages/HeraldTracker"));
const ColossalAncients = lazy(() => import("./pages/ColossalAncients"));
const DCloneTracker = lazy(() => import("./pages/DCloneTracker"));
const XPTracker = lazy(() => import("./pages/XPTracker"));
const CoopPanel = lazy(() => import("./pages/CoopPanel"));
const Achievements = lazy(() => import("./pages/Achievements"));
import { exportData, importData } from "./api";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import UpdateChecker from "./components/UpdateChecker";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import { syncEngine } from "./services/cloud-sync";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

type Page = "profiles" | "tracker" | "routes" | "history" | "stats" | "comparison" | "heralds" | "ancients" | "dclone" | "xp" | "drops" | "settings" | "coop" | "achievements";

function App() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<Page>("profiles");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const { currentToast, enqueue: enqueueToast, dismiss: dismissToast } = useAchievementToasts();

  // Register global hotkeys on app startup
  useEffect(() => {
    import("./pages/Settings").then(({ registerHotkeys }) => {
      registerHotkeys().catch(console.warn);
    });
  }, []);

  // Wire auto-sync on window close
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      try {
        await syncEngine.pushOnClose();
      } catch (err) {
        console.error("[cloud-sync] Auto-sync on close failed:", err);
      }
      // Exit the entire process (destroy only removes the window,
      // but the overlay window keeps the process alive)
      await exit(0);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setCurrentPage("tracker");
  };

  const toggleOverlay = async () => {
    const overlay = await WebviewWindow.getByLabel("overlay");
    if (overlay) {
      const visible = await overlay.isVisible();
      if (visible) {
        await overlay.hide();
      } else {
        await overlay.show();
        await overlay.setAlwaysOnTop(true);
        await overlay.setFocus();
      }
    }
  };


  const handleExport = async () => {
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);

      const filePath = await save({
        defaultPath: `d2r_backup_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, json);
        alert("Data exported successfully!");
      }
    } catch (e) {
      alert("Export error: " + e);
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });

      if (!filePath) return;

      const text = await readTextFile(filePath);
      const data: ExportData = JSON.parse(text);

      if (!data.version || !data.profiles || !data.runs || !data.items) {
        alert("Invalid file. Format not recognized.");
        return;
      }

      const result = await importData(data);
      setImportMsg(
        `Imported: ${result.profiles_imported} profiles, ${result.runs_imported} runs, ${result.items_imported} items. ${result.skipped} duplicates skipped.`
      );
      setTimeout(() => setImportMsg(null), 5000);

      // Refresh profiles page
      setCurrentPage("profiles");
      setSelectedProfile(null);
    } catch (err) {
      alert("Import error: " + err);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case "profiles":
        return <Profiles onSelectProfile={handleSelectProfile} />;
      case "routes":
        return selectedProfile ? <RouteEditor profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "history":
        return selectedProfile ? <History profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "stats":
        return selectedProfile ? <Statistics profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "comparison":
        return selectedProfile ? <Comparison profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "heralds":
        return selectedProfile ? <HeraldTracker profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "ancients":
        return selectedProfile ? <ColossalAncients profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "dclone":
        return selectedProfile ? <DCloneTracker profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "xp":
        return selectedProfile ? <XPTracker profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "drops":
        return <DropCalculator />;
      case "coop":
        return <CoopPanel />;
      case "achievements":
        return selectedProfile ? <Achievements profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "settings":
        return <Settings />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <UpdateChecker />
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>D2R Tracker</h2>
        </div>
        <ul className="nav-links">
          <li>
            <button
              className={`nav-btn ${currentPage === "profiles" ? "active" : ""}`}
              onClick={() => setCurrentPage("profiles")}
            >
              ◎ {t('sidebar.profiles')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "tracker" ? "active" : ""}`}
              onClick={() => setCurrentPage("tracker")}
              disabled={!selectedProfile}
            >
              ▶ {t('sidebar.runTracker')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "routes" ? "active" : ""}`}
              onClick={() => setCurrentPage("routes")}
              disabled={!selectedProfile}
            >
              ↗ {t('sidebar.routes')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "history" ? "active" : ""}`}
              onClick={() => setCurrentPage("history")}
              disabled={!selectedProfile}
            >
              ☰ {t('sidebar.history')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "stats" ? "active" : ""}`}
              onClick={() => setCurrentPage("stats")}
              disabled={!selectedProfile}
            >
              ◈ {t('sidebar.statistics')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "comparison" ? "active" : ""}`}
              onClick={() => setCurrentPage("comparison")}
              disabled={!selectedProfile}
            >
              ⇄ {t('sidebar.compare')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "heralds" ? "active" : ""}`}
              onClick={() => setCurrentPage("heralds")}
              disabled={!selectedProfile}
            >
              ◆ {t('sidebar.heralds')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "ancients" ? "active" : ""}`}
              onClick={() => setCurrentPage("ancients")}
              disabled={!selectedProfile}
            >
              ▣ {t('sidebar.ancients')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "dclone" ? "active" : ""}`}
              onClick={() => setCurrentPage("dclone")}
              disabled={!selectedProfile}
            >
              ※ {t('sidebar.dclone')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "xp" ? "active" : ""}`}
              onClick={() => setCurrentPage("xp")}
              disabled={!selectedProfile}
            >
              △ {t('sidebar.xp')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "drops" ? "active" : ""}`}
              onClick={() => setCurrentPage("drops")}
            >
              ∿ {t('sidebar.drops')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "coop" ? "active" : ""}`}
              onClick={() => setCurrentPage("coop")}
            >
              ⇌ {t('sidebar.coop')}
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "achievements" ? "active" : ""}`}
              onClick={() => setCurrentPage("achievements")}
              disabled={!selectedProfile}
            >
              🏆 {t('sidebar.achievements', 'Achievements')}
            </button>
          </li>
        </ul>
        <div className="sidebar-data-actions">
          <button
            className={`nav-btn ${currentPage === "settings" ? "active" : ""}`}
            onClick={() => setCurrentPage("settings")}
          >
            ⚙ {t('sidebar.settings')}
          </button>
          <button className="nav-btn" onClick={toggleOverlay}>
            ◳ {t('sidebar.overlay')}
          </button>

          <button className="nav-btn" onClick={toggleTheme}>
            {theme === "dark" ? "○" : "●"} {t('sidebar.theme')}
          </button>
          <button className="nav-btn" onClick={handleExport}>
            ↓ {t('sidebar.export')}
          </button>
          <button className="nav-btn" onClick={handleImport}>
            ↑ {t('sidebar.import')}
          </button>
          {importMsg && <div className="import-msg">{importMsg}</div>}
        </div>
        {selectedProfile && (
          <div className="sidebar-footer">
            <div className="current-profile">
              <small>{t('sidebar.activeProfile')}</small>
              <strong>{selectedProfile.name}</strong>
              <span>{selectedProfile.class}</span>
            </div>
            <SyncStatusIndicator syncEngine={syncEngine} />
          </div>
        )}
        {!selectedProfile && (
          <div className="sidebar-footer">
            <SyncStatusIndicator syncEngine={syncEngine} />
          </div>
        )}
      </nav>
      <main className="main-content">
        <Suspense fallback={<PageSkeleton />}>
          {/* RunTracker stays mounted to preserve session state across tab switches */}
          {selectedProfile && (
            <div style={{ display: currentPage === "tracker" ? "block" : "none" }}>
              <RunTracker profile={selectedProfile} isVisible={currentPage === "tracker"} onAchievementUnlocks={enqueueToast} />
            </div>
          )}
          {currentPage !== "tracker" && renderPage()}
        </Suspense>
      </main>
      {currentToast && (
        <UnlockToast toast={currentToast} onDismiss={dismissToast} />
      )}
    </div>
  );
}

export default App;
