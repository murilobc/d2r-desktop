import { useEffect, useState } from "react";
import type { Profile, ColossalAncientAttempt, ColossalAncientStats } from "../types";
import { COLOSSAL_BOSSES } from "../types";
import { createAncientAttempt, getAncientAttempts, getAncientStats, deleteAncientAttempt } from "../api";

interface Props {
  readonly profile: Profile;
}

const BOSS_ICONS: Record<string, string> = {
  Baal: "👑",
  Diablo: "🔥",
  Mephisto: "💀",
  Duriel: "🪲",
  Andariel: "🕷️",
};

export default function ColossalAncients({ profile }: Props) {
  const [attempts, setAttempts] = useState<ColossalAncientAttempt[]>([]);
  const [stats, setStats] = useState<ColossalAncientStats | null>(null);

  // Form state
  const [bossName, setBossName] = useState<string>(COLOSSAL_BOSSES[0]);
  const [result, setResult] = useState<"success" | "fail">("success");
  const [durationMins, setDurationMins] = useState<string>("");
  const [durationSecs, setDurationSecs] = useState<string>("");
  const [drops, setDrops] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const loadData = async () => {
    const [att, st] = await Promise.all([
      getAncientAttempts(profile.id),
      getAncientStats(profile.id),
    ]);
    setAttempts(att);
    setStats(st);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalSecs = (parseInt(durationMins) || 0) * 60 + (parseInt(durationSecs) || 0);
    await createAncientAttempt({
      profile_id: profile.id,
      boss_name: bossName,
      result,
      duration_secs: totalSecs,
      drops: drops || undefined,
      notes: notes || undefined,
    });
    setDrops("");
    setNotes("");
    setDurationMins("");
    setDurationSecs("");
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteAncientAttempt(id);
    loadData();
  };

  const formatTime = (secs: number) => {
    if (secs === 0) return "—";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏛️ Colossal Ancients</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {/* Boss Grid */}
      {stats && (
        <div className="stats-grid">
          {stats.stats_by_boss.map((boss) => {
            const defeated = stats.bosses_defeated.includes(boss.boss_name);
            return (
              <div key={boss.boss_name} className={`stat-card ${defeated ? "stat-card-highlight" : ""}`}>
                <div className="stat-value">
                  {BOSS_ICONS[boss.boss_name]} {defeated ? "✓" : "○"}
                </div>
                <div className="stat-label">{boss.boss_name}</div>
                <div className="stat-sublabel">
                  {boss.attempts > 0
                    ? `${boss.successes}/${boss.attempts} wins${boss.best_time_secs ? ` · Best: ${formatTime(boss.best_time_secs)}` : ""}`
                    : "No attempts"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginTop: "1rem" }}>
          <div className="stat-card">
            <div className="stat-value">{stats.total_attempts}</div>
            <div className="stat-label">Total Attempts</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_successes}</div>
            <div className="stat-label">Total Victories</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.bosses_defeated.length}/5</div>
            <div className="stat-label">Bosses Defeated</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {stats.total_attempts > 0
                ? `${((stats.total_successes / stats.total_attempts) * 100).toFixed(1)}%`
                : "0%"}
            </div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>
      )}

      {/* Log Attempt Form */}
      <div className="herald-section">
        <h2>Log Attempt</h2>
        <form onSubmit={handleSubmit} className="herald-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="colossal-boss">Boss</label>
              <select id="colossal-boss" value={bossName} onChange={(e) => setBossName(e.target.value)}>
                {COLOSSAL_BOSSES.map((b) => (
                  <option key={b} value={b}>{BOSS_ICONS[b]} {b}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="colossal-result">Result</label>
              <div className="result-toggle">
                <button
                  type="button"
                  className={`btn btn-sm ${result === "success" ? "btn-primary" : ""}`}
                  onClick={() => setResult("success")}
                >
                  ✓ Success
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${result === "fail" ? "btn-danger" : ""}`}
                  onClick={() => setResult("fail")}
                >
                  ✕ Fail
                </button>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="colossal-duration-min">Duration</label>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <input
                  id="colossal-duration-min"
                  type="number"
                  min="0"
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                  placeholder="min"
                  style={{ width: "70px" }}
                />
                <span>m</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={durationSecs}
                  onChange={(e) => setDurationSecs(e.target.value)}
                  placeholder="sec"
                  style={{ width: "70px" }}
                  aria-label="Duration seconds"
                />
                <span>s</span>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="colossal-drops">Drops</label>
              <input
                id="colossal-drops"
                type="text"
                value={drops}
                onChange={(e) => setDrops(e.target.value)}
                placeholder="Notable drops..."
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="colossal-notes">Notes</label>
              <input
                id="colossal-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Log Attempt
          </button>
        </form>
      </div>

      {/* Attempt History */}
      <div className="herald-section">
        <h2>Attempt History</h2>
        {attempts.length === 0 ? (
          <p className="empty-state">No Colossal Ancient attempts logged yet.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Boss</th>
                <th>#</th>
                <th>Result</th>
                <th>Duration</th>
                <th>Drops</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((att) => (
                <tr key={att.id}>
                  <td>{new Date(att.attempted_at).toLocaleDateString("en-US")}</td>
                  <td>{BOSS_ICONS[att.boss_name]} {att.boss_name}</td>
                  <td>#{att.attempt_number}</td>
                  <td>
                    <span className={att.result === "success" ? "text-success" : "text-danger"}>
                      {att.result === "success" ? "✓ Won" : "✕ Lost"}
                    </span>
                  </td>
                  <td>{formatTime(att.duration_secs)}</td>
                  <td>{att.drops || "—"}</td>
                  <td>{att.notes || "—"}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(att.id)}
                      aria-label="Delete attempt"
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
