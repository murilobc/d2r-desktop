import { useTranslation } from "react-i18next";
import { formatNumber } from "../i18n/formatters";
import type { WeeklySummary } from "../advisor/advisor-engine";

interface Props {
  readonly summary: WeeklySummary | null;
}

export default function WeeklySummaryCard({ summary }: Props) {
  const { t } = useTranslation();

  if (summary === null) {
    return (
      <div className="weekly-summary-card">
        <h3>{t("advisor.weeklySummary.heading")}</h3>
        <p className="empty-state">{t("advisor.weeklySummary.empty")}</p>
      </div>
    );
  }

  return (
    <div className="weekly-summary-card">
      <h3>{t("advisor.weeklySummary.heading")}</h3>
      <div className="weekly-summary-metrics">
        <div className="weekly-summary-metric">
          <span className="metric-label">{t("advisor.weeklySummary.totalRuns")}</span>
          <span className="metric-value">{formatNumber(summary.totalRuns)}</span>
        </div>
        <div className="weekly-summary-metric">
          <span className="metric-label">{t("advisor.weeklySummary.avgItemsPerHour")}</span>
          <span className="metric-value">
            {formatNumber(summary.avgItemsPerHour, { maximumFractionDigits: 1 })}
          </span>
        </div>
        <div className="weekly-summary-metric">
          <span className="metric-label">{t("advisor.weeklySummary.totalValuePoints")}</span>
          <span className="metric-value">{formatNumber(summary.totalValuePoints)}</span>
        </div>
        {summary.bestArea && (
          <div className="weekly-summary-metric">
            <span className="metric-label">{t("advisor.weeklySummary.bestArea")}</span>
            <span className="metric-value">
              {summary.bestArea}{" "}
              <span className="metric-subtext">
                {t("advisor.weeklySummary.bestAreaAboveAvg", {
                  percentage: formatNumber(summary.bestAreaPercentageAboveAvg, {
                    maximumFractionDigits: 1,
                  }),
                })}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
