/**
 * Property-based test: Bug Condition Exploration
 *
 * Property 1: Toggle Button Pulse Animation Applied on State Change
 *
 * This test is EXPECTED TO FAIL on unfixed code. Failure confirms the bug exists:
 * toggle buttons with class `hotkey-btn toggle-btn recording` inherit the `pulse`
 * animation from `.hotkey-btn.recording` because no `.hotkey-btn.toggle-btn.recording`
 * override rule exists in the CSS.
 *
 * The pulse opacity animation causes the browser compositor to blend old and new text
 * content during OFF→ON transitions, producing an "ONF" artifact.
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import ScreenshotSettingsPanel from "./ScreenshotSettings";
// @ts-expect-error Node.js module available in vitest runtime
import { readFileSync } from "fs";
// @ts-expect-error Node.js module available in vitest runtime
import { resolve } from "path";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

// ===== CSS ANALYSIS HELPERS =====

/**
 * Read the App.css stylesheet and parse relevant CSS rules.
 * Since JSDOM does not apply external CSS to computed styles, we parse the
 * stylesheet directly to verify which rules apply to toggle buttons.
 */
function getAppCssContent(): string {
  // @ts-expect-error import.meta.dirname available in vitest/Node.js environment
  const cssPath = resolve(import.meta.dirname, "../App.css");
  return readFileSync(cssPath, "utf-8");
}

/**
 * Check if a CSS selector with a specific property value exists in the stylesheet.
 */
function cssRuleExists(css: string, selectorRegex: RegExp, propertyRegex: RegExp): boolean {
  // Find rule blocks matching the selector
  const ruleRegex = new RegExp(
    selectorRegex.source + "\\s*\\{([^}]*?)\\}",
    "gs"
  );
  let match;
  while ((match = ruleRegex.exec(css)) !== null) {
    const ruleBody = match[1] || match[2];
    if (ruleBody && propertyRegex.test(ruleBody)) {
      return true;
    }
  }
  return false;
}

/**
 * Determine which animation a toggle button with `recording` class would receive
 * based on CSS specificity rules in the stylesheet.
 *
 * CSS specificity:
 * - `.hotkey-btn.recording` (2 classes) applies `animation: pulse 1s infinite`
 * - `.hotkey-btn.toggle-btn.recording` (3 classes) would override with `animation: none`
 *
 * If the 3-class override does NOT exist, the 2-class rule applies pulse to toggle buttons.
 */
function getEffectiveAnimationForToggle(css: string): string {
  // Check if a more specific override for toggle buttons exists
  const hasToggleOverride = cssRuleExists(
    css,
    /\.hotkey-btn\.toggle-btn\.recording/,
    /animation\s*:\s*none/
  );

  if (hasToggleOverride) {
    return "none";
  }

  // Check if the base .hotkey-btn.recording rule applies pulse
  const hasPulseOnRecording = cssRuleExists(
    css,
    /\.hotkey-btn\.recording/,
    /animation\s*:\s*pulse/
  );

  if (hasPulseOnRecording) {
    return "pulse 1s infinite";
  }

  return "none";
}

// ===== GENERATORS =====

/** Generate a toggle scenario: which toggles are enabled */
const toggleScenarioArb = fc.record({
  monitoring_enabled: fc.boolean(),
  auto_detection_enabled: fc.boolean(),
}).filter(
  // At least one toggle must be ON for the bug condition to be testable
  (s) => s.monitoring_enabled || s.auto_detection_enabled
);

// ===== HELPERS =====

function setupMockInvoke(settings: {
  monitoring_enabled: boolean;
  auto_detection_enabled: boolean;
  confidence_threshold: number;
}) {
  mockInvoke.mockImplementation(async (cmd, args) => {
    if (cmd === "get_screenshot_settings") return { ...settings };
    if (cmd === "update_screenshot_settings") {
      const { settings: s } = args as { settings: typeof settings };
      return s;
    }
    return undefined;
  });
}

// ===== PROPERTY TESTS =====

describe("Bug Condition: Toggle Button Pulse Animation Applied on State Change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 1: Bug Condition - Toggle buttons with `recording` class should NOT
   * have pulse animation applied.
   *
   * For any toggle scenario where at least one toggle is enabled (ON state),
   * the toggle button(s) receive the classes `hotkey-btn toggle-btn recording`.
   * The CSS should NOT apply `animation: pulse` to elements with this class combination.
   *
   * This test verifies:
   * 1. Toggle buttons in ON state get the correct class composition
   * 2. The effective CSS animation for that class combination is NOT "pulse"
   *
   * On UNFIXED code, this test FAILS because `.hotkey-btn.recording` applies
   * `animation: pulse 1s infinite` and no `.hotkey-btn.toggle-btn.recording` override
   * exists to disable it for toggle buttons.
   *
   * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
   */
  it("toggle buttons with recording class do not have pulse animation applied", async () => {
    const cssContent = getAppCssContent();

    await fc.assert(
      fc.asyncProperty(toggleScenarioArb, async (scenario) => {
        cleanup();

        const settings = {
          ...scenario,
          confidence_threshold: 80,
        };

        setupMockInvoke(settings);

        const { container } = render(<ScreenshotSettingsPanel />);

        // Wait for component to load and render toggles
        await waitFor(() => {
          expect(screen.getByText("Screenshot Detection")).toBeInTheDocument();
        });

        // Find all toggle buttons with the recording class (these are ON toggles)
        const recordingToggles = container.querySelectorAll(
          ".hotkey-btn.toggle-btn.recording"
        );

        // There should be at least one recording toggle (generator ensures at least one ON)
        expect(recordingToggles.length).toBeGreaterThan(0);

        // Verify the effective CSS animation for toggle buttons with recording class
        // On unfixed code: `.hotkey-btn.recording` applies pulse, no override exists
        const effectiveAnimation = getEffectiveAnimationForToggle(cssContent);
        expect(effectiveAnimation).not.toContain("pulse");

        for (const button of recordingToggles) {
          // Verify the class composition that triggers the bug
          expect(button.classList.contains("hotkey-btn")).toBe(true);
          expect(button.classList.contains("toggle-btn")).toBe(true);
          expect(button.classList.contains("recording")).toBe(true);

          // Assert: text content should be exactly "ON" (not "ONF" or any overlap)
          expect(button.textContent).toBe("ON");
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Verify that a CSS rule `.hotkey-btn.toggle-btn.recording` exists that
   * overrides animation to `none`.
   *
   * On UNFIXED code, this test FAILS because no such selector exists in the stylesheet.
   * This confirms the root cause: toggle buttons inherit `animation: pulse 1s infinite`
   * from `.hotkey-btn.recording` with no override to prevent it.
   *
   * **Validates: Requirements 1.2, 2.2**
   */
  it("CSS rule .hotkey-btn.toggle-btn.recording exists and overrides animation to none", () => {
    const cssContent = getAppCssContent();

    // Check that a rule for .hotkey-btn.toggle-btn.recording exists with animation: none
    const hasToggleRecordingRule = cssRuleExists(
      cssContent,
      /\.hotkey-btn\.toggle-btn\.recording/,
      /animation\s*:\s*none/
    );

    expect(hasToggleRecordingRule).toBe(true);
  });

  /**
   * Property test: For any toggle scenario where toggles are enabled,
   * the enabled toggle button text content is exactly "ON" with no residual characters,
   * AND the CSS does not apply opacity-affecting animation to these buttons.
   *
   * This verifies that no "ONF" overlap artifact is possible by confirming:
   * - Toggle buttons display exactly "ON"
   * - The CSS specificity chain does not apply pulse animation to toggle buttons
   *
   * On UNFIXED code, this test FAILS because the effective animation for
   * `.hotkey-btn.toggle-btn.recording` resolves to `pulse 1s infinite` (from the
   * less-specific `.hotkey-btn.recording` rule), which oscillates opacity between
   * 1.0 and 0.6, causing text overlap during state transitions.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it("enabled toggle buttons have no opacity animation that could cause text overlap", async () => {
    const cssContent = getAppCssContent();

    await fc.assert(
      fc.asyncProperty(toggleScenarioArb, async (scenario) => {
        cleanup();

        const settings = {
          ...scenario,
          confidence_threshold: 80,
        };

        setupMockInvoke(settings);

        const { container } = render(<ScreenshotSettingsPanel />);

        await waitFor(() => {
          expect(screen.getByText("Screenshot Detection")).toBeInTheDocument();
        });

        const recordingToggles = container.querySelectorAll(
          ".hotkey-btn.toggle-btn.recording"
        );

        expect(recordingToggles.length).toBeGreaterThan(0);

        // Verify no pulse animation applies to toggle buttons via CSS specificity
        const effectiveAnimation = getEffectiveAnimationForToggle(cssContent);

        // The effective animation must be "none" — not "pulse 1s infinite"
        // On unfixed code, this is "pulse 1s infinite" which causes the opacity
        // flicker leading to "ONF" text overlap
        expect(effectiveAnimation).toBe("none");

        for (const button of recordingToggles) {
          // Text must be exactly "ON" — not "ONF", "ONOFF", or any other artifact
          expect(button.textContent).toBe("ON");
        }
      }),
      { numRuns: 50 }
    );
  });
});
