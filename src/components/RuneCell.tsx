import { useState, useRef, useCallback, useEffect } from "react";
import { classifyRuneCell } from "../lib/rune-tier";
import { validateRuneCountInput } from "../lib/rune-input-validation";

export interface RuneCellProps {
  readonly runeName: string;
  readonly runeLevel: number;
  readonly count: number;
  readonly onIncrement: (runeName: string) => void;
  readonly onDecrement: (runeName: string) => void;
  readonly onSetCount: (runeName: string, value: number) => void;
  readonly onReset: (runeName: string) => void;
}

export default function RuneCell({
  runeName,
  runeLevel,
  count,
  onIncrement,
  onDecrement,
  onSetCount,
  onReset,
}: RuneCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { borderClass, countColorClass, isZero } = classifyRuneCell(runeLevel, count);

  // Select all text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const showControls = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 150);
  }, []);

  const hideControls = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  }, []);

  const handleCountClick = useCallback(() => {
    setEditValue(String(count));
    setIsEditing(true);
  }, [count]);

  const commitEdit = useCallback(() => {
    const validated = validateRuneCountInput(editValue);
    if (validated !== null) {
      onSetCount(runeName, validated);
    }
    setIsEditing(false);
  }, [editValue, onSetCount, runeName]);

  const discardEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        discardEdit();
      }
    },
    [commitEdit, discardEdit]
  );

  const handleBlur = useCallback(() => {
    commitEdit();
  }, [commitEdit]);

  const cellClasses = [
    "rune-cell",
    borderClass,
    isZero ? "rune-cell--zero" : "",
    isEditing ? "rune-cell--editing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const countClasses = ["rune-cell__count", countColorClass]
    .filter(Boolean)
    .join(" ");

  const overlayClasses = [
    "rune-cell__controls-overlay",
    isHovered ? "rune-cell__controls-overlay--visible" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cellClasses}
      onMouseEnter={showControls}
      onMouseLeave={hideControls}
      onFocus={showControls}
      onBlur={hideControls}
    >
      <span className="rune-cell__name">{runeName}</span>

      {isEditing ? (
        <input
          ref={inputRef}
          className="rune-cell__input"
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={2}
          aria-label={`Count for ${runeName}`}
        />
      ) : (
        <span
          className={countClasses}
          onClick={handleCountClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleCountClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${runeName} count ${count}, click to edit`}
        >
          {count}
        </span>
      )}

      <div className={overlayClasses} aria-hidden={!isHovered}>
        <button
          className="rune-cell__btn rune-cell__btn--increment"
          onClick={() => onIncrement(runeName)}
          aria-label={`Increment ${runeName}`}
          type="button"
          tabIndex={isHovered ? 0 : -1}
        >
          +
        </button>
        <button
          className="rune-cell__btn rune-cell__btn--decrement"
          onClick={() => onDecrement(runeName)}
          disabled={isZero}
          aria-label={`Decrement ${runeName}`}
          type="button"
          tabIndex={isHovered ? 0 : -1}
        >
          −
        </button>
        {!isZero && (
          <button
            className="rune-cell__btn rune-cell__btn--reset"
            onClick={() => onReset(runeName)}
            aria-label={`Reset ${runeName}`}
            type="button"
            tabIndex={isHovered ? 0 : -1}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
