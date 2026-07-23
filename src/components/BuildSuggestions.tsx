import { useTranslation } from "react-i18next";
import type { BuildSuggestion } from "../advisor/advisor-engine";

interface Props {
  readonly suggestions: BuildSuggestion[];
}

export default function BuildSuggestions({ suggestions }: Props) {
  const { t } = useTranslation();

  if (suggestions.length === 0) {
    return (
      <div className="build-suggestions">
        <h3 className="build-suggestions-heading">
          {t("advisor.buildSuggestions.heading")}
        </h3>
        <p className="build-suggestions-empty">
          {t("advisor.buildSuggestions.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="build-suggestions">
      <h3 className="build-suggestions-heading">
        {t("advisor.buildSuggestions.heading")}
      </h3>
      <ul className="build-suggestions-list">
        {suggestions.map((suggestion) => (
          <li key={suggestion.area} className="build-suggestion-item">
            <span className="build-suggestion-area">{suggestion.area}</span>
            {suggestion.annotation && (
              <span className="build-suggestion-badge">
                {t("advisor.buildSuggestions.noColdImmunes")}
              </span>
            )}
            {suggestion.tzNote && (
              <span className="build-suggestion-tz-note">
                <span className="build-suggestion-tz-label">
                  {t("advisor.buildSuggestions.tzNotes")}:
                </span>{" "}
                {suggestion.tzNote}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
