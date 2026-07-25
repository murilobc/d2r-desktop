# Implementation Plan: OCR Tooltip Accuracy Fix

## Overview

This plan fixes the OCR tooltip detection accuracy bug using the bug condition methodology. The fix introduces tooltip-first detection (locate the dark tooltip background, extract only the first line for OCR) and a confidence floor in the fuzzy matcher (reject matches below 55%). The approach follows an exploratory workflow: write tests before the fix to confirm the bug, write preservation tests to capture existing behavior, then implement the fix and verify both test suites pass.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Contaminated Bounding Box from Non-Tooltip UI Pixels
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the color detector's bounding box includes pixels from non-tooltip UI areas
  - **Scoped PBT Approach**: Create synthetic 1920×1080 RGBA images containing:
    - A dark tooltip rectangle (R<25, G<25, B<25, A>170) at a known position (e.g., x:450-680, y:280-470)
    - Orange/gold item-colored pixels inside the tooltip (simulating "Lum Rune" text)
    - Additional orange/gold pixels outside the tooltip at a distant position (e.g., x:1200, y:300) simulating inventory panel contamination
  - Bug condition from design: `isBugCondition(input)` where `tooltip.exists AND contaminantPixels.count > 0 AND boundingBox(colorPixels) != boundingBox(tooltipPixels)`
  - Property assertion (expected behavior): The crop returned by `detect_item_text_region` must be contained entirely within the tooltip bounds — its width must NOT span from the tooltip to the distant inventory pixels
  - Run test on UNFIXED code — expect FAILURE (bounding box will span both regions, confirming contamination)
  - Document counterexamples: e.g., "crop spans x:440-1210 instead of being confined to tooltip region x:440-690"
  - Also test confidence floor: pass garbage OCR text ("xqzpwlm") through `match_items` with threshold 55 and assert no matches are returned (will FAIL on unfixed code since `_threshold` is unused)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - No-Tooltip Fallback and Clean Match Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code:**
    - Images with no dark rectangular background → `detect_item_text_region` returns original image bytes, empty category, zero confidence_boost
    - Images where the tooltip is the ONLY source of colored pixels (no contamination) → correct category detected
    - `normalize_ocr_chars` and `parse_tooltip_text` produce consistent output for identical inputs
  - **Write property-based tests:**
    - For all random RGBA images with no dark rectangle (no pixel with R<25, G<25, B<25, A>170 in a 100×40 contiguous region): assert `detect_item_text_region` returns original bytes, empty category, zero boost (from Preservation Requirements 3.1, 3.3)
    - For all random text inputs: assert `normalize_ocr_chars` is idempotent — `normalize_ocr_chars(normalize_ocr_chars(x)) == normalize_ocr_chars(x)` (Preservation Requirement 3.4)
    - For all images with a single cluster of item-colored pixels in the top half (no distant contamination): assert the detected category matches the planted color's category (Preservation Requirement 3.2)
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for OCR tooltip accuracy — tooltip-first detection and confidence floor

  - [x] 3.1 Add `find_tooltip_bounds` function to `color_detector.rs`
    - Implement `find_tooltip_bounds(rgba: &RgbaImage) -> Option<(u32, u32, u32, u32)>`
    - Scan image for contiguous dark pixels (R<25, G<25, B<25, A>170)
    - Use row-scanning approach to find the largest dark rectangle
    - Enforce minimum size threshold: at least 100px wide × 40px tall
    - Return bounding box `(min_x, min_y, max_x, max_y)` or `None`
    - _Bug_Condition: isBugCondition(input) where tooltip.exists AND contaminantPixels from non-tooltip areas are within item-color tolerance_
    - _Expected_Behavior: tooltip background is identified and used to constrain subsequent color scanning_
    - _Preservation: When no dark rectangle meets the minimum size, returns None (triggering fallback)_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Add `extract_first_line_region` function to `color_detector.rs`
    - Implement `extract_first_line_region(rgba: &RgbaImage, tooltip_bounds: (u32,u32,u32,u32), color: &ColorRange) -> Option<(u32,u32,u32,u32)>`
    - Within tooltip bounds, scan from top for first row of pixels matching target item color
    - Find vertical extent of first text line (typically 15-25px at 1080p)
    - Return tight bounding box around just the first line, or None if no matching pixels
    - Add 5px padding (clamped to tooltip bounds) for OCR readability
    - _Bug_Condition: Current code captures ALL matching pixels globally instead of just the first tooltip line_
    - _Expected_Behavior: Only the first line of colored text (the item name) is extracted_
    - _Preservation: Returns None when no colored text found in tooltip, allowing fallback_
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 Modify `detect_item_text_region` control flow for tooltip-first path
    - First call `find_tooltip_bounds` to attempt tooltip localization
    - If tooltip found: for each item color, call `extract_first_line_region` within tooltip bounds; select the color with the most matching first-line pixels; crop and binarize only that first-line region
    - If tooltip NOT found: fall through to existing top-50% scan logic (preserves fallback behavior)
    - Binarize only the first-line crop using existing `binarize_region` function
    - _Bug_Condition: detect_item_text_region scans entire top 50% without tooltip localization_
    - _Expected_Behavior: Tooltip-first detection constrains scanning to tooltip region only_
    - _Preservation: No-tooltip path remains unchanged — same output as before_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3_

  - [x] 3.4 Enforce minimum confidence floor in `match_items` (`matcher.rs`)
    - Change `_threshold` parameter to `min_confidence: u8`
    - Filter out all matches with confidence < min_confidence before deduplication and sorting
    - Default value: 55
    - _Bug_Condition: _threshold is unused — matches at 31-40% confidence are returned as suggestions_
    - _Expected_Behavior: Matches below min_confidence are rejected; pipeline emits detection-failed with reason "no_match" instead of garbage suggestion_
    - _Preservation: Matches at or above min_confidence are returned unchanged_
    - _Requirements: 2.4_

  - [x] 3.5 Replace hardcoded `> 30` filter in `process_image` (`monitor.rs`)
    - Replace the `matches.into_iter().filter(|m| m.confidence > 30)` with the confidence floor passed to `match_items`
    - The pipeline filter becomes `> min_confidence` (which defaults to 55) instead of `> 30`
    - Update `determine_process_outcome` and `determine_routing` to use the settings-driven floor
    - _Bug_Condition: Hardcoded > 30 filter accepts garbage matches between 31-54%_
    - _Expected_Behavior: Only matches above the configured confidence floor are accepted_
    - _Preservation: Pipeline structure, event emission, timeout, deduplication all unchanged_
    - _Requirements: 2.4, 3.2_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Contaminated Bounding Box Eliminated
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (crop within tooltip bounds, confidence floor rejects garbage)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — crop is within tooltip, confidence floor rejects low matches)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - No-Tooltip Fallback and Clean Match Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — fallback path unchanged, normalize_ocr_chars idempotent, single-cluster detection preserved)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `cd src-tauri && cargo test` to verify all Rust tests pass
  - Run `npm test` to verify frontend tests still pass
  - Run `cd src-tauri && cargo check` for zero warnings
  - Ensure all property tests (exploration + preservation) pass on the fixed code
  - Ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.4"] },
    { "id": 3, "tasks": ["3.3", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7"] },
    { "id": 5, "tasks": ["4"] }
  ]
}
```

## Notes

- Task 1 (exploration test) and Task 2 (preservation test) MUST run on unfixed code — they validate the bug exists and capture baseline behavior
- Tasks 3.1 and 3.2 are independent new functions that can be developed in parallel with 3.4 (matcher change)
- Task 3.3 depends on 3.1 and 3.2 being complete (it wires the new functions into the control flow)
- Task 3.5 depends on 3.4 (matcher confidence floor must exist before monitor uses it)
- Tasks 3.6 and 3.7 are verification steps that re-run existing tests — no new test code written
- All Rust code must compile with zero warnings per project conventions
- Use regular comments (`//`) above `proptest!` blocks, not doc comments (`///`)
