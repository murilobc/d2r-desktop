import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, ComparisonRequest, ComparisonResult, SubjectMetrics, Stats } from "../types";
import { getComparison, getStats } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  percentageDiff,
  isWinner,
  showWarning,
  formatPercentageDiff,
  isSignificant,
} from "../utils/comparison";

interface Props {
  profile: Profile;
}

type ComparisonType = "area" | "date_range";

export default function Comparison({ profile }: Props) {
  const { t } = useTranslation();
  const [comparisonType, setComparisonType] = useState<ComparisonType>("area");
  const [areaA, setAreaA] = useState("");
  const [areaB, setAreaB] = useState("");
  const [startA, setStartA] = useState("");
  const [endA, setEndA] = useState("");
  const [startB, setStartB] = useState("");
  const [endB, setEndB] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    getStats(profile.id).then(setStats);
    setResult(null);
    setError(null);
  }, [profile.id]);

  const availableAreas = useMemo(() => {
    if (!stats) return [];
    return stats.runs_by_area.map((a) => a.area);
  }, [stats]);

  const canCompare = useMemo(() => {
    if (comparisonType === "area") {
      return areaA !== "" && areaB !== "";
    }
    return startA !== "" && endA !== "" && startB !== "" && endB !== "" && startA <= endA && startB <= endB;
  }, [comparisonType, areaA, areaB, startA, endA, startB, endB]);

  const handleCompare = async () => {
    setLoading(true);
    setError(null);

    try {
      let request: ComparisonRequest;
      if (comparisonType === "area") {
        request = {
          type: "area",
          profile_id: profile.id,
          area_a: areaA,
          area_b: areaB,
        };
      } else {
        request = {
          type: "date_range",
          profile_id: profile.id,
          start_a: startA,
          end_a: endA,
          start_b: startB,
          end_b: endB,
        };
      }
      const res = await getComparison(request);
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const identicalSubjects = comparisonType === "area" && areaA !== "" && areaA === areaB;

  const chartData = useMemo(() => {
    if (!result) return [];
    return [
      {
        metric: "Items/Hour",
        [result.subject_a.label]: Number(result.subject_a.items_per_hour.toFixed(1)),
        [result.subject_b.label]: Number(result.subject_b.items_per_hour.toFixed(1)),
      },
      {
        metric: "Unique/Hour",
        [result.subject_a.label]: Number(result.subject_a.unique_items_per_hour.toFixed(1)),
        [result.subject_b.label]: Number(result.subject_b.unique_items_per_hour.toFixed(1)),
      },
      {
        metric: "Avg Time (s)",
        [result.subject_a.label]: Number(result.subject_a.avg_time_per_run.toFixed(0)),
        [result.subject_b.label]: Number(result.subject_b.avg_time_per_run.toFixed(0)),
      },
    ];
  }, [result]);

  if (!stats) return <div className="page"><p>Loading...</p></div>;

  if (stats.total_runs === 0) {
    return (
      <div className="page">
        <div className="page-header"><h1>⚔️ {t('comparison.title')}</h1></div>
        <p className="empty-state">{t('comparison.noData')}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>⚔️ {t('comparison.title')}</h1>
      </div>

      {/* Comparison type toggle */}
      <div className="comparison-type-toggle">
        <button
          className={`btn ${comparisonType === "area" ? "btn-primary" : ""}`}
          onClick={() => { setComparisonType("area"); setResult(null); }}
        >
          {t('comparison.area')} vs {t('comparison.area')}
        </button>
        <button
          className={`btn ${comparisonType === "date_range" ? "btn-primary" : ""}`}
          onClick={() => { setComparisonType("date_range"); setResult(null); }}
        >
          {t('comparison.dateRange')} vs {t('comparison.dateRange')}
        </button>
      </div>

      {/* Selectors */}
      <div className="comparison-selectors">
        {comparisonType === "area" ? (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="area-a">{t('comparison.subjectA')}</label>
              <select id="area-a" value={areaA} onChange={(e) => setAreaA(e.target.value)}>
                <option value="">Select area...</option>
                {availableAreas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="area-b">{t('comparison.subjectB')}</label>
              <select id="area-b" value={areaB} onChange={(e) => setAreaB(e.target.value)}>
                <option value="">Select area...</option>
                {availableAreas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start-a">{t('comparison.startDate')} A</label>
              <input id="start-a" type="date" value={startA} onChange={(e) => setStartA(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="end-a">{t('comparison.endDate')} A</label>
              <input id="end-a" type="date" value={endA} onChange={(e) => setEndA(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="start-b">{t('comparison.startDate')} B</label>
              <input id="start-b" type="date" value={startB} onChange={(e) => setStartB(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="end-b">{t('comparison.endDate')} B</label>
              <input id="end-b" type="date" value={endB} onChange={(e) => setEndB(e.target.value)} />
            </div>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleCompare}
          disabled={!canCompare || loading}
        >
          {loading ? t('comparison.comparing') : t('comparison.compare')}
        </button>
      </div>

      {/* Notices */}
      {identicalSubjects && (
        <div className="comparison-notice">
          ⚠️ {t('comparison.warning')}
        </div>
      )}

      {error && (
        <div className="comparison-error">
          ❌ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="comparison-results">
          {/* Metric Cards */}
          <div className="comparison-cards">
            <MetricCard
              subject={result.subject_a}
              other={result.subject_b}
              side="a"
            />
            <MetricCard
              subject={result.subject_b}
              other={result.subject_a}
              side="b"
            />
          </div>

          {/* Chart */}
          {(result.subject_a.total_runs > 0 || result.subject_b.total_runs > 0) && (
            <div className="chart-card">
              <h3>Comparison Chart</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                  <XAxis dataKey="metric" stroke="#a0a0a0" fontSize={12} />
                  <YAxis stroke="#a0a0a0" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }}
                    labelStyle={{ color: "#eaeaea" }}
                  />
                  <Legend />
                  <Bar dataKey={result.subject_a.label} fill="#4ecdc4" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={result.subject_b.label} fill="#e94560" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <p className="empty-state">
          {t('comparison.noData')}
        </p>
      )}
    </div>
  );
}

// ===== MetricCard Sub-Component =====

interface MetricCardProps {
  subject: SubjectMetrics;
  other: SubjectMetrics;
  side: "a" | "b";
}

function MetricCard({ subject, other, side }: MetricCardProps) {
  const hasWarning = showWarning(subject.total_runs);

  if (subject.total_runs === 0) {
    return (
      <div className="comparison-card">
        <h3>{subject.label}</h3>
        <p className="empty-state">No data for this {subject.label.includes("—") ? "period" : "area"}.</p>
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const metrics: { label: string; value: string; rawA: number; rawB: number; higherIsBetter: boolean }[] = [
    { label: "Total Runs", value: String(subject.total_runs), rawA: side === "a" ? subject.total_runs : other.total_runs, rawB: side === "a" ? other.total_runs : subject.total_runs, higherIsBetter: true },
    { label: "Total Items", value: String(subject.total_items), rawA: side === "a" ? subject.total_items : other.total_items, rawB: side === "a" ? other.total_items : subject.total_items, higherIsBetter: true },
    { label: "Items/Hour", value: subject.items_per_hour.toFixed(1), rawA: side === "a" ? subject.items_per_hour : other.items_per_hour, rawB: side === "a" ? other.items_per_hour : subject.items_per_hour, higherIsBetter: true },
    { label: "Unique/Hour", value: subject.unique_items_per_hour.toFixed(1), rawA: side === "a" ? subject.unique_items_per_hour : other.unique_items_per_hour, rawB: side === "a" ? other.unique_items_per_hour : subject.unique_items_per_hour, higherIsBetter: true },
    { label: "Avg Time/Run", value: formatTime(subject.avg_time_per_run), rawA: side === "a" ? subject.avg_time_per_run : other.avg_time_per_run, rawB: side === "a" ? other.avg_time_per_run : subject.avg_time_per_run, higherIsBetter: false },
    { label: "Items/Run", value: subject.items_per_run.toFixed(2), rawA: side === "a" ? subject.items_per_run : other.items_per_run, rawB: side === "a" ? other.items_per_run : subject.items_per_run, higherIsBetter: true },
    { label: "Fastest", value: subject.fastest_run_secs != null ? formatTime(subject.fastest_run_secs) : "—", rawA: side === "a" ? (subject.fastest_run_secs ?? 0) : (other.fastest_run_secs ?? 0), rawB: side === "a" ? (other.fastest_run_secs ?? 0) : (subject.fastest_run_secs ?? 0), higherIsBetter: false },
    { label: "Slowest", value: subject.slowest_run_secs != null ? formatTime(subject.slowest_run_secs) : "—", rawA: side === "a" ? (subject.slowest_run_secs ?? 0) : (other.slowest_run_secs ?? 0), rawB: side === "a" ? (other.slowest_run_secs ?? 0) : (subject.slowest_run_secs ?? 0), higherIsBetter: false },
  ];

  return (
    <div className="comparison-card">
      <h3>
        {subject.label}
        {hasWarning && <span className="comparison-warning" title={`Only ${subject.total_runs} runs (min recommended: 5)`}> ⚠️ Low sample</span>}
      </h3>
      <div className="comparison-metrics">
        {metrics.map((m) => {
          const diff = percentageDiff(m.rawA, m.rawB);
          const winner = isWinner(m.rawA, m.rawB, m.higherIsBetter);
          const isThisSideWinner = winner === side;
          const significant = isSignificant(diff);

          return (
            <div
              key={m.label}
              className={`comparison-metric ${isThisSideWinner ? "winner" : ""}`}
            >
              <div className="comparison-metric-value">{m.value}</div>
              <div className="comparison-metric-label">{m.label}</div>
              {side === "a" && other.total_runs > 0 && (
                <div className={`comparison-metric-diff ${significant ? "significant" : ""}`}>
                  {formatPercentageDiff(diff)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
