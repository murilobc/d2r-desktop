import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile, AchievementProgress, LifetimeStats, AchievementCategory } from "../types";
import { ACHIEVEMENT_CATEGORIES } from "../types";
import { getAchievementProgress, getLifetimeStats } from "../api";

interface Props {
  readonly profile: Profile;
}

type FilterCategory = "all" | AchievementCategory;

export default function Achievements({ profile }: Props) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<AchievementProgress[]>([]);
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");

  useEffect(() => {
    loadData();
  }, [profile.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prog, stats] = await Promise.all([
        getAchievementProgress(profile.id),
        getLifetimeStats(profile.id),
      ]);
      setProgress(prog);
      setLifetimeStats(stats);
    } catch (err) {
      console.error("Failed to load achievements data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProgress = activeFilter === "all"
    ? progress
    : progress.filter((p) => p.definition.category === activeFilter);

  const filterLabels: Record<FilterCategory, string> = {
    all: t("achievements.filterAll", "All"),
    milestone: t("achievements.filterMilestone", "Milestone"),
    streak: t("achievements.filterStreak", "Streak"),
    "per-class": t("achievements.filterPerClass", "Per-Class"),
    "per-area": t("achievements.filterPerArea", "Per-Area"),
  };

  const unlockedCount = progress.filter((p) => p.unlocked).length;

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>🏆 {t("achievements.title", "Achievements")}</h1>
        </div>
        <p>{t("achievements.loading", "Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏆 {t("achievements.title", "Achievements")}</h1>
        <span className="badge">
          {profile.name} — {unlockedCount}/{progress.length}
        </span>
      </div>

      {/* Lifetime Stats Dashboard */}
      {lifetimeStats && (
        <section aria-label={t("achievements.lifetimeStats", "Lifetime Statistics")}>
          <h2 className="section-title">{t("achievements.lifetimeStats", "Lifetime Statistics")}</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{lifetimeStats.total_time_hours.toFixed(1)}h</div>
              <div className="stat-label">{t("achievements.totalHours", "Total Hours")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{lifetimeStats.total_runs.toLocaleString()}</div>
              <div className="stat-label">{t("achievements.totalRuns", "Total Runs")}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{lifetimeStats.total_items.toLocaleString()}</div>
              <div className="stat-label">{t("achievements.totalItems", "Total Items")}</div>
            </div>
          </div>

          <div className="achievements-breakdowns">
            {/* Class Breakdown */}
            {lifetimeStats.runs_by_class.length > 0 && (
              <div className="breakdown-card">
                <h3>{t("achievements.classBrkdwn", "Runs by Class")}</h3>
                <ul className="breakdown-list">
                  {lifetimeStats.runs_by_class.map((c) => (
                    <li key={c.class}>
                      <span className="breakdown-label">{c.class}</span>
                      <span className="breakdown-value">{c.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Area Breakdown */}
            {lifetimeStats.runs_by_area.length > 0 && (
              <div className="breakdown-card">
                <h3>{t("achievements.areaBrkdwn", "Runs by Area")}</h3>
                <ul className="breakdown-list">
                  {lifetimeStats.runs_by_area.map((a) => (
                    <li key={a.area}>
                      <span className="breakdown-label">{a.area}</span>
                      <span className="breakdown-value">{a.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rarity Breakdown */}
            {lifetimeStats.items_by_rarity.length > 0 && (
              <div className="breakdown-card">
                <h3>{t("achievements.rarityBrkdwn", "Items by Rarity")}</h3>
                <ul className="breakdown-list">
                  {lifetimeStats.items_by_rarity.map((r) => (
                    <li key={r.rarity}>
                      <span className="breakdown-label">{r.rarity}</span>
                      <span className="breakdown-value">{r.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Category Filter Tabs */}
      <div className="achievements-filters" role="tablist" aria-label={t("achievements.filterLabel", "Filter by category")}>
        {(["all", ...ACHIEVEMENT_CATEGORIES] as FilterCategory[]).map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={activeFilter === cat}
            aria-label={filterLabels[cat]}
            className={`achievements-filter-btn ${activeFilter === cat ? "active" : ""}`}
            onClick={() => setActiveFilter(cat)}
          >
            {filterLabels[cat]}
          </button>
        ))}
      </div>

      {/* Achievement Gallery Grid */}
      <ul className="achievements-grid" aria-label={t("achievements.gallery", "Achievement gallery")}>
        {filteredProgress.map((item) => (
          <li
            key={item.definition.id}
            className={`achievement-card ${item.unlocked ? "unlocked" : "locked"}`}
          >
            <div className="achievement-icon">{item.definition.icon}</div>
            <div className="achievement-info">
              <h3 className="achievement-name">
                {t(`achievements.names.${item.definition.name_key}`, item.definition.name_key)}
              </h3>
              <p className="achievement-desc">
                {t(`achievements.descriptions.${item.definition.description_key}`, item.definition.description_key)}
              </p>

              {item.unlocked && item.unlocked_at && (
                <p className="achievement-unlock-date">
                  ✓ {t("achievements.unlockedOn", "Unlocked:")}{" "}
                  {new Date(item.unlocked_at).toLocaleDateString()}
                </p>
              )}

              {!item.unlocked && (
                <div className="achievement-progress">
                  <div
                    className="progress-bar"
                    role="progressbar"
                    aria-valuenow={item.current_value}
                    aria-valuemin={0}
                    aria-valuemax={item.definition.threshold}
                    aria-label={`${item.current_value} / ${item.definition.threshold}`}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min((item.current_value / item.definition.threshold) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="progress-text">
                    {item.current_value.toLocaleString()} / {item.definition.threshold.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}

        {filteredProgress.length === 0 && (
          <li className="empty-state">{t("achievements.noAchievements", "No achievements in this category.")}</li>
        )}
      </ul>
    </div>
  );
}
