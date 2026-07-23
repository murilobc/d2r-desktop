import { useTranslation } from "react-i18next";
import type { DiminishingReturnsAlert as DiminishingReturnsAlertType } from "../advisor/advisor-engine";

interface Props {
  readonly alerts: DiminishingReturnsAlertType[];
}

export default function DiminishingReturnsAlert({ alerts }: Props) {
  const { t } = useTranslation();

  if (alerts.length === 0) return null;

  return (
    <div className="diminishing-returns-alerts">
      {alerts.map((alert) => (
        <div
          key={alert.area}
          className="diminishing-returns-banner"
          role="alert"
        >
          <span className="diminishing-returns-icon">⚠️</span>
          <div className="diminishing-returns-text">
            <span className="diminishing-returns-warning">
              {t("advisor.diminishingReturns.warning", {
                area: alert.area,
                count: alert.consecutiveDryRuns,
              })}
            </span>
            {alert.suggestedAlternative && (
              <span className="diminishing-returns-suggestion">
                {t("advisor.diminishingReturns.suggestedAlternative", {
                  area: alert.suggestedAlternative,
                })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
