import { useEffect, useState } from "react";
import type { Profile, DCloneProgress, AnniLog } from "../types";
import { DCLONE_REGIONS } from "../types";
import {
  getDcloneProgress,
  updateDcloneProgress,
  createAnniLog,
  getAnniLogs,
  deleteAnniLog,
} from "../api";

interface Props {
  readonly profile: Profile;
}

const PROGRESS_LABELS: Record<number, string> = {
  1: "Calm",
  2: "Restless",
  3: "Agitated",
  4: "Frenzied",
  5: "Terrorizing",
  6: "Diablo Walks!",
};

const PROGRESS_COLORS: Record<number, string> = {
  1: "#4ecdc4",
  2: "#4ecdc4",
  3: "#ffd700",
  4: "#ff8c00",
  5: "#e94560",
  6: "#ff0000",
};

export default function DCloneTracker({ profile }: Props) {
  const [progress, setProgress] = useState<DCloneProgress[]>([]);
  const [anniLogs, setAnniLogs] = useState<AnniLog[]>([]);

  // Anni form state
  const [anniStats, setAnniStats] = useState("");
  const [anniNotes, setAnniNotes] = useState("");

  // Notification settings
  const [notifyThreshold, setNotifyThreshold] = useState<number>(() => {
    const stored = localStorage.getItem("d2r-dclone-notify-threshold");
    return stored ? parseInt(stored) : 5;
  });
  const [preferredRegion, setPreferredRegion] = useState<string>(() => {
    return localStorage.getItem("d2r-dclone-preferred-region") || "Americas";
  });

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const loadData = async () => {
    const [prog, logs] = await Promise.all([
      getDcloneProgress(),
      getAnniLogs(profile.id),
    ]);
    setProgress(prog);
    setAnniLogs(logs);
  };

  const handleUpdateProgress = async (region: string, value: number) => {
    await updateDcloneProgress(region, value);
    loadData();
  };

  const handleAnniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anniStats.trim()) return;
    await createAnniLog({
      profile_id: profile.id,
      stats: anniStats,
      notes: anniNotes || undefined,
    });
    setAnniStats("");
    setAnniNotes("");
    loadData();
  };

  const handleDeleteAnni = async (id: string) => {
    await deleteAnniLog(id);
    loadData();
  };

  const saveNotifySettings = (threshold: number, region: string) => {
    setNotifyThreshold(threshold);
    setPreferredRegion(region);
    localStorage.setItem("d2r-dclone-notify-threshold", threshold.toString());
    localStorage.setItem("d2r-dclone-preferred-region", region);
  };

  const getRegionProgress = (region: string): DCloneProgress => {
    const found = progress.find((p) => p.region === region);
    return found || { region, progress: 1, last_updated: new Date().toISOString() };
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>😈 Diablo Clone Tracker</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {/* DClone Progress per Region */}
      <div className="herald-section">
        <h2>DClone Progress</h2>
        <p className="settings-description">
          Track Diablo Clone progress per region. Update manually from community reports (diablo2.io, Discord).
        </p>
        <div className="dclone-regions">
          {DCLONE_REGIONS.map((region) => {
            const rp = getRegionProgress(region);
            const progressPercent = ((rp.progress - 1) / 5) * 100;
            return (
              <div key={region} className="dclone-region-card">
                <div className="dclone-region-header">
                  <strong>{region}</strong>
                  <span
                    className="dclone-progress-label"
                    style={{ color: PROGRESS_COLORS[rp.progress] }}
                  >
                    {rp.progress}/6 — {PROGRESS_LABELS[rp.progress]}
                  </span>
                </div>
                <div className="dclone-progress-bar">
                  <div
                    className="dclone-progress-fill"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: PROGRESS_COLORS[rp.progress],
                    }}
                  />
                </div>
                <div className="dclone-progress-controls">
                  {[1, 2, 3, 4, 5, 6].map((val) => (
                    <button
                      key={val}
                      className={`btn btn-sm ${rp.progress === val ? "btn-primary" : ""}`}
                      onClick={() => handleUpdateProgress(region, val)}
                      aria-label={`Set ${region} progress to ${val}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <div className="dclone-last-updated">
                  Last updated: {new Date(rp.last_updated).toLocaleString("en-US")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="herald-section">
        <h2>Notification Settings</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="dclone-region">Preferred Region</label>
            <select
              id="dclone-region"
              value={preferredRegion}
              onChange={(e) => saveNotifySettings(notifyThreshold, e.target.value)}
            >
              {DCLONE_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dclone-threshold">Notify at Progress</label>
            <select
              id="dclone-threshold"
              value={notifyThreshold}
              onChange={(e) => saveNotifySettings(parseInt(e.target.value), preferredRegion)}
            >
              {[3, 4, 5, 6].map((v) => (
                <option key={v} value={v}>{v} — {PROGRESS_LABELS[v]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Annihilus Log */}
      <div className="herald-section">
        <h2>Annihilus Collection</h2>
        <form onSubmit={handleAnniSubmit} className="herald-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="anni-stats">Stats (e.g., "10/18/9")</label>
              <input
                id="anni-stats"
                type="text"
                value={anniStats}
                onChange={(e) => setAnniStats(e.target.value)}
                placeholder="+1 Skills / +10-20 Attributes / +10-20 Resistances / 5-10% XP"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="anni-notes">Notes</label>
              <input
                id="anni-notes"
                type="text"
                value={anniNotes}
                onChange={(e) => setAnniNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Log Annihilus
          </button>
        </form>

        {anniLogs.length === 0 ? (
          <p className="empty-state">No Annihilus charms logged yet.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Stats</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {anniLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.obtained_at).toLocaleDateString("en-US")}</td>
                  <td>{log.stats}</td>
                  <td>{log.notes || "—"}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeleteAnni(log.id)}
                      aria-label="Delete Annihilus log"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
