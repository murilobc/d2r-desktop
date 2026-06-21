import { useState, useRef, useEffect } from "react";
import { ALL_ITEMS, ITEM_CATEGORIES } from "../data/items";
import type { GameItem } from "../data/items";

interface Props {
  onSelect: (item: GameItem) => void;
  placeholder?: string;
}

export default function ItemSearch({ onSelect, placeholder = "Buscar item..." }: Props) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = ALL_ITEMS.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    return matchesQuery && matchesCategory;
  }).slice(0, 50); // Limit display for performance

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, categoryFilter]);

  useEffect(() => {
    if (listRef.current && highlightIndex >= 0) {
      const highlighted = listRef.current.children[highlightIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (item: GameItem) => {
    onSelect(item);
    setQuery("");
    setIsOpen(false);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Unique": return "var(--unique)";
      case "Set": return "var(--set)";
      case "Runeword": return "var(--runeword)";
      case "Rune": return "#ff8c00";
      case "Charm": return "var(--magic)";
      case "Jewel": return "#ff69b4";
      case "Base": return "var(--text-muted)";
      default: return "var(--text)";
    }
  };

  return (
    <div className="item-search">
      <div className="item-search-input-row">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="item-search-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="item-search-category"
        >
          {ITEM_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {isOpen && query.length > 0 && (
        <div className="item-search-dropdown" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="item-search-empty">Nenhum item encontrado</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className={`item-search-option ${idx === highlightIndex ? "highlighted" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span className="item-search-name" style={{ color: getCategoryColor(item.category) }}>
                  {item.name}
                </span>
                <span className="item-search-tag">{item.category}</span>
              </div>
            ))
          )}
          {filtered.length === 50 && (
            <div className="item-search-more">Digite mais para refinar...</div>
          )}
        </div>
      )}
    </div>
  );
}
