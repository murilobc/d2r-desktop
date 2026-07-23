import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, DetailedRun, XpEntry } from "../types";
import { getStatsCombined, getXpEntries } from "../api";
import { Skeleton } from "../components/Skeleton";
import {
  computeAreaRankings,
  computeWeeklySummary,
  detectDiminishingReturns,
  computeTZRecommendation,
  computeBuildSuggestions,
} from "../advisor/advisor-engine";
import type {
  WeeklySummary,
  TZRecommendation,
  DiminishingReturnsAlert as DiminishingReturnsAlertType,
  BuildSuggestion,
} from "../advisor/advisor-engine";
import { loadCurrentTZ, TERROR_ZONES } from "../data/terror-zones";
import type { TerrorZoneInfo } from "../data/terror-zones";
import WeeklySummaryCard from "../components/WeeklySummaryCard";
import TerrorZoneRecommendation from "../components/TerrorZoneRecommendation";
import DiminishingReturnsAlert from "../components/DiminishingReturnsAlert";
import AreaRankingTable from "../components/AreaRankingTable";
import BuildSuggestions from "../components/BuildSuggestions";

interface Props {
  readonly profile: Profile;
}

export default function Advisor({ profile }: Props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailedRuns, setDetailedRuns] = useState<DetailedRun[]>([]);
  const [xpEntries, setXpEntries] = useState<XpEntry[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [tzRecommendation, setTzRecommendation] = useState<TZRecommendation | null>(null);
  const [diminishingReturns, setDiminishingReturns] = useState<DiminishingReturnsAlertType[]>([]);
  const [buildSuggestions, setBuildSuggestions] = useState<BuildSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [combinedStats, xpData] = await Promise.all([
          getStatsCombined(profile.id),
          getXpEntries(profile.id),
        ]);

        if (cancelled) return;

        const runs = combinedStats.detailed_runs;
        setDetailedRuns(runs);
        setXpEntries(xpData);

        // Compute area rankings
        const areaRankings = computeAreaRankings(runs, xpData);

        // Compute weekly summary
        const summary = computeWeeklySummary(runs);
        setWeeklySummary(summary);

        // Detect diminishing returns
        const alerts = detectDiminishingReturns(runs, areaRankings);
        setDiminishingReturns(alerts);

        // Load active Terror Zone
        const activeTZName = loadCurrentTZ();
        const activeTZ: TerrorZoneInfo | null = activeTZName
          ? TERROR_ZONES.find((tz) => tz.name === activeTZName) ?? null
          : null;

        // Compute global average valuePointsPerHour for TZ recommendation
        const globalAvg =
          areaRankings.length > 0
            ? areaRankings.reduce((sum, a) => sum + a.valuePointsPerHour, 0) / areaRankings.length
            : 0;

        // Compute TZ recommendation
        const tzRec = computeTZRecommendation(activeTZ, runs, globalAvg);
        setTzRecommendation(tzRec);

        // Compute build suggestions
        const suggestions = computeBuildSuggestions(profile, areaRankings, activeTZ);
        setBuildSuggestions(suggestions);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <Skeleton variant="text" width="200px" height="32px" />
        </div>
        <Skeleton variant="card" height="120px" />
        <Skeleton variant="card" height="100px" />
        <Skeleton variant="card" height="200px" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>{t("advisor.title")}</h1>
        </div>
        <div className="error-toast" role="alert">
          <p>{t("advisor.error")}</p>
          <p className="error-details">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t("advisor.title")}</h1>
      </div>

      <WeeklySummaryCard summary={weeklySummary} />
      <TerrorZoneRecommendation recommendation={tzRecommendation} />
      <DiminishingReturnsAlert alerts={diminishingReturns} />
      <AreaRankingTable detailedRuns={detailedRuns} xpEntries={xpEntries} />
      <BuildSuggestions suggestions={buildSuggestions} />
    </div>
  );
}
