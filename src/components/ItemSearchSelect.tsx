import { useState, useRef, useEffect, useCallback, useId } from "react";
import "./ItemSearchSelect.css";

export interface ItemSearchSelectProps {
  readonly items: ReadonlyArray<{ id: string; name: string; rarity: string }>;
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly label?: string;
}

const RARITY_FILTERS = ["All", "Unique", "Set", "Rune", "Key"] as const;
type RarityFilter = (typeof RARITY_FILTERS)[number];

export default function ItemSearchSelect({
  items,
  selectedId,
  onSelect,
  label = "Select item",
}: ItemSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const filtered = items.filter((item) => {
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesRarity = rarityFilter === "All" || item.rarity === rarityFilter;
    return matchesQuery && matchesRarity;
  });

  const selectedItem = items.find((item) => item.id === selectedId);

  // Reset highlight when filter/query changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [query, rarityFilter]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && highlightIndex >= 0) {
      const highlighted = listRef.current.children[highlightIndex] as HTMLElement;
      if (highlighted?.scrollIntoView) {
        highlighted.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      setIsOpen(false);
      setQuery("");
      setHighlightIndex(-1);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightIndex(0);
      } else {
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex].id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const highlightedOptionId =
    highlightIndex >= 0 && filtered[highlightIndex]
      ? `${listboxId}-option-${highlightIndex}`
      : undefined;

  return (
    <div className="item-search-select" ref={containerRef}>
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-owns={listboxId}
      >
        <input
          ref={inputRef}
          type="text"
          className="item-search-select-input"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedItem ? selectedItem.name : label}
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={highlightedOptionId}
        />
      </div>

      <div
        className="item-search-select-filters"
        role="radiogroup"
        aria-label="Filter by rarity"
      >
        {RARITY_FILTERS.map((rf) => (
          <button
            key={rf}
            type="button"
            aria-pressed={rarityFilter === rf}
            onClick={() => {
              setRarityFilter(rf);
              if (!isOpen) setIsOpen(true);
              inputRef.current?.focus();
            }}
          >
            {rf}
          </button>
        ))}
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          ref={listRef}
          className="item-search-select-dropdown"
          role="listbox"
          aria-label={label}
        >
          {filtered.length === 0 ? (
            <li className="item-search-select-empty" role="option" aria-selected={false}>
              No items found
            </li>
          ) : (
            filtered.map((item, idx) => (
              <li
                key={item.id}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={item.id === selectedId}
                className={`item-search-select-option${idx === highlightIndex ? " highlighted" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item.id);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
              >
                <span>{item.name}</span>
                <span className="item-search-select-option-rarity">{item.rarity}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
