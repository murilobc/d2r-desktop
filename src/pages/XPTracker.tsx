import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, XpEntry, XpStats } from "../types";
import { AREAS } from "../types";
import { createXpEntry, getXpEntries, getXpStats, deleteXpEntry } from "../api";
import { getXpToNextLevel, estimateTimeToLevel, formatXp } from "../data/xp-table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  readonly profile: Profile;
}

export default function XPTracker({ profile }: Props) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<XpEntry[]>([]);
  const [stats, setStats] = useState<XpStats | null>(null);

  // Form state
  const [level, setLevel] = useState<number>(90);
  const [xpGained, setXpGained] = useState<string>("");
  const [durationMins, setDurationMins] = useState<string>("");
  const [area, setArea] = useState(AREAS[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const loadData = async () => {
    const [ent, st] = await Promise.all([
      getXpEntries(profile.id),
      getXpStats(profile.id),
    ]);
    setEntries(ent);
    setStats(st);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const xp = parseInt(xpGained) || 0;
    if (xp <= 0) return;
    const durationSecs = (parseInt(durationMins) || 0) * 60;
    await createXpEntry({
      profile_id: profile.id,
      level,
      xp_gained: xp,
      duration_secs: durationSecs,
      area: area || undefined,
      notes: notes || undefined,
    });
    setXpGained("");
    setDurationMins("");
    setNotes("");
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteXpEntry(id);
    loadData();
  };

  // Calculate XP/hour from most recent entry for time-to-level estimate
  const latestXpPerHour = useMemo(() => {
    if (!stats || stats.total_time_secs === 0) return 0;
    return stats.xp_per_hour;
  }, [stats]);

  const xpToNext = getXpToNextLevel(level);
  const timeToLevel = estimateTimeToLevel(level, 0, latestXpPerHour);

  // Chart data: XP/hour over entries (chronological)
  const chartData = useMemo(() => {
    return entries
      .filter((e) => e.duration_secs > 0)
      .reverse()
      .map((e, idx) => ({
        session: idx + 1,
        xpPerHour: Math.round((e.xp_gained / e.duration_secs) * 3600),
        level: e.level,
      }));
  }, [entries]);

  const formatDuration = (secs: number) => {
    if (secs === 0) return "—";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>📈 {t('xp.title')}</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{formatXp(stats.total_xp)}</div>
            <div className="stat-label">{t('xp.totalXp')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatXp(Math.round(stats.xp_per_hour))}</div>
            <div className="stat-label">{t('xp.avgXpPerHour')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatDuration(stats.total_time_secs)}</div>
            <div className="stat-label">{t('xp.totalTime')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.entries_count}</div>
            <div className="stat-label">{t('xp.entries')}</div>
          </div>
        </div>
      )}

      {/* Level Info */}
      <div className="stats-grid" style={{ marginTop: "1rem" }}>
        <div className="stat-card">
          <div className="stat-value">Lv.{level}</div>
          <div className="stat-label">{t('xp.level')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatXp(xpToNext)}</div>
          <div className="stat-label">{t('xp.xpToNext')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {timeToLevel !== null ? formatDuration(timeToLevel) : "—"}
          </div>
          <div className="stat-label">{t('xp.estTime')}</div>
          <div className="stat-sublabel">
            {latestXpPerHour > 0 ? `at ${formatXp(Math.round(latestXpPerHour))}/hr` : "Need data"}
          </div>
        </div>
      </div>

      {/* XP/Hour Chart */}
      {chartData.length > 1 && (
        <div className="herald-section">
          <h2>XP Rate Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="session" stroke="#888" label={{ value: "Session", position: "bottom", fill: "#888" }} />
              <YAxis stroke="#888" tickFormatter={(v) => formatXp(v)} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid #333" }}
                formatter={(value) => [formatXp(Number(value)) + "/hr", "XP Rate"]}
              />
              <Line type="monotone" dataKey="xpPerHour" stroke="#4ecdc4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Log XP Form */}
      <div className="herald-section">
        <h2>{t('xp.logEntry')}</h2>
        <form onSubmit={handleSubmit} className="herald-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="xp-level">{t('xp.level')}</label>
              <input
                id="xp-level"
                type="number"
                min={1}
                max={99}
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="xp-gained">{t('xp.xpGained')}</label>
              <input
                id="xp-gained"
                type="number"
                min={0}
                value={xpGained}
                onChange={(e) => setXpGained(e.target.value)}
                placeholder="e.g., 5000000"
              />
            </div>
            <div className="form-group">
              <label htmlFor="xp-duration">{t('xp.duration')}</label>
              <input
                id="xp-duration"
                type="number"
                min={0}
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                placeholder="e.g., 60"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="xp-area">{t('xp.area')}</label>
              <select id="xp-area" value={area} onChange={(e) => setArea(e.target.value)}>
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="xp-notes">{t('xp.notes')}</label>
              <input
                id="xp-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            {t('xp.submit')}
          </button>
        </form>
      </div>

      {/* XP History */}
      <div className="herald-section">
        <h2>{t('xp.entries')}</h2>
        {entries.length === 0 ? (
          <p className="empty-state">{t('xp.noEntries')}</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Level</th>
                <th>XP Gained</th>
                <th>Duration</th>
                <th>XP/Hour</th>
                <th>Area</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const xpHr = entry.duration_secs > 0
                  ? Math.round((entry.xp_gained / entry.duration_secs) * 3600)
                  : 0;
                return (
                  <tr key={entry.id}>
                    <td>{new Date(entry.recorded_at).toLocaleDateString("en-US")}</td>
                    <td>Lv.{entry.level}</td>
                    <td>{formatXp(entry.xp_gained)}</td>
                    <td>{formatDuration(entry.duration_secs)}</td>
                    <td>{xpHr > 0 ? formatXp(xpHr) + "/hr" : "—"}</td>
                    <td>{entry.area || "—"}</td>
                    <td>{entry.notes || "—"}</td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(entry.id)}
                        aria-label="Delete XP entry"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
