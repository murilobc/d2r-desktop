import { useState, useCallback } from "react";
import type { DetectionResult, MatchCandidate } from "../types";

interface ConfirmationDialogProps {
  readonly result: DetectionResult;
  readonly onConfirm: (item: MatchCandidate) => void;
  readonly onDismiss: () => void;
  readonly onChange: (rawText: string) => void;
}

export default function ConfirmationDialog({
  result,
  onConfirm,
  onDismiss,
  onChange,
}: ConfirmationDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const candidates = result.candidates;
  const topMatch = result.top_match;

  const selectedItem: MatchCandidate | null =
    result.is_auto_suggested && topMatch
      ? topMatch
      : candidates[selectedIndex] ?? topMatch;

  const handleConfirm = useCallback(() => {
    if (selectedItem) {
      onConfirm(selectedItem);
    }
  }, [selectedItem, onConfirm]);

  const handleChange = useCallback(() => {
    onChange(result.raw_text);
  }, [onChange, result.raw_text]);

  const handleKeyDown = useCallback(
    (action: () => void) => (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        action();
      }
    },
    []
  );

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case "Unique":
        return "var(--unique)";
      case "Set":
        return "var(--set)";
      case "Runeword":
        return "var(--runeword)";
      case "Rune":
        return "#ff8c00";
      default:
        return "var(--text)";
    }
  };

  return (
    <div className="confirmation-dialog" role="dialog" aria-label="Item detection result">
      <div className="confirmation-dialog-header">
        <span className="confirmation-dialog-title">Item Detected</span>
        {result.is_auto_suggested && (
          <span className="confirmation-dialog-auto-badge">Auto-detected</span>
        )}
      </div>

      <div className="confirmation-dialog-body">
        {topMatch && (
          <div className="confirmation-dialog-item">
            <span
              className="confirmation-dialog-item-name"
              style={{ color: getCategoryColor(topMatch.category) }}
            >
              {topMatch.item_name}
            </span>
            <span className="confirmation-dialog-item-category">
              {topMatch.category}
              {topMatch.subcategory && topMatch.subcategory !== topMatch.category
                ? ` · ${topMatch.subcategory}`
                : ""}
            </span>
            <span className="confirmation-dialog-item-confidence">
              {topMatch.confidence}% confidence
            </span>
          </div>
        )}

        {!result.is_auto_suggested && candidates.length > 1 && (
          <div className="confirmation-dialog-candidates">
            <label
              htmlFor="candidate-select"
              className="confirmation-dialog-candidates-label"
            >
              Select match:
            </label>
            <select
              id="candidate-select"
              className="confirmation-dialog-select"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
            >
              {candidates.slice(0, 5).map((candidate, idx) => (
                <option key={`${candidate.item_name}-${idx}`} value={idx}>
                  {candidate.item_name} ({candidate.category}) — {candidate.confidence}%
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="confirmation-dialog-actions">
        <button
          className="btn btn-primary confirmation-dialog-btn"
          role="button"
          tabIndex={0}
          onClick={handleConfirm}
          onKeyDown={handleKeyDown(handleConfirm)}
          disabled={!selectedItem}
        >
          Confirm
        </button>
        <button
          className="btn confirmation-dialog-btn confirmation-dialog-btn-change"
          role="button"
          tabIndex={0}
          onClick={handleChange}
          onKeyDown={handleKeyDown(handleChange)}
        >
          Change
        </button>
        <button
          className="btn confirmation-dialog-btn confirmation-dialog-btn-dismiss"
          role="button"
          tabIndex={0}
          onClick={onDismiss}
          onKeyDown={handleKeyDown(onDismiss)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
