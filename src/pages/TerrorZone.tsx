import { useEffect, useState, useCallback, useRef } from "react";
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
  return `${h}:00 UTC`;
}

export default function TerrorZone({ profile }: Props) {
  const [tzInfo, setTzInfo] = useState<TerrorZoneInfo | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingZoneEntry[]>([]);
  const [countdown, setCountdown] = useState(0); // seconds until next hour
  const [settings, setSettings] = useState<TzSettings>({ polling_enabled: true, good_tz_tier: "A" });
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const lastFetchAtRef = useRef<number>(0);
  const [advisorData, setAdvisorData] = useState<{
    zoneItemsPerHour: number;
    avgItemsPerHour: number;
    runCount: number;
  } | null>(null);

  // Build upcoming zones via SP deterministic calc (hours 1-4 ahead from current)
  const buildSpUpcoming = useCallback(async (): Promise<UpcomingZoneEntry[]> => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const entries: UpcomingZoneEntry[] = [];
    for (let i = 1; i <= 4; i++) {
      const t = (Math.floor(nowSecs / 3600) + i) * 3600;
      try {
        const sp = await getSpTerrorZone(t);
        entries.push({
          zone_name: sp.zone_name,
          tier: sp.tier as "S" | "A" | "B" | "C",
          utc_start_secs: t,
        });
      } catch {
        // skip
      }
    }
    return entries;
  }, []);

  // Load initial data (cache + settings)
  const loadInitial = useCallback(async () => {
    try {
      const [s, cached] = await Promise.all([getTzSettings(), getTzCache()]);
      setSettings(s);

      if (cached) {
        setTzInfo(cached);
      } else {
        // Fall back to SP calc for current zone
        const sp = await getSpTerrorZone(Math.floor(Date.now() / 1000));
        setTzInfo(sp);
      }
      // Always populate upcoming with SP calculation on first load
      const spUpcoming = await buildSpUpcoming();
      setUpcoming(spUpcoming);
    } catch {
      // silent
    }
  }, [buildSpUpcoming]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // Countdown timer — updates every 60 seconds, detects hour boundary
  useEffect(() => {
    const updateCountdown = () => {
      const nowSecs = Math.floor(Date.now() / 1000);
      const secsUntilNextHour = 3600 - (nowSecs % 3600);
      setCountdown(secsUntilNextHour);

      // When the hour turns over, force a fresh fetch by resetting the timestamp
      if (secsUntilNextHour >= 3599) {
        lastFetchAtRef.current = 0;
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Polling — 10-minute rate limit, bypassed on hour boundary
  const doFetch = useCallback(async () => {
    const now = Date.now();
    const elapsed = now - lastFetchAtRef.current;
    const isHourBoundary = lastFetchAtRef.current === 0;

    if (!isHourBoundary && elapsed < 10 * 60 * 1000) return;

    try {
      const response = await fetchTerrorZone();
      lastFetchAtRef.current = now;

      // Determine tier from the fetched zone name
      const tier = await getSpTerrorZone(Math.floor(Date.now() / 1000))
        .then((sp) =>
          (sp.zone_name === response.current_zone ? sp.tier : "C") as "S" | "A" | "B" | "C"
        )
        .catch(() => "C" as "S" | "A" | "B" | "C");

      setTzInfo({
        zone_name: response.current_zone,
        tier,
        fetched_at: new Date().toISOString(),
      });

      // Build upcoming from API response + SP for hours 2+
      const nowSecs = Math.floor(Date.now() / 1000);
      const upcomingEntries: UpcomingZoneEntry[] = [];

      // Next hour from API
      if (response.next_zone && response.next_zone !== "Unknown") {
        const nextT = (Math.floor(nowSecs / 3600) + 1) * 3600;
        upcomingEntries.push({
          zone_name: response.next_zone,
          tier: "C",
          utc_start_secs: nextT,
        });
      }

      // Hours 2-4 from API upcoming list or SP fallback
      const apiUpcoming = response.upcoming.slice(1, 4); // skip index 0 (next_zone)
      for (let i = 0; i < 3; i++) {
        const t = (Math.floor(nowSecs / 3600) + 2 + i) * 3600;
        if (apiUpcoming[i]) {
          upcomingEntries.push({
            zone_name: apiUpcoming[i],
            tier: "C",
            utc_start_secs: t,
          });
        } else {
          try {
            const sp = await getSpTerrorZone(t);
            upcomingEntries.push({
              zone_name: sp.zone_name,
              tier: sp.tier as "S" | "A" | "B" | "C",
              utc_start_secs: t,
            });
          } catch {
            // skip
          }
        }
      }
      setUpcoming(upcomingEntries);
    } catch {
      // On error fall back to SP calc
      try {
        const sp = await getSpTerrorZone(Math.floor(Date.now() / 1000));
        setTzInfo(sp);
        const spUpcoming = await buildSpUpcoming();
        setUpcoming(spUpcoming);
      } catch {
        // silent
      }
    }
  }, [buildSpUpcoming]);

  useEffect(() => {
    if (!settings.polling_enabled) {
      // When polling is off, use SP for everything
      getSpTerrorZone(Math.floor(Date.now() / 1000))
        .then(setTzInfo)
        .catch(() => {});
      buildSpUpcoming().then(setUpcoming).catch(() => {});
      return;
    }

    doFetch();
    const timer = setInterval(doFetch, 60_000);
    return () => clearInterval(timer);
  }, [settings.polling_enabled, doFetch, buildSpUpcoming]);

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
        const avgIPH =
          combined.summary.items_per_run > 0 && combined.summary.avg_run_duration_secs > 0
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
  const isRecommended =
    advisorData &&
    advisorData.runCount >= 3 &&
    advisorData.zoneItemsPerHour >= advisorData.avgItemsPerHour * 1.1;

  return (
    <div className="page">
      <div className="page-header">
        <h1>∇ Terror Zone</h1>
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
              {tzInfo.fetched_at ? (
                <span style={{ marginLeft: 8, color: "#4ecdc4" }}>● Live</span>
              ) : (
                <span style={{ marginLeft: 8, color: "#888" }}>◌ SP Calc</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Upcoming Zones ── */}
      <div className="herald-section">
        <h2>Upcoming Zones</h2>
        {upcoming.length === 0 ? (
          <p className="empty-state">Loading upcoming zones…</p>
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col">Tier</th>
                <th scope="col">Active At (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.slice(0, 5).map((z, i) => (
                <tr key={i}>
                  <td>{z.zone_name}</td>
                  <td>
                    <TierBadge tier={z.tier} />
                  </td>
                  <td>{formatUtcTime(z.utc_start_secs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Advisor ── */}
      {tzInfo && advisorData && (
        <div className="herald-section">
          <h2>Your TZ Performance</h2>
          {advisorData.runCount < 3 ? (
            <p className="empty-state">
              Less than 3 runs recorded for this zone — insufficient personal data.
              Zone tier: <TierBadge tier={tzInfo.tier} />
            </p>
          ) : (
            <div>
              <p>
                <strong>Items/hr in this zone:</strong>{" "}
                <span style={{ color: isRecommended ? "#4caf50" : "inherit" }}>
                  {advisorData.zoneItemsPerHour.toFixed(1)}
                </span>
                {" "}vs profile avg{" "}
                {advisorData.avgItemsPerHour.toFixed(1)}
                <span style={{ opacity: 0.6, fontSize: "0.85em", marginLeft: 8 }}>
                  ({advisorData.runCount} runs recorded)
                </span>
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
              onClick={() =>
                saveSettings({ ...settings, polling_enabled: !settings.polling_enabled })
              }
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
                <option key={t} value={t}>
                  Tier {t} or higher
                </option>
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
