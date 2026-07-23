import { useTranslation } from "react-i18next";
import { formatNumber } from "../i18n/formatters";
import { getTierClass } from "../data/terror-zones";
import type { TZRecommendation } from "../advisor/advisor-engine";

interface Props {
  readonly recommendation: TZRecommendation | null;
}

export default function TerrorZoneRecommendation({ recommendation }: Props) {
  const { t } = useTranslation();

  // Hide section entirely when no active TZ
  if (recommendation === null) return null;

  return (
    <div className="tz-recommendation">
      <h3>{t("advisor.terrorZone.heading")}</h3>
      <div className="tz-recommendation-content">
        <span className={`tz-tier-badge ${getTierClass(recommendation.tier)}`}>
          {recommendation.tier}
        </span>
        {!recommendation.hasPersonalData && (
          <p className="tz-tier-only">
            {t("advisor.terrorZone.tierOnly", {
              zone: recommendation.zoneName,
              tier: recommendation.tier,
            })}
          </p>
        )}
        {recommendation.hasPersonalData && (
          <p className={recommendation.isRecommended ? "tz-recommended" : "tz-not-recommended"}>
            {t("advisor.terrorZone.recommended", {
              zone: recommendation.zoneName,
              percentage: formatNumber(recommendation.percentageAdvantage ?? 0, {
                maximumFractionDigits: 1,
              }),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
