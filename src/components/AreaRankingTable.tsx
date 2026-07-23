import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DetailedRun, XpEntry } from "../types";
import { computeAreaRankings, type RankingSortKey } from "../advisor/advisor-engine";
import { formatNumber } from "../i18n/formatters";

interface Props {
  readonly detailedRuns: DetailedRun[];
  readonly xpEntries: XpEntry[];
}

export default function AreaRankingTable({ detailedRuns, xpEntries }: Props) {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<RankingSortKey>("valuePointsPerHour");

  const rankings = useMemo(
    () => computeAreaRankings(detailedRuns, xpEntries, sortBy),
    [detailedRuns, xpEntries, sortBy]
  );

  const handleSort = (key: RankingSortKey) => {
    setSortBy(key);
  };

  const handleKeyDown = (key: RankingSortKey, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSort(key);
    }
  };

  if (rankings.length === 0) {
    return (
      <div className="advisor-section">
        <h3>{t("advisor.areaRankings.heading")}</h3>
        <p className="empty-state-sm">{t("advisor.areaRankings.empty")}</p>
      </div>
    );
  }

  return (
    <div className="advisor-section">
      <h3>{t("advisor.areaRankings.heading")}</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>{t("advisor.areaRankings.area")}</th>
            <th
              aria-sort={sortBy === "itemsPerHour" ? "descending" : "none"}
              className={sortBy === "itemsPerHour" ? "sort-active" : ""}
            >
              <button
                type="button"
                className="sort-btn"
                onClick={() => handleSort("itemsPerHour")}
                onKeyDown={(e) => handleKeyDown("itemsPerHour", e)}
              >
                {t("advisor.areaRankings.itemsPerHour")}
              </button>
            </th>
            <th
              aria-sort={sortBy === "valuePointsPerHour" ? "descending" : "none"}
              className={sortBy === "valuePointsPerHour" ? "sort-active" : ""}
            >
              <button
                type="button"
                className="sort-btn"
                onClick={() => handleSort("valuePointsPerHour")}
                onKeyDown={(e) => handleKeyDown("valuePointsPerHour", e)}
              >
                {t("advisor.areaRankings.valuePerHour")}
              </button>
            </th>
            <th
              aria-sort={sortBy === "xpPerHour" ? "descending" : "none"}
              className={sortBy === "xpPerHour" ? "sort-active" : ""}
            >
              <button
                type="button"
                className="sort-btn"
                onClick={() => handleSort("xpPerHour")}
                onKeyDown={(e) => handleKeyDown("xpPerHour", e)}
              >
                {t("advisor.areaRankings.xpPerHour")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((area) => (
            <tr key={area.area}>
              <td>{area.area}</td>
              <td>{formatNumber(area.itemsPerHour, { maximumFractionDigits: 1 })}</td>
              <td>{formatNumber(area.valuePointsPerHour, { maximumFractionDigits: 1 })}</td>
              <td>{formatNumber(area.xpPerHour, { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
