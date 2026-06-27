interface QuickTagsProps {
  readonly activeTags: string[];
  readonly onToggle: (tag: string) => void;
}

export const PREDEFINED_TAGS = [
  { label: "🔥 GG", value: "gg" },
  { label: "💀 Death", value: "death" },
  { label: "⚡ Fast", value: "fast" },
  { label: "🐢 Slow", value: "slow" },
  { label: "🎯 Target", value: "target" },
  { label: "🗺️ Good Map", value: "good-map" },
  { label: "💩 Bad Map", value: "bad-map" },
];

export default function QuickTags({ activeTags, onToggle }: QuickTagsProps) {
  return (
    <div className="quick-tags">
      <span className="quick-tags-label">Tags:</span>
      <div className="quick-tags-row">
        {PREDEFINED_TAGS.map((tag) => (
          <button
            key={tag.value}
            className={`quick-tag-btn ${activeTags.includes(tag.value) ? "active" : ""}`}
            onClick={() => onToggle(tag.value)}
            type="button"
            aria-pressed={activeTags.includes(tag.value)}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
