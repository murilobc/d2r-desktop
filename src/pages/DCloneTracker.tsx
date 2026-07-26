import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, DCloneProgress, DCloneSettings, AnniLog } from "../types";
import { DCLONE_REGIONS, DCLONE_MODES, DCLONE_POLL_INTERVALS } from "../types";
import {
  getDcloneProgress,
  updateDcloneProgress,
  createAnniLog,
  getAnniLogs,
  deleteAnniLog,
  pollDcloneApi,
  getDcloneSettings,
  updateDcloneSettings,
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
  const { t } = useTranslation();
  const [progress, setProgress] = useState<DCloneProgress[]>([]);
  const [anniLogs, setAnniLogs] = useState<AnniLog[]>([]);
  const [settings, setSettings] = useState<DCloneSettings>({
    auto_fetch_enabled: true,
    poll_interval_minutes: 5,
    notify_threshold: 5,
    preferred_region: "Americas",
    preferred_mode: "Non-Ladder",
    last_poll_at: null,
    last_notified_progress: null,
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Anni form state
  const [anniStats, setAnniStats] = useState("");
  const [anniNotes, setAnniNotes] = useState("");

  const loadData = useCallback(async () => {
    const [prog, logs, s] = await Promise.all([
      getDcloneProgress(),
      getAnniLogs(profile.id),
      getDcloneSettings(),
    ]);
    setProgress(prog);
    setAnniLogs(logs);

    // localStorage migration: if old keys exist, migrate to DB then remove
    const legacyThreshold = localStorage.getItem("d2r-dclone-notify-threshold");
    const legacyRegion = localStorage.getItem("d2r-dclone-preferred-region");
    if (legacyThreshold || legacyRegion) {
      const merged: DCloneSettings = {
        ...s,
        notify_threshold: legacyThreshold ? Number.parseInt(legacyThreshold) : s.notify_threshold,
        preferred_region: legacyRegion || s.preferred_region,
      };
      try {
        const updated = await updateDcloneSettings(merged);
        setSettings(updated);
        if (legacyThreshold) localStorage.removeItem("d2r-dclone-notify-threshold");
        if (legacyRegion) localStorage.removeItem("d2r-dclone-preferred-region");
      } catch {
        setSettings(s); // keep current if update fails
      }
    } else {
      setSettings(s);
    }
  }, [profile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling useEffect
  useEffect(() => {
    if (!settings.auto_fetch_enabled) return;
    const intervalMs = settings.poll_interval_minutes * 60 * 1000;
    const timer = setInterval(async () => {
      try {
        const records = await pollDcloneApi();
        setProgress(records);
      } catch {
        // leave existing state unchanged on error
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [settings.auto_fetch_enabled, settings.poll_interval_minutes]);

  const handleUpdateProgress = async (region: string, mode: string, value: number) => {
    await updateDcloneProgress(region, value, mode, true);
    loadData();
  };

  const handleClearOverride = async (region: string, mode: string, progress: number) => {
    await updateDcloneProgress(region, progress, mode, false);
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

  const saveSettings = async (updated: DCloneSettings) => {
    setSettings(updated);
    setSettingsError(null);
    try {
      const saved = await updateDcloneSettings(updated);
      setSettings(saved);
    } catch (e) {
      setSettings(settings); // revert on error
      setSettingsError(String(e));
    }
  };

  const getRegionModeProgress = (region: string, mode: string): DCloneProgress => {
    const found = progress.find((p) => p.region === region && p.mode === mode);
    return found || {
      region,
      mode,
      progress: 1,
      last_updated: new Date().toISOString(),
      is_manual_override: false,
    };
  };

  const isStale = (rp: DCloneProgress): boolean => {
    const age = Date.now() - new Date(rp.last_updated).getTime();
    return age > settings.poll_interval_minutes * 2 * 60 * 1000;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>😈 {t('dclone.title')}</h1>
        <span className="badge">{profile.name} - {profile.class}</span>
      </div>

      {/* DClone Progress per Region — one card per region, rows per mode */}
      <div className="herald-section">
        <h2>{t('dclone.progress')}</h2>
        <p className="settings-description">
          {settings.auto_fetch_enabled
            ? `Auto-fetching from diablo2.io every ${settings.poll_interval_minutes} minutes. Manual overrides are preserved.`
            : "Manual tracking mode. Update from community reports (diablo2.io, Discord)."}
        </p>
        <div className="dclone-regions">
          {DCLONE_REGIONS.map((region) => (
            <div key={region} className="dclone-region-card">
              <div className="dclone-region-header" style={{ marginBottom: 8 }}>
                <strong>{region}</strong>
              </div>
              {(DCLONE_MODES as unknown as string[]).map((mode) => {
                const rp = getRegionModeProgress(region, mode);
                const progressPercent = ((rp.progress - 1) / 5) * 100;
                const stale = isStale(rp);
                return (
                  <div key={mode} style={{ marginBottom: 12 }}>
                    <div className="dclone-region-header">
                      <span style={{ fontSize: "0.85em", opacity: 0.8 }}>{mode}</span>
                      <span
                        className="dclone-progress-label"
                        style={{ color: PROGRESS_COLORS[rp.progress] }}
                      >
                        {rp.progress}/6 — {PROGRESS_LABELS[rp.progress]}
                      </span>
                      {stale && (
                        <span title="Stale data — may not reflect current state" aria-label="Stale data">
                          ⏰
                        </span>
                      )}
                      {rp.is_manual_override && (
                        <span
                          style={{
                            fontSize: "0.72em",
                            background: "#444",
                            padding: "1px 5px",
                            borderRadius: 3,
                            marginLeft: 4,
                          }}
                        >
                          Manual
                        </span>
                      )}
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
                          onClick={() => handleUpdateProgress(region, mode, val)}
                          aria-label={`Set ${region} ${mode} progress to ${val}`}
                        >
                          {val}
                        </button>
                      ))}
                      {rp.is_manual_override && (
                        <button
                          className="btn btn-sm"
                          onClick={() => handleClearOverride(region, mode, rp.progress)}
                          style={{ marginLeft: 4, fontSize: "0.75em" }}
                        >
                          Clear override
                        </button>
                      )}
                    </div>
                    <div className="dclone-last-updated" style={{ fontSize: "0.75em", opacity: 0.7 }}>
                      Last updated: {new Date(rp.last_updated).toLocaleString("en-US")}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Section */}
      <div className="herald-section">
        <h2>{t('dclone.notify')}</h2>
        {settingsError && (
          <div role="alert" style={{ color: "#e94560", marginBottom: 8 }}>{settingsError}</div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="dclone-auto-fetch">Auto-Fetch</label>
            <button
              id="dclone-auto-fetch"
              className={`hotkey-btn ${settings.auto_fetch_enabled ? "recording" : ""}`}
              onClick={() => saveSettings({ ...settings, auto_fetch_enabled: !settings.auto_fetch_enabled })}
            >
              {settings.auto_fetch_enabled ? "ON" : "OFF"}
            </button>
          </div>
          <div className="form-group">
            <label htmlFor="dclone-interval">Poll Interval</label>
            <select
              id="dclone-interval"
              value={settings.poll_interval_minutes}
              onChange={(e) => saveSettings({ ...settings, poll_interval_minutes: Number.parseInt(e.target.value) })}
            >
              {(DCLONE_POLL_INTERVALS as unknown as number[]).map((v) => (
                <option key={v} value={v}>{v} min</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dclone-region">{t('dclone.preferredRegion')}</label>
            <select
              id="dclone-region"
              value={settings.preferred_region}
              onChange={(e) => saveSettings({ ...settings, preferred_region: e.target.value })}
            >
              {DCLONE_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dclone-mode">Preferred Mode</label>
            <select
              id="dclone-mode"
              value={settings.preferred_mode}
              onChange={(e) => saveSettings({ ...settings, preferred_mode: e.target.value })}
            >
              {(DCLONE_MODES as unknown as string[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="dclone-threshold">Notify at Progress</label>
            <select
              id="dclone-threshold"
              value={settings.notify_threshold}
              onChange={(e) => saveSettings({ ...settings, notify_threshold: Number.parseInt(e.target.value) })}
            >
              {[3, 4, 5, 6].map((v) => (
                <option key={v} value={v}>{v} — {PROGRESS_LABELS[v]}</option>
              ))}
            </select>
          </div>
        </div>
        {settings.last_poll_at && (
          <p style={{ fontSize: "0.8em", opacity: 0.6, marginTop: 4 }}>
            Last API poll: {new Date(settings.last_poll_at).toLocaleString("en-US")}
          </p>
        )}
      </div>

      {/* Annihilus Log */}
      <div className="herald-section">
        <h2>{t('dclone.anniLog')}</h2>
        <form onSubmit={handleAnniSubmit} className="herald-form">
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="anni-stats">{t('dclone.attributes')}</label>
              <input
                id="anni-stats"
                type="text"
                value={anniStats}
                onChange={(e) => setAnniStats(e.target.value)}
                placeholder="+1 Skills / +10-20 Attributes / +10-20 Resistances / 5-10% XP"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="anni-notes">{t('dclone.notes')}</label>
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
            {t('dclone.logAnni')}
          </button>
        </form>

        {anniLogs.length === 0 ? (
          <p className="empty-state">{t('dclone.noAnnis')}</p>
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
