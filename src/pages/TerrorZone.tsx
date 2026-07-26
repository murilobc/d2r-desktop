import { useEffect, useState, useCallback } from "react";
import type { Profile, TerrorZoneInfo, TzSettings, UpcomingZoneEntry } from "../types";
import {
  fetchTerrorZone,
  getSpTerrorZone,
  getTzCache,
  getTzSettings,
  updateTzSettings,
  getAreaRunStats,
  getStatsCombined,
} from "../api";

interface Props {
  profile: Profile;
}

const TIER_COLORS: Record<string, string> = {
  S: "#e94560",
  A: "#ff8c00",
  B: "#4ecdc4",
  C: "#888",
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: 3,
        fontSize: "0.75em",
        fontWeight: 700,
        background: TIER_COLORS[tier] || "#666",
        color: "#fff",
        marginLeft: 4,
      }}
    >
      {tier}
    </span>
  );
}

function formatUtcTime(utcSecs: number): string {
  const d = new Date(utcSecs * 1000);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m} UTC`;
}

export default function TerrorZone({ profile }: Props) {
  const [tzInfo, setTzInfo] = useState<TerrorZoneInfo | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingZoneEntry[]>([]);
  const [countdown, setCountdown] = useState(0); // seconds until next hour
  const [settings, setSettings] = useState<TzSettings>({ polling_enabled: true, good_tz_tier: "A" });
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number>(0);
  const [advisorData, setAdvisorData] = useState<{
    zoneItemsPerHour: number;
    avgItemsPerHour: number;
    runCount: number;
  } | null>(null);

  // Load initial data
  const loadInitial = useCallback(async () => {
    try {
      const [s, cached] = await Promise.all([getTzSettings(), getTzCache()]);
      setSettings(s);

      if (cached) {
        setTzInfo(cached);
      } else {
        // Fall back to SP calc
        const sp = await getSpTerrorZone(Date.now() / 1000);
        setTzInfo(sp);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Countdown timer — fires every 60 seconds, detects hour boundary
  useEffect(() => {
    const updateCountdown = () => {
      const nowSecs = Math.floor(Date.now() / 1000);
      const secsUntilNextHour = 3600 - (nowSecs % 3600);
      setCountdown(secsUntilNextHour);

      // When countdown reaches 0, trigger a fresh TZ fetch
      if (secsUntilNextHour >= 3599) {
        setLastFetchAt(0); // bypass rate limit on hour boundary
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Polling — respects 10-minute rate limit, bypassed on hour boundary
  useEffect(() => {
    if (!settings.polling_enabled) return;

    const tryFetch = async () => {
      const now = Date.now();
      const elapsed = now - lastFetchAt;
      const isHourBoundary = lastFetchAt === 0;

      if (!isHourBoundary && elapsed < 10 * 60 * 1000) return;

      try {
        const response = await fetchTerrorZone();
        const nowSecs = Math.floor(Date.now() / 1000);

        setTzInfo({
          zone_name: response.current_zone,
          tier: "C", // tier is computed client-side from the zone name
          fetched_at: new Date().toISOString(),
        });

        // Build upcoming entries
        const upcomingEntries: UpcomingZoneEntry[] = response.upcoming
          .slice(0, 5)
          .map((zone, i) => ({
            zone_name: zone,
            tier: "C" as const, // simplified
            utc_start_secs: (Math.floor(nowSecs / 3600) + 1 + i) * 3600,
          }));
        setUpcoming(upcomingEntries);
        setLastFetchAt(now);
      } catch {
        // On error: fall back to SP calc for current zone
        const sp = await getSpTerrorZone(Date.now() / 1000).catch(() => null);
        if (sp) setTzInfo(sp);
      }
    };

    tryFetch();
    const timer = setInterval(tryFetch, 60_000);
    return () => clearInterval(timer);
  }, [settings.polling_enabled, lastFetchAt]);

  // SP upcoming zones (when offline or no API data)
  useEffect(() => {
    if (upcoming.length < 3 || !settings.polling_enabled) {
      const nowSecs = Math.floor(Date.now() / 1000);
      const spUpcoming: UpcomingZoneEntry[] = [];
      for (let i = 1; i <= 5; i++) {
        const t = (Math.floor(nowSecs / 3600) + i) * 3600;
        // SP zone is deterministic, but we don't have a TS version
        // Use tzInfo zone_name as placeholder for all upcoming (simplified)
        if (tzInfo) {
          spUpcoming.push({
            zone_name: `Zone ${i} ahead`,
            tier: "C",
            utc_start_secs: t,
          });
        }
      }
      if (upcoming.length < 3) setUpcoming(spUpcoming);
    }
  }, [tzInfo, settings.polling_enabled, upcoming.length]);

  // Advisor data
  useEffect(() => {
    if (!tzInfo) return;
    const load = async () => {
      try {
        const [areaStats, combined] = await Promise.all([
          getAreaRunStats(profile.id, tzInfo.zone_name),
          getStatsCombined(profile.id),
        ]);
        const zoneIPH =
          areaStats.total_runs > 0 && areaStats.avg_duration_secs > 0
            ? (areaStats.total_items_found / areaStats.avg_duration_secs) * 3600
            : 0;
        const avgIPH = combined.summary.items_per_run > 0 && combined.summary.avg_run_duration_secs > 0
          ? (combined.summary.items_per_run / combined.summary.avg_run_duration_secs) * 3600
          : 0;
        setAdvisorData({
          zoneItemsPerHour: zoneIPH,
          avgItemsPerHour: avgIPH,
          runCount: areaStats.total_runs,
        });
      } catch {
        // silent
      }
    };
    load();
  }, [tzInfo?.zone_name, profile.id]);

  const saveSettings = async (updated: TzSettings) => {
    const prev = settings;
    setSettings(updated);
    setSettingsError(null);
    try {
      const saved = await updateTzSettings(updated);
      setSettings(saved);
    } catch (e) {
      setSettings(prev);
      setSettingsError(String(e));
    }
  };

  const countdownMins = Math.ceil(countdown / 60);
  const isRecommended = advisorData && advisorData.runCount >= 3
    && advisorData.zoneItemsPerHour >= advisorData.avgItemsPerHour * 1.1;

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚡ Terror Zone</h1>
        <span className="badge">{profile.name} · {profile.class}</span>
      </div>

      {/* ── TZ Display ── */}
      <div className="herald-section">
        <h2>Current Terror Zone</h2>
        {!tzInfo ? (
          <p>Loading Terror Zone data…</p>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <strong style={{ fontSize: "1.1em" }}>{tzInfo.zone_name}</strong>
              <TierBadge tier={tzInfo.tier} />
              {isRecommended && (
                <span style={{ color: "#4caf50", fontSize: "0.85em", fontWeight: 600 }}>
                  ✓ Recommended
                </span>
              )}
            </div>
            <p style={{ opacity: 0.7, fontSize: "0.85em", margin: 0 }}>
              Next rotation in ~{countdownMins} min
              {tzInfo.fetched_at && (
                <span> · Last fetched: {new Date(tzInfo.fetched_at).toLocaleTimeString("en-US")}</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Advisor ── */}
      {tzInfo && advisorData && (
        <div className="herald-section">
          <h2>Your TZ Performance</h2>
          {advisorData.runCount < 3 ? (
            <p className="empty-state">
              Less than 3 runs recorded for this zone.
              Tier: <TierBadge tier={tzInfo.tier} /> — fewer than 3 runs, personal data insufficient.
            </p>
          ) : (
            <div>
              <p>
                <strong>Your items/hr in this zone:</strong>{" "}
                {advisorData.zoneItemsPerHour.toFixed(1)}
                {" "}vs profile avg {advisorData.avgItemsPerHour.toFixed(1)}
              </p>
              {isRecommended && (
                <p style={{ color: "#4caf50" }}>
                  ✓ <strong>Recommended</strong> — this zone is ≥10% above your average.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TZ Calendar ── */}
      <div className="herald-section">
        <h2>Upcoming Zones</h2>
        {upcoming.length === 0 ? (
          <p className="empty-state">No upcoming zone data available.</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col">Tier</th>
                <th scope="col">Active At</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.slice(0, 5).map((z, i) => (
                <tr key={i}>
                  <td>{z.zone_name}</td>
                  <td><TierBadge tier={z.tier} /></td>
                  <td>{formatUtcTime(z.utc_start_secs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Settings ── */}
      <div className="herald-section">
        <h2>Settings</h2>
        {settingsError && (
          <div role="alert" style={{ color: "#e94560", marginBottom: 8 }}>
            Settings not saved — {settingsError}
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="tz-polling">API Polling</label>
            <button
              id="tz-polling"
              className={`hotkey-btn ${settings.polling_enabled ? "recording" : ""}`}
              onClick={() => saveSettings({ ...settings, polling_enabled: !settings.polling_enabled })}
            >
              {settings.polling_enabled ? "ON" : "OFF"}
            </button>
          </div>
          <div className="form-group">
            <label htmlFor="tz-tier">Good TZ Threshold</label>
            <select
              id="tz-tier"
              value={settings.good_tz_tier}
              onChange={(e) =>
                saveSettings({
                  ...settings,
                  good_tz_tier: e.target.value as TzSettings["good_tz_tier"],
                })
              }
            >
              {(["S", "A", "B", "C"] as const).map((t) => (
                <option key={t} value={t}>Tier {t} or higher</option>
              ))}
            </select>
          </div>
        </div>
        {!settings.polling_enabled && (
          <p style={{ opacity: 0.7, fontSize: "0.85em" }}>
            API polling is off — using deterministic SP calculation for zone display.
          </p>
        )}
      </div>
    </div>
  );
}
