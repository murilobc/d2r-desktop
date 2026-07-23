/**
 * Property-based tests for the RuneCell component behavior.
 *
 * Uses fast-check + vitest + @testing-library/react to verify
 * component behavior across randomly generated inputs.
 */

// Feature: runeword-planner-ui-refinement, Property 2: Reset visibility and behavior
// Feature: runeword-planner-ui-refinement, Property 3: Reset control accessibility labels
// Feature: runeword-planner-ui-refinement, Property 4: Click-to-edit initializes with current count
// Feature: runeword-planner-ui-refinement, Property 6: Escape key discards edits

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RuneCell from "./RuneCell";
import { RUNE_ORDER } from "../data/runes";

// ===== GENERATORS =====

/** Generate a rune name from the 33 valid rune names. */
const runeNameArb = fc.constantFrom(...RUNE_ORDER);

/** Generate a rune level in the valid range [1, 33]. */
const runeLevelArb = fc.integer({ min: 1, max: 33 });

/** Generate a rune count in the valid range [0, 99]. */
const runeCountArb = fc.integer({ min: 0, max: 99 });

/** Generate a positive rune count [1, 99]. */
const positiveCountArb = fc.integer({ min: 1, max: 99 });

/** Generate an arbitrary edit string (for escape key tests). */
const editValueArb = fc.string({ minLength: 0, maxLength: 3 });

// ===== HELPERS =====

function renderRuneCell(overrides: Partial<Parameters<typeof RuneCell>[0]> = {}) {
  const defaultProps = {
    runeName: "El",
    runeLevel: 1,
    count: 0,
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onSetCount: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  return { ...render(<RuneCell {...defaultProps} />), props: defaultProps };
}

// ===== PROPERTY TESTS =====

describe("Feature: runeword-planner-ui-refinement, Property 2: Reset visibility and behavior", () => {
  /**
   * Property 2: Reset visibility and behavior
   *
   * For any rune name and for any count value (0–99):
   * - When count === 0, the reset control SHALL be hidden (not interactive)
   * - When count > 0 and the user activates the reset control, onReset SHALL be called
   *
   * **Validates: Requirements 4.2, 4.3, 4.6**
   */
  it("reset button is not rendered when count === 0", () => {
    fc.assert(
      fc.property(runeNameArb, runeLevelArb, (runeName, runeLevel) => {
        const { unmount } = renderRuneCell({ runeName, runeLevel, count: 0 });

        // When count is 0, there should be no reset button in the DOM
        const resetBtn = screen.queryByRole("button", { name: new RegExp(`Reset ${runeName}`, "i") });
        expect(resetBtn).not.toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  });

  it("reset button is rendered when count > 0 and hover is active", () => {
    fc.assert(
      fc.property(runeNameArb, runeLevelArb, positiveCountArb, (runeName, runeLevel, count) => {
        vi.useFakeTimers();
        const { container, unmount } = renderRuneCell({ runeName, runeLevel, count });

        // Simulate hover to reveal controls
        const cell = container.querySelector(".rune-cell")!;
        act(() => {
          fireEvent.mouseEnter(cell);
        });
        act(() => {
          vi.advanceTimersByTime(150);
        });

        // Reset button should be present
        const resetBtn = screen.queryByRole("button", { name: new RegExp(`Reset ${runeName}`, "i") });
        expect(resetBtn).toBeInTheDocument();

        unmount();
        vi.useRealTimers();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: runeword-planner-ui-refinement, Property 3: Reset control accessibility labels", () => {
  /**
   * Property 3: Reset control accessibility labels
   *
   * For any rune name from the 33 runes in RUNE_ORDER, the reset control's
   * aria-label SHALL contain both the rune name and the word "Reset" (case-insensitive match).
   *
   * **Validates: Requirements 4.5**
   */
  it("reset button aria-label contains rune name and 'Reset'", () => {
    fc.assert(
      fc.property(runeNameArb, runeLevelArb, positiveCountArb, (runeName, runeLevel, count) => {
        vi.useFakeTimers();
        const { container, unmount } = renderRuneCell({ runeName, runeLevel, count });

        // Simulate hover to reveal controls
        const cell = container.querySelector(".rune-cell")!;
        act(() => {
          fireEvent.mouseEnter(cell);
        });
        act(() => {
          vi.advanceTimersByTime(150);
        });

        // Find the reset button and check its aria-label
        const resetBtn = screen.getByRole("button", { name: new RegExp(`Reset ${runeName}`, "i") });
        const ariaLabel = resetBtn.getAttribute("aria-label") ?? "";

        expect(ariaLabel.toLowerCase()).toContain("reset");
        expect(ariaLabel).toContain(runeName);

        unmount();
        vi.useRealTimers();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: runeword-planner-ui-refinement, Property 4: Click-to-edit initializes with current count", () => {
  /**
   * Property 4: Click-to-edit initializes with current count
   *
   * For any rune cell with a count value in [0, 99], when the user activates edit mode
   * (clicks the count display), the input field SHALL be pre-filled with the string
   * representation of the current count value.
   *
   * **Validates: Requirements 5.1**
   */
  it("input pre-fill matches the current count when entering edit mode", () => {
    fc.assert(
      fc.property(runeNameArb, runeLevelArb, runeCountArb, (runeName, runeLevel, count) => {
        const { unmount } = renderRuneCell({ runeName, runeLevel, count });

        // Click the count display to enter edit mode
        const countDisplay = screen.getByRole("button", { name: new RegExp(`${runeName} count`, "i") });
        fireEvent.click(countDisplay);

        // The input should now be visible with the count pre-filled
        const input = screen.getByLabelText(new RegExp(`Count for ${runeName}`, "i"));
        expect(input).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toBe(String(count));

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Feature: runeword-planner-ui-refinement, Property 6: Escape key discards edits", () => {
  /**
   * Property 6: Escape key discards edits
   *
   * For any rune cell in edit mode with any in-progress edit value, pressing Escape SHALL:
   * - Revert the displayed value to the count that was showing before edit mode was entered
   * - NOT invoke onSetCount
   * - Exit edit mode (return to static count display)
   *
   * **Validates: Requirements 5.6**
   */
  it("pressing Escape reverts value and does not call onSetCount", () => {
    fc.assert(
      fc.property(runeNameArb, runeLevelArb, runeCountArb, editValueArb, (runeName, runeLevel, count, newValue) => {
        const onSetCount = vi.fn();
        const { unmount } = renderRuneCell({ runeName, runeLevel, count, onSetCount });

        // Enter edit mode by clicking count display
        const countDisplay = screen.getByRole("button", { name: new RegExp(`${runeName} count`, "i") });
        fireEvent.click(countDisplay);

        // Type a different value in the input
        const input = screen.getByLabelText(new RegExp(`Count for ${runeName}`, "i"));
        fireEvent.change(input, { target: { value: newValue } });

        // Press Escape to discard
        fireEvent.keyDown(input, { key: "Escape" });

        // onSetCount should NOT have been called
        expect(onSetCount).not.toHaveBeenCalled();

        // Should be back in display mode showing original count
        const restoredDisplay = screen.getByRole("button", { name: new RegExp(`${runeName} count`, "i") });
        expect(restoredDisplay).toBeInTheDocument();
        expect(restoredDisplay.textContent).toBe(String(count));

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});
