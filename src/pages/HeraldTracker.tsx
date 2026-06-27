import { useEffect, useState } from "react";
import type { Profile, HeraldEncounter, HeraldStats } from "../types";
import { AREAS } from "../types";
import { createHeraldEncounter, getHeraldEncounters, getHeraldStats, deleteHeraldEncounter } from "../api";

interface Props {
  readonly profile: Profile;
}

const SUNDER_CHARMS = [
  "Cold Rupture",
  "Flame Rift",
  "Crack of the Heavens",
  "Bone Break",
  "Rotting Fissure",
  "Black Cleft",
];

const SUNDER_ELEMENTS: Record<string, string> = {
  "Cold Rupture": "❄️ Cold",
  "Flame Rift": "🔥 Fire",
  "Crack of the Heavens": "⚡ Lightning",
  "Bone Break": "💀 Physical",
  "Rotting Fissure": "☠️ Poison",
  "Black Cleft": "🟣 Magic",
};

export default function HeraldTracker({ profile }: Props) {
  const [encounters, setEncounters] = useState<HeraldEncounter[]>([]);
  const [stats, setStats] = useState<HeraldStats | null>(null);

  // Form state
  const [tier, setTier] = useState<number>(1);
  const [area, setArea] = useState(AREAS[0]);
  const [result, setResult] = useState<"success" | "fail">("success");
  const [sunderCharm, setSunderCharm] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const loadData = async () => {
    const [enc, st] = await Promise.all([
      getHeraldEncounters(profile.id),
      getHeraldStats(profile.id),
    ]);
    setEncounters(enc);
    setStats(st);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createHeraldEncounter({
      profile_id: profile.id,
      tier,
      area,
      result,
      sunder_charm: sunderCharm || undefined,
      notes: notes || undefined,
    });
    setNotes("");
    setSunderCharm("");
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteHeraldEncounter(id);
    loadData();
  };

  const successRate = stats && stats.total_encounters > 0
    ? ((stats.success_count / stats.total_encounters) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚔️ Herald Tracker</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {/* Stats Panel */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_encounters}</div>
            <div className="stat-label">Total Encounters</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{successRate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.success_count}</div>
            <div className="stat-label">Victories</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.fail_count}</div>
            <div className="stat-label">Defeats</div>
          </div>
        </div>
      )}

      {/* Tier Progression */}
      <div className="herald-section">
        <h2>Tier Progression</h2>
        <div className="tier-progression">
          {[1, 2, 3, 4, 5].map((t) => {
            const tierData = stats?.encounters_by_tier.find((et) => et.tier === t);
            const count = tierData?.count || 0;
            const successes = tierData?.successes || 0;
            return (
              <div key={t} className={`tier-progress-item ${count > 0 ? "tier-active" : ""}`}>
                <div className="tier-progress-badge">T{t}</div>
                <div className="tier-progress-stats">
                  <span>{count} encounters</span>
                  {count > 0 && <span>{successes}/{count} won</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sunder Charm Collection */}
      <div className="herald-section">
        <h2>Sunder Charm Collection</h2>
        <div className="sunder-grid">
          {SUNDER_CHARMS.map((charm) => {
            const found = stats?.sunder_charms_found.includes(charm);
            return (
              <div key={charm} className={`sunder-card ${found ? "sunder-found" : ""}`}>
                <span className="sunder-icon">{found ? "✓" : "○"}</span>
                <span className="sunder-name">{SUNDER_ELEMENTS[charm]}</span>
                <span className="sunder-charm-name">{charm}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log Encounter Form */}
      <div className="herald-section">
        <h2>Log Encounter</h2>
        <form onSubmit={handleSubmit} className="herald-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="herald-tier">Tier</label>
              <select id="herald-tier" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((t) => (
                  <option key={t} value={t}>Tier {t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="herald-area">Area</label>
              <select id="herald-area" value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.filter((a) => a !== "Other").map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="herald-result">Result</label>
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
            <div className="form-group">
              <label htmlFor="herald-sunder">Sunder Charm</label>
              <select id="herald-sunder" value={sunderCharm} onChange={(e) => setSunderCharm(e.target.value)}>
                <option value="">None</option>
                {SUNDER_CHARMS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="herald-notes">Notes</label>
              <input
                id="herald-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Log Encounter
          </button>
        </form>
      </div>

      {/* Encounter History */}
      <div className="herald-section">
        <h2>Encounter History</h2>
        {encounters.length === 0 ? (
          <p className="empty-state">No herald encounters logged yet.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Tier</th>
                <th>Area</th>
                <th>Result</th>
                <th>Sunder</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {encounters.map((enc) => (
                <tr key={enc.id}>
                  <td>{new Date(enc.encountered_at).toLocaleDateString("en-US")}</td>
                  <td><span className="tier-progress-badge">T{enc.tier}</span></td>
                  <td>{enc.area}</td>
                  <td>
                    <span className={enc.result === "success" ? "text-success" : "text-danger"}>
                      {enc.result === "success" ? "✓ Won" : "✕ Lost"}
                    </span>
                  </td>
                  <td>{enc.sunder_charm || "—"}</td>
                  <td>{enc.notes || "—"}</td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(enc.id)}
                      aria-label="Delete encounter"
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
