import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RuneCell, { RuneCellProps } from "./RuneCell";

function defaultProps(overrides: Partial<RuneCellProps> = {}): RuneCellProps {
  return {
    runeName: "El",
    runeLevel: 1,
    count: 5,
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onSetCount: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

describe("RuneCell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("overlay timing (Requirements 4.1, 6.2, 6.3)", () => {
    it("shows controls overlay after 150ms on mouse enter", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      fireEvent.mouseEnter(cell);

      // Before 150ms, overlay should not be visible
      act(() => {
        vi.advanceTimersByTime(100);
      });
      const overlay = cell.querySelector(".rune-cell__controls-overlay");
      expect(overlay).not.toHaveClass("rune-cell__controls-overlay--visible");

      // After 150ms, overlay should be visible
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(overlay).toHaveClass("rune-cell__controls-overlay--visible");
    });

    it("hides controls overlay after 300ms on mouse leave", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      // Show the overlay first
      fireEvent.mouseEnter(cell);
      act(() => {
        vi.advanceTimersByTime(150);
      });
      const overlay = cell.querySelector(".rune-cell__controls-overlay");
      expect(overlay).toHaveClass("rune-cell__controls-overlay--visible");

      // Leave the cell
      fireEvent.mouseLeave(cell);

      // Before 300ms, overlay should still be visible
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(overlay).toHaveClass("rune-cell__controls-overlay--visible");

      // After 300ms total, overlay should be hidden
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(overlay).not.toHaveClass("rune-cell__controls-overlay--visible");
    });

    it("cancels hide timer when mouse re-enters before 300ms", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      // Show the overlay
      fireEvent.mouseEnter(cell);
      act(() => {
        vi.advanceTimersByTime(150);
      });
      const overlay = cell.querySelector(".rune-cell__controls-overlay");
      expect(overlay).toHaveClass("rune-cell__controls-overlay--visible");

      // Leave and re-enter quickly
      fireEvent.mouseLeave(cell);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.mouseEnter(cell);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Overlay should remain visible because hide was cancelled
      expect(overlay).toHaveClass("rune-cell__controls-overlay--visible");
    });
  });

  describe("keyboard Tab order (Requirements 4.4, 6.4)", () => {
    it("overlay buttons have tabIndex=-1 when not hovered", () => {
      render(<RuneCell {...defaultProps()} />);

      const incrementBtn = screen.getByLabelText("Increment El");
      const decrementBtn = screen.getByLabelText("Decrement El");

      expect(incrementBtn).toHaveAttribute("tabindex", "-1");
      expect(decrementBtn).toHaveAttribute("tabindex", "-1");
    });

    it("overlay buttons have tabIndex=0 when hovered", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      fireEvent.mouseEnter(cell);
      act(() => {
        vi.advanceTimersByTime(150);
      });

      const incrementBtn = screen.getByLabelText("Increment El");
      const decrementBtn = screen.getByLabelText("Decrement El");
      const resetBtn = screen.getByLabelText("Reset El");

      expect(incrementBtn).toHaveAttribute("tabindex", "0");
      expect(decrementBtn).toHaveAttribute("tabindex", "0");
      expect(resetBtn).toHaveAttribute("tabindex", "0");
    });

    it("buttons are in sequential order: increment, decrement, reset", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      fireEvent.mouseEnter(cell);
      act(() => {
        vi.advanceTimersByTime(150);
      });

      const overlay = cell.querySelector(".rune-cell__controls-overlay")!;
      const buttons = overlay.querySelectorAll("button");

      expect(buttons[0]).toHaveAttribute("aria-label", "Increment El");
      expect(buttons[1]).toHaveAttribute("aria-label", "Decrement El");
      expect(buttons[2]).toHaveAttribute("aria-label", "Reset El");
    });
  });

  describe("accent border in edit mode (Requirements 5.5)", () => {
    it("applies rune-cell--editing class when count is clicked", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      // Click the count display to enter edit mode
      const countDisplay = screen.getByRole("button", {
        name: /El count 5/,
      });
      fireEvent.click(countDisplay);

      expect(cell).toHaveClass("rune-cell--editing");
    });

    it("removes rune-cell--editing class after committing edit", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      // Enter edit mode
      const countDisplay = screen.getByRole("button", {
        name: /El count 5/,
      });
      fireEvent.click(countDisplay);
      expect(cell).toHaveClass("rune-cell--editing");

      // Commit with Enter
      const input = screen.getByLabelText("Count for El");
      fireEvent.keyDown(input, { key: "Enter" });

      expect(cell).not.toHaveClass("rune-cell--editing");
    });

    it("removes rune-cell--editing class after discarding edit with Escape", () => {
      render(<RuneCell {...defaultProps()} />);
      const cell = screen.getByText("El").closest(".rune-cell")!;

      // Enter edit mode
      const countDisplay = screen.getByRole("button", {
        name: /El count 5/,
      });
      fireEvent.click(countDisplay);
      expect(cell).toHaveClass("rune-cell--editing");

      // Discard with Escape
      const input = screen.getByLabelText("Count for El");
      fireEvent.keyDown(input, { key: "Escape" });

      expect(cell).not.toHaveClass("rune-cell--editing");
    });
  });

  describe("input size stability (Requirements 5.7)", () => {
    it("input has maxLength=2 to prevent cell size changes", () => {
      render(<RuneCell {...defaultProps()} />);

      // Enter edit mode
      const countDisplay = screen.getByRole("button", {
        name: /El count 5/,
      });
      fireEvent.click(countDisplay);

      const input = screen.getByLabelText("Count for El");
      expect(input).toHaveAttribute("maxlength", "2");
    });

    it("input has the rune-cell__input class for constrained sizing", () => {
      render(<RuneCell {...defaultProps()} />);

      // Enter edit mode
      const countDisplay = screen.getByRole("button", {
        name: /El count 5/,
      });
      fireEvent.click(countDisplay);

      const input = screen.getByLabelText("Count for El");
      expect(input).toHaveClass("rune-cell__input");
    });
  });
});
