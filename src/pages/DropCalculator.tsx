import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AREA_DATA, getTC85Areas } from "../data/areas";
import type { AreaInfo } from "../data/areas";
import { calculateDropProbability, calculateCumulativeDistribution, getAreaRunStats, calculateLuckPercentile } from "../api";
import type { DropProbabilityResult, DistributionPoint, AreaRunStats, LuckPercentileResult } from "../api";
import type { Profile } from "../types";
import { formatNumber } from "../i18n/formatters";
import {
  LineChart, Line, AreaChart, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface DropCalculatorProps {
  readonly profile?: Profile | null;
}

export default function DropCalculator({ profile }: DropCalculatorProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"areas" | "probability" | "comparison">("areas");
  const [selectedArea, setSelectedArea] = useState<AreaInfo | null>(null);
  const [filter, setFilter] = useState<"all" | "tc85" | "boss">("all");

  const filteredAreas = AREA_DATA.filter((a) => {
    if (filter === "tc85") return a.canDropAll;
    if (filter === "boss") return a.monsterTypes.includes("Super Unique Boss");
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('drops.title')}</h1>
        <div className="dc-tabs">
          <button className={`btn btn-sm ${tab === "areas" ? "btn-primary" : ""}`} onClick={() => setTab("areas")}>{t('drops.areas')}</button>
          <button className={`btn btn-sm ${tab === "probability" ? "btn-primary" : ""}`} onClick={() => setTab("probability")}>{t('drops.probability')}</button>
          <button className={`btn btn-sm ${tab === "comparison" ? "btn-primary" : ""}`} onClick={() => setTab("comparison")}>{t('drops.comparison')}</button>
        </div>
      </div>

      {tab === "areas" && (
        <AreaTab
          filteredAreas={filteredAreas}
          selectedArea={selectedArea}
          setSelectedArea={setSelectedArea}
          filter={filter}
          setFilter={setFilter}
        />
      )}

      {tab === "probability" && <ProbabilityTab profileId={profile?.id ?? null} />}

      {tab === "comparison" && <ComparisonTab profileId={profile?.id ?? null} />}
    </div>
  );
}

// ===== Monster/Item Data for Dropdowns =====
const MONSTERS = [
  { id: "mephisto", name: "Mephisto", act: 3 },
  { id: "baal", name: "Baal", act: 5 },
  { id: "andariel", name: "Andariel", act: 1 },
] as const;

const ITEMS = [
  { id: "tyrael's_might", name: "Tyrael's Might", rarity: "Unique" },
  { id: "harlequin_crest", name: "Shako", rarity: "Unique" },
  { id: "ber_rune", name: "Ber Rune", rarity: "Rune" },
  { id: "stone_of_jordan", name: "Stone of Jordan", rarity: "Unique" },
  { id: "oculus", name: "The Oculus", rarity: "Unique" },
  { id: "arachnid_mesh", name: "Arachnid Mesh", rarity: "Unique" },
  { id: "vampire_gaze", name: "Vampire Gaze", rarity: "Unique" },
] as const;

// ===== RUN ESTIMATE SECTION =====
function RunEstimate({
  result,
  monsterId,
  profileId,
}: {
  readonly result: DropProbabilityResult;
  readonly monsterId: string;
  readonly profileId: string | null;
}) {
  const { t } = useTranslation();
  const [areaStats, setAreaStats] = useState<AreaRunStats | null>(null);

  useEffect(() => {
    const area = MONSTER_AREA_MAP[monsterId];
    if (!profileId || !area) {
      setAreaStats(null);
      return;
    }
    getAreaRunStats(profileId, area)
      .then(setAreaStats)
      .catch(() => setAreaStats(null));
  }, [monsterId, profileId]);

  if (!profileId) return null;

  if (!areaStats || areaStats.total_runs === 0) {
    return (
      <div className="dc-run-estimate dc-empty">
        <p>{t('drops.noRunDataForEstimate')}</p>
      </div>
    );
  }

  // Assume 1 kill per run (bosses are killed once per run)
  const runsToFind = result.kills_for_63;
  const estimatedSeconds = runsToFind * areaStats.avg_duration_secs;
  const hours = Math.floor(estimatedSeconds / 3600);
  const minutes = Math.floor((estimatedSeconds % 3600) / 60);

  return (
    <div className="dc-run-estimate">
      <h3>{t('drops.runEstimateTitle')}</h3>
      <div className="dc-estimate-row">
        <span>{t('drops.estimatedRuns')}:</span>
        <strong>{formatNumber(runsToFind)}</strong>
      </div>
      <div className="dc-estimate-row">
        <span>{t('drops.estimatedTime')}:</span>
        <strong>{hours}h {minutes}m</strong>
      </div>
      <div className="dc-estimate-row dc-estimate-meta">
        <span>{t('drops.avgRunDuration')}:</span>
        <span>{areaStats.avg_duration_secs.toFixed(0)}s ({areaStats.total_runs} runs)</span>
      </div>
    </div>
  );
}

// ===== PROBABILITY TAB =====
function ProbabilityTab({ profileId }: { readonly profileId: string | null }) {
  const { t } = useTranslation();
  const [monsterId, setMonsterId] = useState("baal");
  const [itemId, setItemId] = useState("harlequin_crest");
  const [magicFind, setMagicFind] = useState(300);
  const [playerCount, setPlayerCount] = useState(1);
  const [questBonus, setQuestBonus] = useState(false);
  const [terrorZone, setTerrorZone] = useState(false);
  const [heraldTier, setHeraldTier] = useState<number | null>(null);
  const [result, setResult] = useState<DropProbabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mfError, setMfError] = useState<string | null>(null);

  useEffect(() => {
    if (magicFind < 0 || magicFind > 9999) {
      setMfError(t("drops.mfError"));
      return;
    }
    setMfError(null);

    calculateDropProbability({
      monster_id: monsterId,
      item_id: itemId,
      magic_find: magicFind,
      player_count: playerCount,
      quest_bonus: questBonus,
      terror_zone: terrorZone,
      herald_tier: heraldTier,
    })
      .then((r) => {
        setResult(r);
        setError(null);
      })
      .catch((e) => {
        setError(String(e));
        setResult(null);
      });
  }, [monsterId, itemId, magicFind, playerCount, questBonus, terrorZone, heraldTier, t]);

  return (
    <div className="dc-probability">
      <div className="dc-config-panel">
        <div className="dc-config-row">
          <div className="dc-config-item">
            <label htmlFor="dc-monster-select">{t("drops.monster")}</label>
            <select
              id="dc-monster-select"
              value={monsterId}
              onChange={(e) => setMonsterId(e.target.value)}
            >
              {MONSTERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({t("drops.actLabel", { act: m.act })})
                </option>
              ))}
            </select>
          </div>

          <div className="dc-config-item">
            <label htmlFor="dc-item-select">{t("drops.item")}</label>
            <select
              id="dc-item-select"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              {ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.rarity})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dc-config-row">
          <div className="dc-config-item">
            <label htmlFor="dc-mf-input">{t("drops.magicFind")}</label>
            <input
              id="dc-mf-input"
              type="number"
              min={0}
              max={9999}
              value={magicFind}
              onChange={(e) => setMagicFind(Number(e.target.value))}
              aria-invalid={mfError ? "true" : undefined}
              aria-describedby={mfError ? "dc-mf-error" : undefined}
            />
          </div>

          <div className="dc-config-item">
            <label htmlFor="dc-player-select">{t("drops.playerCount")}</label>
            <select
              id="dc-player-select"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dc-config-row">
          <div className="dc-config-item">
            <label htmlFor="dc-quest-toggle">{t("drops.questBonus")}</label>
            <input
              id="dc-quest-toggle"
              type="checkbox"
              checked={questBonus}
              onChange={(e) => setQuestBonus(e.target.checked)}
            />
          </div>

          <div className="dc-config-item">
            <label htmlFor="dc-tz-toggle">{t("drops.terrorZone")}</label>
            <input
              id="dc-tz-toggle"
              type="checkbox"
              checked={terrorZone}
              onChange={(e) => setTerrorZone(e.target.checked)}
            />
          </div>

          <div className="dc-config-item">
            <label htmlFor="dc-herald-select">{t("drops.heraldTier")}</label>
            <select
              id="dc-herald-select"
              value={heraldTier ?? ""}
              onChange={(e) =>
                setHeraldTier(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">{t("drops.heraldNone")}</option>
              {[1, 2, 3, 4, 5].map((tier) => (
                <option key={tier} value={tier}>
                  {t("drops.tierLabel", { tier })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {mfError && (
        <div className="dc-error" id="dc-mf-error" role="alert">
          {mfError}
        </div>
      )}
      {error && (
        <div className="dc-error" role="alert">
          {error}
        </div>
      )}

      {result && result.probability === 0 && (
        <div className="dc-error">{t("drops.itemCannotDrop")}</div>
      )}

      {result && result.probability > 0 && (
        <div className="dc-result">
          <div className="dc-result-main">
            <span className="dc-result-label">{t("drops.dropChance")}</span>
            <span className="dc-result-value">
              {t("drops.oneInX", {
                value: formatNumber(result.one_in_x, {
                  maximumFractionDigits: 1,
                }),
              })}
            </span>
          </div>
          <div className="dc-result-details">
            <div>
              50%: {formatNumber(result.kills_for_50)} {t("drops.killsFor")}
            </div>
            <div>
              63%: {formatNumber(result.kills_for_63)} {t("drops.killsFor")}
            </div>
            <div>
              90%: {formatNumber(result.kills_for_90)} {t("drops.killsFor")}
            </div>
            <div>
              99%: {formatNumber(result.kills_for_99)} {t("drops.killsFor")}
            </div>
          </div>
          {result.mf_applied && (
            <div className="dc-mf-info">
              {t("drops.effectiveMf")}: {result.effective_mf.toFixed(1)}%
            </div>
          )}
          {!result.mf_applied && (
            <div className="dc-mf-info">{t("drops.mfNotApplied")}</div>
          )}
        </div>
      )}

      {result && result.probability > 0 && (
        <DistributionChart
          probability={result.probability}
          killThresholds={result}
        />
      )}

      {result && result.probability > 0 && (
        <RunEstimate result={result} monsterId={monsterId} profileId={profileId} />
      )}
    </div>
  );
}

// ===== DISTRIBUTION CHART =====
function DistributionChart({ probability, killThresholds }: {
  readonly probability: number;
  readonly killThresholds: { kills_for_50: number; kills_for_63: number; kills_for_90: number; kills_for_99: number };
}) {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState<DistributionPoint[]>([]);

  useEffect(() => {
    if (probability <= 0 || probability >= 1) return;
    const maxKills = Math.ceil(killThresholds.kills_for_99 * 1.2);
    const step = Math.max(1, Math.floor(maxKills / 100));
    calculateCumulativeDistribution(probability, maxKills, step)
      .then(setChartData)
      .catch(console.error);
  }, [probability, killThresholds]);

  if (chartData.length === 0) return null;

  return (
    <div className="dc-chart-container">
      <h3>{t('drops.distributionTitle')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
          <XAxis
            dataKey="kills"
            stroke="#a0a0a0"
            fontSize={12}
            label={{ value: t('drops.chartKills'), position: 'bottom', offset: -5 }}
          />
          <YAxis
            stroke="#a0a0a0"
            fontSize={12}
            domain={[0, 1]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: t('drops.chartProbability'), angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{ background: '#16213e', border: '1px solid #2a2a4a' }}
            labelStyle={{ color: '#eaeaea' }}
            formatter={(value) => [`${(Number(value) * 100).toFixed(2)}%`, t('drops.chartProbability')]}
            labelFormatter={(label) => `${t('drops.chartKills')}: ${formatNumber(Number(label))}`}
          />
          <Area type="monotone" dataKey="cumulative_probability" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
          <ReferenceLine y={0.5} stroke="#ffd700" strokeDasharray="5 5" label="50%" />
          <ReferenceLine y={0.632} stroke="#ff8c00" strokeDasharray="5 5" label="63%" />
          <ReferenceLine y={0.9} stroke="#ff4500" strokeDasharray="5 5" label="90%" />
          <ReferenceLine y={0.99} stroke="#ff0000" strokeDasharray="5 5" label="99%" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===== Monster-to-Area mapping for historical data lookup =====
const MONSTER_AREA_MAP: Record<string, string> = {
  mephisto: "Durance of Hate Level 3",
  baal: "Worldstone Chamber",
  andariel: "Catacombs Level 4",
};

// ===== COMPARISON TAB =====
function ComparisonTab({ profileId }: { readonly profileId: string | null }) {
  const { t } = useTranslation();
  const [monsterId, setMonsterId] = useState("baal");
  const [itemId, setItemId] = useState("harlequin_crest");
  const [magicFind, setMagicFind] = useState(300);
  const [playerCount, setPlayerCount] = useState(1);
  const [areaStats, setAreaStats] = useState<AreaRunStats | null>(null);
  const [dropResult, setDropResult] = useState<DropProbabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);

    calculateDropProbability({
      monster_id: monsterId,
      item_id: itemId,
      magic_find: magicFind,
      player_count: playerCount,
      quest_bonus: false,
      terror_zone: false,
      herald_tier: null,
    })
      .then(setDropResult)
      .catch((e) => setError(String(e)));

    const area = MONSTER_AREA_MAP[monsterId];
    if (profileId && area) {
      getAreaRunStats(profileId, area)
        .then(setAreaStats)
        .catch((e) => setError(String(e)));
    } else {
      setAreaStats(null);
    }
  }, [monsterId, itemId, magicFind, playerCount, profileId]);

  const selectedItemName = ITEMS.find((i) => i.id === itemId)?.name ?? itemId;

  const chartData = useMemo(() => {
    if (!areaStats || !dropResult || areaStats.total_runs === 0) return [];
    const totalRuns = areaStats.total_runs;
    const p = dropResult.probability;
    const actualItem = areaStats.item_counts.find(
      (ic) => ic.item_name === selectedItemName
    );
    const actualCount = actualItem?.count ?? 0;

    const points: { runs: number; expected: number; actual: number }[] = [];
    const numPoints = 50;
    const step = Math.max(1, Math.floor(totalRuns / numPoints));
    for (let run = 0; run <= totalRuns; run += step) {
      points.push({
        runs: run,
        expected: Number.parseFloat((run * p).toFixed(4)),
        actual: Number.parseFloat(
          (totalRuns > 0 ? (actualCount * run) / totalRuns : 0).toFixed(4)
        ),
      });
    }
    // Ensure final point is included
    if (points[points.length - 1]?.runs !== totalRuns) {
      points.push({
        runs: totalRuns,
        expected: Number.parseFloat((totalRuns * p).toFixed(4)),
        actual: actualCount,
      });
    }
    return points;
  }, [areaStats, dropResult, selectedItemName]);

  const luckSummary = useMemo(() => {
    if (!areaStats || !dropResult || areaStats.total_runs === 0) return null;
    const totalRuns = areaStats.total_runs;
    const p = dropResult.probability;
    const actualItem = areaStats.item_counts.find(
      (ic) => ic.item_name === selectedItemName
    );
    const actualCount = actualItem?.count ?? 0;
    const expectedCount = totalRuns * p;

    const tolerance = 0.2;
    if (actualCount > expectedCount + tolerance) {
      return t("drops.luckAbove", {
        actual: actualCount,
        expected: expectedCount.toFixed(1),
        runs: totalRuns,
      });
    } else if (actualCount < expectedCount - tolerance) {
      return t("drops.luckBelow", {
        actual: actualCount,
        expected: expectedCount.toFixed(1),
        runs: totalRuns,
      });
    } else {
      return t("drops.luckAverage", {
        actual: actualCount,
        runs: totalRuns,
      });
    }
  }, [areaStats, dropResult, selectedItemName, t]);

  if (!profileId) {
    return (
      <div className="dc-empty">
        <p>{t("drops.noProfileSelected")}</p>
      </div>
    );
  }

  return (
    <div className="dc-comparison">
      <div className="dc-config-panel">
        <div className="dc-config-row">
          <div className="dc-config-item">
            <label htmlFor="dc-cmp-monster-select">{t("drops.monster")}</label>
            <select
              id="dc-cmp-monster-select"
              value={monsterId}
              onChange={(e) => setMonsterId(e.target.value)}
            >
              {MONSTERS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({t("drops.actLabel", { act: m.act })})
                </option>
              ))}
            </select>
          </div>

          <div className="dc-config-item">
            <label htmlFor="dc-cmp-item-select">{t("drops.item")}</label>
            <select
              id="dc-cmp-item-select"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              {ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.rarity})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dc-config-row">
          <div className="dc-config-item">
            <label htmlFor="dc-cmp-mf-input">{t("drops.magicFind")}</label>
            <input
              id="dc-cmp-mf-input"
              type="number"
              min={0}
              max={9999}
              value={magicFind}
              onChange={(e) => setMagicFind(Number(e.target.value))}
            />
          </div>

          <div className="dc-config-item">
            <label htmlFor="dc-cmp-player-select">{t("drops.playerCount")}</label>
            <select
              id="dc-cmp-player-select"
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="dc-error" role="alert">
          {error}
        </div>
      )}

      {areaStats?.total_runs === 0 && (
        <div className="dc-empty">
          <p>
            {t("drops.noRunData", {
              area: MONSTER_AREA_MAP[monsterId] ?? monsterId,
            })}
          </p>
        </div>
      )}

      {chartData.length > 0 && (
        <>
          <div className="dc-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                <XAxis
                  dataKey="runs"
                  stroke="#a0a0a0"
                  fontSize={12}
                  label={{ value: t("drops.chartRuns"), position: "bottom", offset: -5 }}
                />
                <YAxis
                  stroke="#a0a0a0"
                  fontSize={12}
                  label={{ value: t("drops.chartDrops"), angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  contentStyle={{ background: "#16213e", border: "1px solid #2a2a4a" }}
                  labelStyle={{ color: "#eaeaea" }}
                  labelFormatter={(label) => `${t("drops.chartRuns")}: ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="#8884d8"
                  name={t("drops.expected")}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#82ca9d"
                  name={t("drops.actual")}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {luckSummary && (
            <div className="dc-luck-summary">
              <p>{luckSummary}</p>
            </div>
          )}

          {dropResult && areaStats && areaStats.total_runs > 0 && (
            <LuckGauge
              actualDrops={areaStats.item_counts.find((ic) => ic.item_name === selectedItemName)?.count ?? 0}
              totalKills={areaStats.total_runs}
              perKillProbability={dropResult.probability}
            />
          )}
        </>
      )}
    </div>
  );
}

// ===== LUCK GAUGE =====
function LuckGauge({
  actualDrops,
  totalKills,
  perKillProbability,
}: {
  readonly actualDrops: number;
  readonly totalKills: number;
  readonly perKillProbability: number;
}) {
  const { t } = useTranslation();
  const [luckResult, setLuckResult] = useState<LuckPercentileResult | null>(null);

  useEffect(() => {
    if (totalKills === 0 || perKillProbability <= 0 || perKillProbability >= 1) {
      setLuckResult(null);
      return;
    }
    calculateLuckPercentile(actualDrops, totalKills, perKillProbability)
      .then(setLuckResult)
      .catch(() => setLuckResult(null));
  }, [actualDrops, totalKills, perKillProbability]);

  if (!luckResult) return null;

  const getColor = (percentile: number) => {
    if (percentile < 25) return "#ef4444"; // red - unlucky
    if (percentile < 75) return "#f59e0b"; // yellow - average
    return "#22c55e"; // green - lucky
  };

  const color = getColor(luckResult.percentile);
  const rotation = (luckResult.percentile / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="dc-luck-gauge">
      <h3>{t("drops.luckGaugeTitle")}</h3>
      <div className="dc-gauge-container">
        <svg viewBox="0 0 200 120" width="200" height="120" aria-label={t("drops.luckGaugeTitle")}>
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#2a2a4a"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* Colored arc based on percentile */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(luckResult.percentile / 100) * 251.2} 251.2`}
          />
          {/* Needle */}
          <line
            x1="100"
            y1="100"
            x2={100 + 60 * Math.cos((rotation * Math.PI) / 180)}
            y2={100 - 60 * Math.sin((-rotation * Math.PI) / 180)}
            stroke={color}
            strokeWidth="2"
          />
          {/* Center dot */}
          <circle cx="100" cy="100" r="4" fill={color} />
          {/* Percentile text */}
          <text x="100" y="85" textAnchor="middle" fill={color} fontSize="24" fontWeight="bold">
            {luckResult.percentile.toFixed(1)}%
          </text>
        </svg>
      </div>
      <div className="dc-gauge-details">
        <div className="dc-gauge-row">
          <span>{t("drops.expectedDrops")}:</span>
          <span>{luckResult.expected_drops.toFixed(2)}</span>
        </div>
        <div className="dc-gauge-row">
          <span>{t("drops.deviation")}:</span>
          <span style={{ color }}>
            {luckResult.deviation >= 0 ? "+" : ""}
            {luckResult.deviation.toFixed(2)}
          </span>
        </div>
        <div className="dc-gauge-row">
          <span>{t("drops.sigma")}:</span>
          <span style={{ color }}>
            {luckResult.deviation_sigma >= 0 ? "+" : ""}
            {luckResult.deviation_sigma.toFixed(2)}σ
          </span>
        </div>
      </div>
    </div>
  );
}

// ===== AREAS TAB =====
function AreaTab({ filteredAreas, selectedArea, setSelectedArea, filter, setFilter }: {
  filteredAreas: AreaInfo[];
  selectedArea: AreaInfo | null;
  setSelectedArea: (a: AreaInfo) => void;
  filter: string;
  setFilter: (f: "all" | "tc85" | "boss") => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="dc-filters">
        <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : ""}`} onClick={() => setFilter("all")}>{t('drops.all')}</button>
        <button className={`btn btn-sm ${filter === "tc85" ? "btn-primary" : ""}`} onClick={() => setFilter("tc85")}>{t('drops.tc85')}</button>
        <button className={`btn btn-sm ${filter === "boss" ? "btn-primary" : ""}`} onClick={() => setFilter("boss")}>{t('drops.boss')}</button>
      </div>

      <div className="dc-layout">
        <div className="dc-area-list">
          {filteredAreas.map((area) => (
            <div
              key={area.name}
              role="button"
              tabIndex={0}
              className={`dc-area-item ${selectedArea?.name === area.name ? "selected" : ""}`}
              onClick={() => setSelectedArea(area)}
              onKeyDown={(e) => { if (e.key === "Enter") setSelectedArea(area); }}
            >
              <span className="dc-area-name">{area.name}</span>
              <span className="dc-area-meta">
                {t('drops.actLabel', { act: area.act || '?' })} • alvl {area.alvl}
                {area.canDropAll && <span className="dc-badge-tc85">TC85+</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="dc-detail">
          {selectedArea ? (
            <>
              <div className="dc-detail-header">
                <h2>{selectedArea.name}</h2>
                {selectedArea.canDropAll && <span className="dc-badge-tc85 large">{t('drops.canDropAll')}</span>}
              </div>

              <div className="dc-info-grid">
                <div className="dc-info-card">
                  <span className="dc-info-label">{t('drops.areaLevel')}</span>
                  <span className="dc-info-value">{selectedArea.alvl}</span>
                </div>
                <div className="dc-info-card">
                  <span className="dc-info-label">{t('drops.treasureClass')}</span>
                  <span className="dc-info-value">{selectedArea.tc}</span>
                </div>
                <div className="dc-info-card">
                  <span className="dc-info-label">{t('drops.act')}</span>
                  <span className="dc-info-value">{selectedArea.act || t('drops.varies')}</span>
                </div>
              </div>

              <div className="dc-section">
                <h3>{t('drops.monsterTypes')}</h3>
                <div className="dc-tags">
                  {selectedArea.monsterTypes.map((m) => (
                    <span key={m} className="dc-tag">{m}</span>
                  ))}
                </div>
              </div>

              <div className="dc-section">
                <h3>{t('drops.notableDrops')}</h3>
                <div className="dc-drops-list">
                  {selectedArea.notableDrops.map((drop) => (
                    <div key={drop} className="dc-drop-item">{drop}</div>
                  ))}
                </div>
              </div>

              <div className="dc-section dc-tips">
                <h3>{t('drops.tips')}</h3>
                <p>{selectedArea.tips}</p>
              </div>
            </>
          ) : (
            <div className="dc-empty">
              <p>{t('drops.noSelection')}</p>
              <p className="dc-summary">
                <strong>{t('drops.tc85Summary', { count: getTC85Areas().length })}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


