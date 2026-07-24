/**
 * Property-based test: Bug Condition Exploration
 *
 * Property 1: Bug Condition — Silent Failure Paths Emit No Events
 *
 * This test is EXPECTED TO FAIL on unfixed code. Failure confirms the bug exists:
 * the three new reason codes ("ocr_init_failed", "ocr_failed", "no_candidates")
 * do NOT have entries in the REASON_MESSAGES map, so mapReasonToMessage returns
 * the generic fallback "Screenshot detection failed" instead of a specific message.
 *
 * The bug: when these failure paths are hit in the Rust backend, no event is emitted.
 * Even if an event WERE emitted, the frontend has no specific message mapping for
 * these reason codes — it would show the generic fallback.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
// @ts-expect-error Node.js module available in vitest runtime
import { readFileSync } from "fs";
// @ts-expect-error Node.js module available in vitest runtime
import { resolve } from "path";

// ===== SOURCE FILE ANALYSIS =====

/**
 * Read the useDetectionToast.ts source file and extract the REASON_MESSAGES map.
 * Since REASON_MESSAGES and mapReasonToMessage are not exported, we parse the
 * source directly to verify which reason codes have mappings.
 */
function getSourceContent(): string {
  // @ts-expect-error import.meta.dirname available in vitest/Node.js environment
  const srcPath = resolve(import.meta.dirname, "useDetectionToast.ts");
  return readFileSync(srcPath, "utf-8");
}

/**
 * Parse REASON_MESSAGES entries from the source file.
 * Returns a Set of reason code keys that have mappings.
 */
function parseReasonMessageKeys(source: string): Set<string> {
  // Match the REASON_MESSAGES object content
  const mapMatch = source.match(
    /const REASON_MESSAGES[^=]*=\s*\{([^}]*)\}/s
  );
  if (!mapMatch) return new Set();

  const mapBody = mapMatch[1];
  // Extract keys (identifiers or quoted strings before the colon)
  const keyRegex = /(\w+)\s*:/g;
  const keys = new Set<string>();
  let match;
  while ((match = keyRegex.exec(mapBody)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

/**
 * Replicate mapReasonToMessage logic based on parsed REASON_MESSAGES.
 * This mirrors what the actual function does: look up reason in REASON_MESSAGES,
 * fall back to "Screenshot detection failed" if not found.
 */
function simulateMapReasonToMessage(
  reason: string,
  reasonMessages: Record<string, string>
): string {
  return reasonMessages[reason] || "Screenshot detection failed";
}

/**
 * Parse REASON_MESSAGES entries with their values from the source file.
 * Returns a Record of reason code -> message string.
 */
function parseReasonMessagesMap(source: string): Record<string, string> {
  const mapMatch = source.match(
    /const REASON_MESSAGES[^=]*=\s*\{([^}]*)\}/s
  );
  if (!mapMatch) return {};

  const mapBody = mapMatch[1];
  const entryRegex = /(\w+)\s*:\s*"([^"]*)"/g;
  const result: Record<string, string> = {};
  let match;
  while ((match = entryRegex.exec(mapBody)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

// ===== GENERATORS =====

/** The three new reason codes that correspond to the silent failure paths. */
const silentFailureReasonArb = fc.constantFrom(
  "ocr_init_failed",
  "ocr_failed",
  "no_candidates"
);

/**
 * Expected specific messages for the new reason codes.
 * These are what the fix SHOULD add to REASON_MESSAGES.
 */
const EXPECTED_MESSAGES: Record<string, string> = {
  ocr_init_failed: "Screenshot analysis failed — please try again",
  ocr_failed: "Could not read text from screenshot",
  no_candidates: "No D2R item tooltip detected in image",
};

// ===== PROPERTY TESTS =====

describe("Bug Condition: Silent Failure Paths Emit No Events", () => {
  /**
   * Property 1a: REASON_MESSAGES should contain specific entries for
   * the three new reason codes.
   *
   * On UNFIXED code, this test FAILS because REASON_MESSAGES only contains
   * "no_image", "no_text", and "no_match" — not the three new codes.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3**
   */
  it("REASON_MESSAGES contains entries for all silent failure reason codes", () => {
    const source = getSourceContent();
    const keys = parseReasonMessageKeys(source);

    fc.assert(
      fc.property(silentFailureReasonArb, (reason) => {
        // Assert: the reason code should exist in REASON_MESSAGES
        expect(keys.has(reason)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1b: mapReasonToMessage should return a SPECIFIC (non-fallback)
   * message for each of the three new reason codes.
   *
   * On UNFIXED code, this test FAILS because mapReasonToMessage returns the
   * generic fallback "Screenshot detection failed" for these codes since they
   * have no entry in REASON_MESSAGES.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it("mapReasonToMessage returns specific messages (not generic fallback) for silent failure codes", () => {
    const source = getSourceContent();
    const reasonMessages = parseReasonMessagesMap(source);

    fc.assert(
      fc.property(silentFailureReasonArb, (reason) => {
        const message = simulateMapReasonToMessage(reason, reasonMessages);

        // Assert: should NOT return the generic fallback
        expect(message).not.toBe("Screenshot detection failed");

        // Assert: should return the expected specific message
        expect(message).toBe(EXPECTED_MESSAGES[reason]);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1c: The REASON_MESSAGES map should have exactly 6 entries
   * after the fix (3 existing + 3 new).
   *
   * On UNFIXED code, this test FAILS because REASON_MESSAGES only has 3 entries.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 2.4**
   */
  it("REASON_MESSAGES has entries for all 6 reason codes (3 existing + 3 new)", () => {
    const source = getSourceContent();
    const keys = parseReasonMessageKeys(source);

    const allExpectedKeys = [
      "no_image",
      "no_text",
      "no_match",
      "ocr_init_failed",
      "ocr_failed",
      "no_candidates",
    ];

    for (const key of allExpectedKeys) {
      expect(keys.has(key)).toBe(true);
    }

    expect(keys.size).toBe(6);
  });
});
