# Implementation Plan: Screenshot Detection Rewrite

## Overview

This plan completely rewrites the `detect_item_text_region` function to use spatial clustering of colored pixels instead of dark background detection. It also removes the defunct `find_tooltip_bounds`, `extract_first_line_region`, and `is_dark_pixel` functions, and improves the matcher with exact-match fast path, dynamic confidence floors, and multi-word matching. The approach follows the exploratory bugfix workflow: write tests before the fix to confirm the bug exists, write preservation tests to capture existing behavior, then implement the fix and verify both test suites pass.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Spatial Clustering vs Background Detection
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the current detection fails when non-tooltip colored pixels exist
  - **Scoped PBT Approach**: Create synthetic 1920×1080 RGBA images containing:
    - A tight horizontal band of ~50 gold pixels at (x:400-500, y:200-215) simulating an item name like "Harlequin Crest"
    - 30+ scattered gold pixels at distant positions (x:1200-1400, y:100-500) simulating inventory panel items
  - Test in `src-tauri/src/screenshot/color_detector.rs` (inline test module)
  - Bug Condition from design: `isBugCondition(input)` — tooltip visible AND non-tooltip colored pixels exist (inventory, ground labels, chat), OR tooltip overlaps inventory panel
  - Property assertion (expected behavior): the returned crop must have a text-like aspect ratio (width/height > 3.0) and width significantly less than the distance between the text cluster and scattered noise. The crop should NOT span from x:400 to x:1400.
  - Assert: returned crop width < 200px (isolated text cluster), NOT a 1000px+ bounding box spanning text+noise
  - Assert: `detected_category` is non-empty (detection succeeded)
  - Also test matcher bug condition: pass "Ber" to `match_items` with min_confidence=55 — assert exact match "Ber Rune" at 100% confidence (will FAIL on unfixed code since no exact-match path exists)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS because current code aggregates all same-color pixels into one bounding box (legacy top-50% scan) returning a crop spanning the full scattered region
  - Document counterexamples: current code returns crop width ~1000px spanning both text and noise pixels, with aspect ratio <2.0
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - No-Match Fallback and Binarization Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code:**
    - Images with no pixels matching any D2R item color → `detect_item_text_region` returns original image bytes, empty category, zero confidence_boost
    - `binarize_region` produces only 0 or 255 pixel values for any input RGBA image and any ColorRange
    - `pixel_matches` returns true for pixels within tolerance and false for pixels outside tolerance
  - **Write property-based tests** in `src-tauri/src/screenshot/color_detector.rs`:
    - For all random RGBA images with pixels far from any ITEM_COLORS entry (r:40-60, g:40-60, b:40-60): assert `detect_item_text_region` returns original bytes, empty category, zero boost
    - For all RGBA images and any ColorRange: assert `binarize_region` output dimensions match input and all pixels are 0 or 255
    - For all pixels: assert `pixel_matches` returns true iff each channel difference ≤ tolerance
  - Note: existing prop tests `prop_color_detection_fallback_on_no_match_images` and `prop_binarization_produces_valid_binary_output` already cover the first two — verify they PASS on unfixed code
  - Additionally verify `prop_color_detection_identifies_known_colors` passes (this test will need updating after gray color is added, but the existing colors should still pass)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline preservation behavior to protect)
  - Mark task complete when tests are verified passing on unfixed code
  - _Requirements: 3.1, 3.2_

- [x] 3. Rewrite detection pipeline and improve matcher

  - [x] 3.1 Add gray color to ITEM_COLORS and remove defunct functions
    - Add `ColorRange { r_center: 148, g_center: 148, b_center: 148, tolerance: 20, category: "Socketed" }` to ITEM_COLORS
    - Delete `find_tooltip_bounds` function entirely
    - Delete `extract_first_line_region` function entirely
    - Delete `is_dark_pixel` function entirely
    - Delete the tooltip-first path code block from `detect_item_text_region` (the `if let Some(tooltip_bounds)` block)
    - Delete the legacy top-50% scan path
    - Keep `pixel_matches`, `binarize_region`, existing ITEM_COLORS entries (Unique, Set, Rune, Rare, Magic, Normal)
    - _Bug_Condition: isBugCondition(input) — tooltip detection via dark background fails when inventory present_
    - _Expected_Behavior: removal eliminates the flawed background-detection path entirely_
    - _Preservation: pixel_matches, binarize_region, ITEM_COLORS values all preserved (extended with gray)_
    - _Requirements: 2.1, 2.3.1, 3.1, 3.2_

  - [x] 3.2 Implement spatial clustering algorithm in `detect_item_text_region`
    - Compute `scale_factor = image_height as f64 / 1080.0`
    - For each color in ITEM_COLORS, scan entire image collecting matching pixel coordinates into `Vec<(u32, u32)>`
    - Sort pixels by (y, x), group into row-segments where consecutive x values are within `(5.0 * scale_factor).round() as u32` pixels
    - Merge row-segments across adjacent rows (within 2px vertical gap) that overlap horizontally → forms clusters
    - For each cluster compute bounding box (min_x, min_y, max_x, max_y), width, height, aspect_ratio, density
    - Apply size constraints (scaled by image height):
      - `min_width = (height as f64 * 0.03).round() as u32`
      - `max_width = (height as f64 * 0.35).round() as u32`
      - `min_height_px = (height as f64 * 0.01).round() as u32`
      - `max_height_px = (height as f64 * 0.03).round() as u32`
    - Score each cluster:
      - aspect_ratio_score: 1.0 if 4-15, 0.5 if 3-4 or 15-25, 0.0 otherwise
      - density_score: 1.0 if 15-60%, 0.5 if 10-15% or 60-80%, 0.0 otherwise
      - `score = pixel_count as f64 * aspect_ratio_score * density_score`
    - Reject clusters with score = 0.0
    - Select best cluster across all colors (highest score)
    - Pad bounding box by `(5.0 * scale_factor).round() as u32`, clamp to image bounds
    - Crop RGBA sub-image, binarize with `binarize_region`, encode to PNG
    - Return `ColorDetectionResult { cropped_image, detected_category: color.category, confidence_boost: 15 }`
    - Fallback: if no valid cluster found for any color, return full original image with empty category and zero boost
    - _Bug_Condition: spatial clustering replaces flawed background detection and top-50% scan_
    - _Expected_Behavior: cluster with best text-like aspect ratio and density selected, ignoring noise_
    - _Preservation: fallback returns identical result to original for no-match images_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 2.9, 3.1_

  - [x] 3.3 Implement matcher improvements in `matcher.rs`
    - **Exact match fast path** (before fuzzy matching loop):
      - For each candidate, normalize text (trim, lowercase, `normalize_ocr_chars`)
      - Check if normalized text exactly equals any `item.normalized_name` in ITEM_DATABASE
      - If exact match found → return immediately with confidence=100
    - **"X Rune" pattern** (after exact match fails):
      - If text.len() < 5 and no exact match, try `format!("{} rune", text)` normalized
      - Check for exact match with appended form → return with confidence=100 if found
    - **Dynamic confidence floor**:
      - `effective_floor = if normalized.len() < 6 { min_confidence.max(70) } else { min_confidence.max(50) }`
      - Apply per-candidate in the filter step (replace current `matches.retain(|m| m.confidence >= min_confidence)`)
    - **Multi-word matching**:
      - For each candidate text, split by whitespace
      - Compute fuzzy scores for: (a) full text, (b) each individual word, (c) consecutive word combinations
      - For each item, take the maximum confidence across all sub-strategies
    - _Bug_Condition: isMatcherBugCondition — exact match exists but fuzzy returns wrong, short text floor too low, multi-word not tried_
    - _Expected_Behavior: exact match at 100%, dynamic floor 70%/<6 chars and 50%/≥6 chars, multi-word strategies tried_
    - _Preservation: MatchCandidate struct format unchanged, normalize_ocr_chars unchanged, priority tiebreaker unchanged_
    - _Requirements: 2.5, 2.6, 2.7, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Spatial Clustering Isolates Item Name Text
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (text-like cluster selected over noise, exact match returns 100%)
    - When this test passes, it confirms the spatial clustering correctly isolates item name text and matcher finds exact matches
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - No-Match Fallback and Binarization Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — fallback and binarization unchanged)
    - Confirm all existing prop tests still pass after the rewrite
    - _Requirements: 3.1, 3.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `cd src-tauri && cargo test` to verify all Rust tests pass
  - Run `cd src-tauri && cargo check` to verify zero warnings
  - Ensure exploration test (Property 1) passes after fix
  - Ensure preservation tests (Property 2) pass after fix
  - Ensure existing prop tests (`prop_binarization_produces_valid_binary_output`, `prop_color_detection_fallback_on_no_match_images`) all pass
  - Update `prop_color_detection_identifies_known_colors` test if needed (color_idx range may need to include index 6 for Socketed gray)
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5"] },
    { "id": 5, "tasks": ["4"] }
  ]
}
```

## Notes

- Task 1 (exploration test) and Task 2 (preservation test) MUST run on unfixed code — they validate the bug exists and capture baseline behavior
- Task 3.1 must be done first (removes old functions, adds gray color) before 3.2 can implement the new algorithm in the same function
- Tasks 3.2 and 3.3 are independent (different files: color_detector.rs vs matcher.rs) and can be developed in parallel
- Tasks 3.4 and 3.5 are verification steps that re-run existing tests — no new test code written
- All Rust code must compile with zero warnings per project conventions
- Use regular comments (`//`) above `proptest!` blocks, not doc comments (`///`)
- The existing `prop_color_detection_identifies_known_colors` test uses `color_idx in 0..6usize` — after adding Socketed gray this should become `0..7usize` in the checkpoint
- Resolution scaling ensures all thresholds work across 720p to 4K by dividing image height by 1080
