import { useState, useRef } from "react";
import type { Profile } from "./types";
import type { ExportData } from "./types";
import Profiles from "./pages/Profiles";
import RunTracker from "./pages/RunTracker";
import History from "./pages/History";
import Statistics from "./pages/Statistics";
import { exportData, importData } from "./api";
import "./App.css";

type Page = "profiles" | "tracker" | "history" | "stats";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("profiles");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setCurrentPage("tracker");
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `d2r_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erro ao exportar: " + e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);

      if (!data.version || !data.profiles || !data.runs || !data.items) {
        alert("Arquivo inválido. Formato não reconhecido.");
        return;
      }

      const result = await importData(data);
      setImportMsg(
        `Importado: ${result.profiles_imported} perfis, ${result.runs_imported} runs, ${result.items_imported} itens. ${result.skipped} duplicados ignorados.`
      );
      setTimeout(() => setImportMsg(null), 5000);

      // Refresh profiles page
      setCurrentPage("profiles");
      setSelectedProfile(null);
    } catch (err) {
      alert("Erro ao importar: " + err);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderPage = () => {
    switch (currentPage) {
      case "profiles":
        return <Profiles onSelectProfile={handleSelectProfile} />;
      case "tracker":
        return selectedProfile ? <RunTracker profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "history":
        return selectedProfile ? <History profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
      case "stats":
        return selectedProfile ? <Statistics profile={selectedProfile} /> : <Profiles onSelectProfile={handleSelectProfile} />;
    }
  };

  return (
    <div className="app">
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
              👤 Perfis
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "tracker" ? "active" : ""}`}
              onClick={() => setCurrentPage("tracker")}
              disabled={!selectedProfile}
            >
              🎮 Run Tracker
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "history" ? "active" : ""}`}
              onClick={() => setCurrentPage("history")}
              disabled={!selectedProfile}
            >
              📜 Histórico
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${currentPage === "stats" ? "active" : ""}`}
              onClick={() => setCurrentPage("stats")}
              disabled={!selectedProfile}
            >
              📊 Estatísticas
            </button>
          </li>
        </ul>
        <div className="sidebar-data-actions">
          <button className="nav-btn" onClick={handleExport}>
            💾 Exportar Dados
          </button>
          <button className="nav-btn" onClick={() => fileInputRef.current?.click()}>
            📂 Importar Dados
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
          {importMsg && <div className="import-msg">{importMsg}</div>}
        </div>
        {selectedProfile && (
          <div className="sidebar-footer">
            <div className="current-profile">
              <small>Perfil ativo:</small>
              <strong>{selectedProfile.name}</strong>
              <span>{selectedProfile.class}</span>
            </div>
          </div>
        )}
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
