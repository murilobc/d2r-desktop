import type { TerrorZoneInfo } from "../types";

interface Props {
  tzInfo: TerrorZoneInfo | null;
  isGoodTz: boolean;
  onApply: (zoneName: string) => void;
}

export default function TzSuggestionBanner({ tzInfo, isGoodTz, onApply }: Props) {
  if (!tzInfo) return null;

  return (
    <div
      className="tz-suggestion-banner"
      role="button"
      tabIndex={0}
      onClick={() => onApply(tzInfo.zone_name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onApply(tzInfo.zone_name);
        }
      }}
      aria-label={`Use active Terror Zone: ${tzInfo.zone_name}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.4rem 0.75rem",
        background: "rgba(78, 205, 196, 0.12)",
        border: "1px solid rgba(78, 205, 196, 0.3)",
        borderRadius: 4,
        marginBottom: "0.5rem",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: "0.8em", opacity: 0.7 }}>Active TZ:</span>
      <span style={{ fontWeight: 600, fontSize: "0.9em" }}>{tzInfo.zone_name}</span>
      <span
        style={{
          fontSize: "0.72em",
          padding: "1px 5px",
          borderRadius: 3,
          background:
            tzInfo.tier === "S"
              ? "#e94560"
              : tzInfo.tier === "A"
              ? "#ff8c00"
              : tzInfo.tier === "B"
              ? "#4ecdc4"
              : "#666",
          color: "#fff",
        }}
      >
        {tzInfo.tier}
      </span>
      {isGoodTz && (
        <span
          title="This zone is in your top farming areas"
          style={{ fontSize: "0.85em", color: "#ffd700" }}
        >
          ⭐ Good TZ
        </span>
      )}
      <span style={{ marginLeft: "auto", fontSize: "0.75em", opacity: 0.6 }}>
        Click to use
      </span>
    </div>
  );
}
