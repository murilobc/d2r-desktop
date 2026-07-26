import { useEffect, useRef, useState, useCallback } from "react";
import type { Profile, PersonalBests, Season, ComparisonResult } from "../types";
import { getPersonalBests, createSeason, getSeasons, getComparison } from "../api";
import {
  buildCommunityExportJson,
  sanitizeFilename,
  getMonthBoundaries,
} from "./leaderboard-helpers";
import { showWarning, percentageDiff, formatPercentageDiff } from "../utils/comparison";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import html2canvas from "html2canvas";

interface Props {
  profile: Profile;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export default function Leaderboards({ profile }: Props) {
  // ─── Personal Bests ───────────────────────────────────────────────────────
  const [bests, setBests] = useState<PersonalBests | null>(null);
  const [bestsError, setBestsError] = useState<string | null>(null);
  const [bestsLoading, setBestsLoading] = useState(false);

  const loadBests = useCallback(async () => {
    setBestsLoading(true);
    setBestsError(null);
    try {
      const result = await getPersonalBests(
        profile.id,
        profile.season_start_date ?? undefined
      );
      setBests(result);
    } catch (e) {
      setBestsError(String(e));
    } finally {
      setBestsLoading(false);
    }
  }, [profile.id, profile.season_start_date]);

  // Load on mount and when profile changes, and poll every 5 seconds
  useEffect(() => {
    loadBests();
    const interval = setInterval(loadBests, 5000);
    return () => clearInterval(interval);
  }, [loadBests]);

  // ─── Monthly Comparison ───────────────────────────────────────────────────
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const loadComparison = useCallback(async () => {
    setComparisonLoading(true);
    setComparisonError(null);
    try {
      const { startA, endA, startB, endB } = getMonthBoundaries(new Date());
      const result = await getComparison({
        type: "date_range",
        profile_id: profile.id,
        start_a: startA,
        end_a: endA,
        start_b: startB,
        end_b: endB,
      });
      setComparison(result);
    } catch (e) {
      setComparisonError(String(e));
    } finally {
      setComparisonLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  // ─── Season Archive ───────────────────────────────────────────────────────
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [seasonDialogError, setSeasonDialogError] = useState<string | null>(null);
  const [creatingseason, setCreatingSeason] = useState(false);

  const loadSeasons = useCallback(async () => {
    try {
      const result = await getSeasons(profile.id);
      setSeasons(result);
    } catch (e) {
      setSeasonsError(String(e));
    }
  }, [profile.id]);

  useEffect(() => {
    loadSeasons();
  }, [loadSeasons]);

  const handleCreateSeason = async () => {
    const trimmed = seasonName.trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      setSeasonDialogError("Season name must be between 1 and 80 characters.");
      return;
    }
    setCreatingSeason(true);
    setSeasonDialogError(null);
    try {
      await createSeason(profile.id, trimmed);
      setShowSeasonDialog(false);
      setSeasonName("");
      await Promise.all([loadSeasons(), loadBests()]);
    } catch (e) {
      setSeasonDialogError(String(e));
    } finally {
      setCreatingSeason(false);
    }
  };

  // ─── Export Actions ───────────────────────────────────────────────────────
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [exportPngError, setExportPngError] = useState<string | null>(null);
  const [exportJsonError, setExportJsonError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const safeProfileName = sanitizeFilename(profile.name);

  const handleExportPng = async () => {
    setExportPngError(null);
    if (!shareCardRef.current) return;

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(shareCardRef.current, { useCORS: true });
    } catch (e) {
      setExportPngError(`Render failed: ${e}`);
      return;
    }

    const defaultName = `d2r_leaderboard_${safeProfileName}_${today}.png`;
    let filePath: string | null;
    try {
      filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });
    } catch {
      // User cancelled or dialog failed — silent abort
      return;
    }

    if (!filePath) return;

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob returned null"));
        }, "image/png");
      });
      const arrayBuffer = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(arrayBuffer));
    } catch (e) {
      setExportPngError(`File write failed: ${e}`);
    }
  };

  const handleExportJson = async () => {
    setExportJsonError(null);
    if (!bests) return;

    const activeSeason = seasons.length > 0 ? seasons[0] : null;
    const exportData = buildCommunityExportJson(profile, bests, activeSeason);
    const json = JSON.stringify(exportData, null, 2);

    const defaultName = `d2r_leaderboard_${safeProfileName}_${today}.json`;
    let filePath: string | null;
    try {
      filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "JSON File", extensions: ["json"] }],
      });
    } catch {
      // User cancelled — silent abort
      return;
    }

    if (!filePath) return;

    try {
      const encoder = new TextEncoder();
      await writeFile(filePath, encoder.encode(json));
    } catch (e) {
      setExportJsonError(`File write failed: ${e}`);
    }
  };

  // ─── Helpers for comparison deltas ───────────────────────────────────────
  function renderDelta(
    aValue: number,
    bValue: number,
    lowerIsBetter = false
  ): React.ReactNode {
    if (aValue === 0 && bValue === 0) return <span>—</span>;
    const pct = percentageDiff(aValue, bValue);
    const formatted = formatPercentageDiff(pct);
    const improved = lowerIsBetter ? (pct ?? 0) < 0 : (pct ?? 0) > 0;
    return (
      <span style={{ color: improved ? "#4caf50" : pct === 0 ? "inherit" : "#f44336" }}>
        {formatted}
      </span>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const hasAnyBests = bests &&
    (bests.fastest_run !== null ||
      bests.best_items_in_run !== null ||
      bests.best_items_per_hour !== null ||
      bests.longest_run !== null);

  return (
    <div className="page">
      {/* Share card — off-screen, captured by html2canvas */}
      <div
        ref={shareCardRef}
        role="region"
        aria-label="Share card preview"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: 600,
          padding: "24px",
          background: "#1a1a2e",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <h2 style={{ margin: "0 0 4px 0" }}>{profile.name}</h2>
        <p style={{ margin: "0 0 16px 0", opacity: 0.7 }}>
          {profile.class} · {profile.mode}
        </p>
        <h3 style={{ margin: "0 0 8px 0" }}>Personal Bests</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", paddingBottom: 4 }}>Metric</th>
              <th scope="col" style={{ textAlign: "left", paddingBottom: 4 }}>Value</th>
              <th scope="col" style={{ textAlign: "left", paddingBottom: 4 }}>Area</th>
              <th scope="col" style={{ textAlign: "left", paddingBottom: 4 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Fastest Run</td>
              <td>{bests?.fastest_run ? formatDuration(bests.fastest_run.value) : "—"}</td>
              <td>{bests?.fastest_run?.area ?? "—"}</td>
              <td>{bests?.fastest_run ? formatDate(bests.fastest_run.date) : "—"}</td>
            </tr>
            <tr>
              <td>Best Items in Run</td>
              <td>{bests?.best_items_in_run ? `${bests.best_items_in_run.item_count} items` : "—"}</td>
              <td>{bests?.best_items_in_run?.area ?? "—"}</td>
              <td>{bests?.best_items_in_run ? formatDate(bests.best_items_in_run.date) : "—"}</td>
            </tr>
            <tr>
              <td>Best Items/Hour</td>
              <td>{bests?.best_items_per_hour ? `${bests.best_items_per_hour.items_per_hour.toFixed(1)}/hr` : "—"}</td>
              <td>{bests?.best_items_per_hour?.area ?? "—"}</td>
              <td>{bests?.best_items_per_hour ? formatDate(bests.best_items_per_hour.date) : "—"}</td>
            </tr>
            <tr>
              <td>Longest Run</td>
              <td>{bests?.longest_run ? formatDuration(bests.longest_run.value) : "—"}</td>
              <td>{bests?.longest_run?.area ?? "—"}</td>
              <td>{bests?.longest_run ? formatDate(bests.longest_run.date) : "—"}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 16, opacity: 0.5, fontSize: 12 }}>Exported: {today}</p>
      </div>

      {/* ── Section 1: Personal Bests ── */}
      <div className="herald-section">
        <h2>Personal Bests</h2>
        {bestsError && (
          <div role="alert" className="error-banner">
            <span>{bestsError}</span>
            <button className="btn btn-sm" onClick={loadBests}>Retry</button>
          </div>
        )}
        {bestsLoading && !bests && <p>Loading personal bests…</p>}
        {!bestsLoading && !bestsError && !hasAnyBests && (
          <p className="empty-state">No records yet — complete some runs to see your personal bests.</p>
        )}
        {hasAnyBests && (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
                <th scope="col">Area</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fastest Run</td>
                <td>{bests!.fastest_run ? formatDuration(bests!.fastest_run.value) : "—"}</td>
                <td>{bests!.fastest_run?.area ?? "—"}</td>
                <td>{bests!.fastest_run ? formatDate(bests!.fastest_run.date) : "—"}</td>
              </tr>
              <tr>
                <td>Best Items in Run</td>
                <td>{bests!.best_items_in_run ? `${bests!.best_items_in_run.item_count} items` : "—"}</td>
                <td>{bests!.best_items_in_run?.area ?? "—"}</td>
                <td>{bests!.best_items_in_run ? formatDate(bests!.best_items_in_run.date) : "—"}</td>
              </tr>
              <tr>
                <td>Best Items/Hour</td>
                <td>{bests!.best_items_per_hour ? `${bests!.best_items_per_hour.items_per_hour.toFixed(1)}/hr` : "—"}</td>
                <td>{bests!.best_items_per_hour?.area ?? "—"}</td>
                <td>{bests!.best_items_per_hour ? formatDate(bests!.best_items_per_hour.date) : "—"}</td>
              </tr>
              <tr>
                <td>Longest Run</td>
                <td>{bests!.longest_run ? formatDuration(bests!.longest_run.value) : "—"}</td>
                <td>{bests!.longest_run?.area ?? "—"}</td>
                <td>{bests!.longest_run ? formatDate(bests!.longest_run.date) : "—"}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section 2: Monthly Comparison ── */}
      <div className="herald-section">
        <h2>Monthly Comparison</h2>
        {comparisonError && (
          <div role="alert" className="error-banner">
            <span>{comparisonError}</span>
            <button className="btn btn-sm" onClick={loadComparison}>Retry</button>
          </div>
        )}
        {comparisonLoading && !comparison && <p>Loading monthly comparison…</p>}
        {comparison && (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">
                  This Month
                  {showWarning(comparison.subject_a.total_runs) && (
                    <span title="Low sample size (fewer than 5 runs)"> ⚠</span>
                  )}
                </th>
                <th scope="col">
                  Last Month
                  {showWarning(comparison.subject_b.total_runs) && (
                    <span title="Low sample size (fewer than 5 runs)"> ⚠</span>
                  )}
                </th>
                <th scope="col">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Runs</td>
                <td>{comparison.subject_a.total_runs}</td>
                <td>{comparison.subject_b.total_runs}</td>
                <td>{renderDelta(comparison.subject_a.total_runs, comparison.subject_b.total_runs)}</td>
              </tr>
              <tr>
                <td>Items/Hour</td>
                <td>{comparison.subject_a.items_per_hour.toFixed(1)}</td>
                <td>{comparison.subject_b.items_per_hour.toFixed(1)}</td>
                <td>{renderDelta(comparison.subject_a.items_per_hour, comparison.subject_b.items_per_hour)}</td>
              </tr>
              <tr>
                <td>Items/Run</td>
                <td>{comparison.subject_a.items_per_run.toFixed(2)}</td>
                <td>{comparison.subject_b.items_per_run.toFixed(2)}</td>
                <td>{renderDelta(comparison.subject_a.items_per_run, comparison.subject_b.items_per_run)}</td>
              </tr>
              <tr>
                <td>Fastest Run</td>
                <td>{comparison.subject_a.fastest_run_secs != null ? formatDuration(comparison.subject_a.fastest_run_secs) : "—"}</td>
                <td>{comparison.subject_b.fastest_run_secs != null ? formatDuration(comparison.subject_b.fastest_run_secs) : "—"}</td>
                <td>
                  {comparison.subject_a.fastest_run_secs != null && comparison.subject_b.fastest_run_secs != null
                    ? renderDelta(comparison.subject_a.fastest_run_secs, comparison.subject_b.fastest_run_secs, true)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {!comparisonLoading && !comparisonError && comparison &&
          comparison.subject_a.total_runs === 0 && (
            <p className="empty-state">No runs this month yet.</p>
          )}
      </div>

      {/* ── Section 3: Season Archive ── */}
      <div className="herald-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Season Archive</h2>
          <button
            className="btn btn-primary"
            onClick={() => {
              setSeasonName("");
              setSeasonDialogError(null);
              setShowSeasonDialog(true);
            }}
          >
            ⊞ Start New Season
          </button>
        </div>

        {seasonsError && (
          <div role="alert" className="error-banner">{seasonsError}</div>
        )}

        {seasons.length === 0 && !seasonsError && (
          <p className="empty-state">No archived seasons yet.</p>
        )}

        {seasons.length > 0 && (
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Season</th>
                <th scope="col">Date Range</th>
                <th scope="col">Fastest Run</th>
                <th scope="col">Best Items</th>
                <th scope="col">Best Items/Hr</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{formatDate(s.start_date)} — {formatDate(s.end_date)}</td>
                  <td>{s.bests_snapshot.fastest_run ? formatDuration(s.bests_snapshot.fastest_run.value) : "—"}</td>
                  <td>{s.bests_snapshot.best_items_in_run ? `${s.bests_snapshot.best_items_in_run.item_count}` : "—"}</td>
                  <td>{s.bests_snapshot.best_items_per_hour ? `${s.bests_snapshot.best_items_per_hour.items_per_hour.toFixed(1)}/hr` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Season creation dialog */}
        {showSeasonDialog && (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Start New Season">
            <div className="modal-content">
              <h3>Start New Season</h3>
              <p>Enter a name for this season archive (e.g., "Ladder Season 7").</p>
              <input
                type="text"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                maxLength={80}
                placeholder="Season name (1–80 characters)"
                className="input-field"
                aria-label="Season name"
              />
              {seasonDialogError && (
                <div role="alert" className="error-banner" style={{ marginTop: 8 }}>
                  {seasonDialogError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateSeason}
                  disabled={creatingseason}
                  aria-label="Confirm start new season"
                >
                  {creatingseason ? "Saving…" : "Start Season"}
                </button>
                <button
                  className="btn"
                  onClick={() => setShowSeasonDialog(false)}
                  aria-label="Cancel start new season"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Export Actions ── */}
      <div className="herald-section">
        <h2>Export</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={handleExportPng}
            aria-label="Export share card as PNG"
          >
            ◫ Export Share Card (PNG)
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportJson}
            disabled={!bests}
            aria-label="Export community JSON"
          >
            ↓ Export Community JSON
          </button>
        </div>
        {exportPngError && (
          <div role="alert" className="error-banner" style={{ marginTop: 8 }}>
            {exportPngError}
          </div>
        )}
        {exportJsonError && (
          <div role="alert" className="error-banner" style={{ marginTop: 8 }}>
            {exportJsonError}
          </div>
        )}
      </div>
    </div>
  );
}
