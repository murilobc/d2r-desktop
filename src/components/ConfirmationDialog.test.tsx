import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmationDialog from "./ConfirmationDialog";
import type { DetectionResult, MatchCandidate } from "../types";

const mockTopMatch: MatchCandidate = {
  item_name: "Harlequin Crest",
  category: "Unique",
  subcategory: "Shako",
  confidence: 92,
};

const mockCandidates: MatchCandidate[] = [
  { item_name: "Harlequin Crest", category: "Unique", subcategory: "Shako", confidence: 72 },
  { item_name: "Herald of Zakarum", category: "Unique", subcategory: "Shield", confidence: 65 },
  { item_name: "Halaberd's Reign", category: "Set", subcategory: "Helm", confidence: 58 },
];

function makeResult(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    top_match: mockTopMatch,
    candidates: [mockTopMatch],
    raw_text: "Harlequin Crest",
    is_auto_suggested: true,
    detected_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ConfirmationDialog", () => {
  it("renders item name, category, and confidence", () => {
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Harlequin Crest")).toBeInTheDocument();
    expect(screen.getByText(/Unique/)).toBeInTheDocument();
    expect(screen.getByText("92% confidence")).toBeInTheDocument();
  });

  it("shows Auto-detected badge when is_auto_suggested is true", () => {
    render(
      <ConfirmationDialog
        result={makeResult({ is_auto_suggested: true })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Auto-detected")).toBeInTheDocument();
  });

  it("does not show Auto-detected badge when is_auto_suggested is false", () => {
    render(
      <ConfirmationDialog
        result={makeResult({ is_auto_suggested: false, candidates: mockCandidates })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByText("Auto-detected")).not.toBeInTheDocument();
  });

  it("shows dropdown of candidates when not auto-suggested and multiple candidates", () => {
    render(
      <ConfirmationDialog
        result={makeResult({ is_auto_suggested: false, candidates: mockCandidates })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText("Select match:");
    expect(select).toBeInTheDocument();
    expect(select).toHaveDisplayValue(/Harlequin Crest/);
  });

  it("does not show dropdown when auto-suggested", () => {
    render(
      <ConfirmationDialog
        result={makeResult({ is_auto_suggested: true })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Select match:")).not.toBeInTheDocument();
  });

  it("calls onConfirm with selected item on Confirm click", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledWith(mockTopMatch);
  });

  it("calls onConfirm with dropdown-selected candidate", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        result={makeResult({ is_auto_suggested: false, candidates: mockCandidates })}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText("Select match:");
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.click(screen.getByText("Confirm"));

    expect(onConfirm).toHaveBeenCalledWith(mockCandidates[1]);
  });

  it("calls onChange with raw_text on Change click", () => {
    const onChange = vi.fn();
    render(
      <ConfirmationDialog
        result={makeResult({ raw_text: "Shako screenshot" })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("Change"));
    expect(onChange).toHaveBeenCalledWith("Shako screenshot");
  });

  it("calls onDismiss on Dismiss click", () => {
    const onDismiss = vi.fn();
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Dismiss"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("buttons have tabIndex={0} for keyboard accessibility", () => {
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Confirm")).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Change")).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Dismiss")).toHaveAttribute("tabindex", "0");
  });

  it("buttons respond to Enter key", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={onConfirm}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByText("Confirm"), { key: "Enter" });
    expect(onConfirm).toHaveBeenCalled();
  });

  it("buttons respond to Space key", () => {
    const onDismiss = vi.fn();
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={vi.fn()}
        onDismiss={onDismiss}
        onChange={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByText("Dismiss"), { key: " " });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders as non-modal without overlay", () => {
    const { container } = render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    // No overlay element, just the dialog card
    expect(container.querySelector(".confirmation-dialog")).toBeInTheDocument();
    expect(container.querySelector("[class*='overlay']")).not.toBeInTheDocument();
  });

  it("has role=dialog for accessibility", () => {
    render(
      <ConfirmationDialog
        result={makeResult()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("limits dropdown to at most 5 candidates", () => {
    const manyCandidates: MatchCandidate[] = Array.from({ length: 7 }, (_, i) => ({
      item_name: `Item ${i}`,
      category: "Unique",
      subcategory: "Test",
      confidence: 70 - i,
    }));

    render(
      <ConfirmationDialog
        result={makeResult({ is_auto_suggested: false, candidates: manyCandidates })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText("Select match:");
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(5);
  });

  it("replaces content when result prop changes (React re-render)", () => {
    const { rerender } = render(
      <ConfirmationDialog
        result={makeResult({ top_match: mockTopMatch })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Harlequin Crest")).toBeInTheDocument();

    const newMatch: MatchCandidate = {
      item_name: "Ber Rune",
      category: "Rune",
      subcategory: "Rune",
      confidence: 95,
    };

    rerender(
      <ConfirmationDialog
        result={makeResult({ top_match: newMatch, candidates: [newMatch], raw_text: "Ber" })}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Ber Rune")).toBeInTheDocument();
    expect(screen.queryByText("Harlequin Crest")).not.toBeInTheDocument();
  });
});
