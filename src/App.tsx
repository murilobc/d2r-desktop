import { useState, useEffect } from "react";
import type { Profile, ExportData } from "./types";
import Profiles from "./pages/Profiles";
import RunTracker from "./pages/RunTracker";
import History from "./pages/History";
import Statistics from "./pages/Statistics";
import Comparison from "./pages/Comparison";
import Settings from "./pages/Settings";
import DropCalculator from "./pages/DropCalculator";
import RouteEditor from "./pages/RouteEditor";
import HeraldTracker from "./pages/HeraldTracker";
import { registerHotkeys } from "./pages/Settings";
import { exportData, importData } from "./api";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import UpdateChecker from "./components/UpdateChecker";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

type Page = "profiles" | "tracker" | "routes" | "history" | "stats" | "comparison" | "heralds" | "drops" | "settings";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("profiles");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Register global hotkeys on app startup
  useEffect(() => {
    registerHotkeys().catch(console.warn);
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
      case "drops":
        return <DropCalculator />;
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
              👤 Profiles
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "tracker" ? "active" : ""}`}
              onClick={() => setCurrentPage("tracker")}
              disabled={!selectedProfile}
            >
              ▶ Run Tracker
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "routes" ? "active" : ""}`}
              onClick={() => setCurrentPage("routes")}
              disabled={!selectedProfile}
            >
              ↗ Routes
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "history" ? "active" : ""}`}
              onClick={() => setCurrentPage("history")}
              disabled={!selectedProfile}
            >
              ☰ History
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "stats" ? "active" : ""}`}
              onClick={() => setCurrentPage("stats")}
              disabled={!selectedProfile}
            >
              ◈ Statistics
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "comparison" ? "active" : ""}`}
              onClick={() => setCurrentPage("comparison")}
              disabled={!selectedProfile}
            >
              ⇄ Compare
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "heralds" ? "active" : ""}`}
              onClick={() => setCurrentPage("heralds")}
              disabled={!selectedProfile}
            >
              ◆ Heralds
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "drops" ? "active" : ""}`}
              onClick={() => setCurrentPage("drops")}
            >
              ∿ Drops
            </button>
          </li>
        </ul>
        <div className="sidebar-data-actions">
          <button
            className={`nav-btn ${currentPage === "settings" ? "active" : ""}`}
            onClick={() => setCurrentPage("settings")}
          >
            ⚙ Settings
          </button>
          <button className="nav-btn" onClick={toggleOverlay}>
            ◳ Overlay
          </button>
          <button className="nav-btn" onClick={toggleTheme}>
            {theme === "dark" ? "○" : "●"} Theme
          </button>
          <button className="nav-btn" onClick={handleExport}>
            ↓ Export
          </button>
          <button className="nav-btn" onClick={handleImport}>
            ↑ Import
          </button>
          {importMsg && <div className="import-msg">{importMsg}</div>}
        </div>
        {selectedProfile && (
          <div className="sidebar-footer">
            <div className="current-profile">
              <small>Active profile:</small>
              <strong>{selectedProfile.name}</strong>
              <span>{selectedProfile.class}</span>
            </div>
          </div>
        )}
      </nav>
      <main className="main-content">
        {/* RunTracker stays mounted to preserve session state across tab switches */}
        {selectedProfile && (
          <div style={{ display: currentPage === "tracker" ? "block" : "none" }}>
            <RunTracker profile={selectedProfile} isVisible={currentPage === "tracker"} />
          </div>
        )}
        {currentPage !== "tracker" && renderPage()}
      </main>
    </div>
  );
}

export default App;
