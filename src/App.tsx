import { useState } from "react";
import type { Profile } from "./types";
import Profiles from "./pages/Profiles";
import RunTracker from "./pages/RunTracker";
import History from "./pages/History";
import Statistics from "./pages/Statistics";
import "./App.css";

type Page = "profiles" | "tracker" | "history" | "stats";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("profiles");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setCurrentPage("tracker");
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
