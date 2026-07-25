# OCR Tooltip Accuracy Fix — Bugfix Design

## Overview

The screenshot item detection pipeline produces incorrect fuzzy matches because `detect_item_text_region` in `color_detector.rs` scans the entire top 50% of the screenshot for item-colored pixels. This captures orange/gold/green pixels from the inventory panel, UI chrome, and other non-tooltip areas, producing a contaminated bounding box. The OCR engine then receives a binarized image full of irrelevant glyphs, and the fuzzy matcher returns a garbage match (e.g., "Ravenlore" when the tooltip says "Lum Rune") because there is no minimum confidence floor to reject implausible results.

The fix introduces a tooltip-first detection strategy: locate the D2R tooltip's dark semi-transparent rectangular background first, isolate only the first text line within it, then feed that clean crop to OCR. Additionally, `match_items` will enforce a configurable minimum confidence floor (default 55) below which no match is returned.

## Glossary

- **Bug_Condition (C)**: A screenshot containing a visible D2R tooltip where colored pixels from non-tooltip UI areas (inventory, character panel, UI chrome) fall within item-color tolerances, contaminating the bounding box sent to OCR
- **Property (P)**: The detection pipeline correctly identifies the tooltip region, extracts only the first line, and either returns a high-confidence match or emits `detection-failed` — never a garbage low-confidence match
- **Preservation**: All behavior for screenshots with no tooltip, high-confidence matches on clean images, and the existing parser/matcher logic for correctly extracted text must remain unchanged
- **`detect_item_text_region`**: The function in `src-tauri/src/screenshot/color_detector.rs` that crops and binarizes the item name region from a screenshot
- **`match_items`**: The function in `src-tauri/src/screenshot/matcher.rs` that fuzzy-matches parsed candidates against the item database
- **Tooltip background**: D2R tooltips have a near-black semi-transparent rectangular background (RGBA ≈ 0-20, 0-20, 0-20, 180-220) that is visually distinct from the game world
- **First line**: The topmost line of text within a tooltip — always the item name, rendered in the item's rarity color (orange for runes, gold for uniques, green for sets, etc.)

## Bug Details

### Bug Condition

The bug manifests when a screenshot contains a visible D2R tooltip AND the inventory panel or other UI elements also contain pixels within tolerance of a known item color. The `detect_item_text_region` function scans the top 50% of the entire image indiscriminately, so it collects matching pixels from both the tooltip AND non-tooltip UI areas. The resulting bounding box spans an overly wide region, and the binarized crop fed to OCR contains extraneous text/shapes that corrupt the OCR output.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ScreenshotImage
  OUTPUT: boolean

  tooltip := findTooltipRegion(input)
  colorPixels := scanTopHalf(input, ITEM_COLORS)
  tooltipPixels := filterPixelsInRegion(colorPixels, tooltip.bounds)
  contaminantPixels := colorPixels - tooltipPixels

  RETURN tooltip.exists
         AND contaminantPixels.count > 0
         AND boundingBox(colorPixels) != boundingBox(tooltipPixels)
END FUNCTION
```

### Examples

- **Lum Rune with inventory open**: Tooltip at (450,280)-(680,470) shows "Lum Rune" in orange. Inventory panel at (1100,200)-(1850,800) contains other items with orange text → current detector builds a bounding box spanning x:450-1850, OCR receives garbage, matcher returns "Ravenlore" at 42% confidence
- **Unique item with character panel**: Tooltip at center shows "Harlequin Crest" in gold. Character panel on left has gold-colored stat text → bounding box is too wide, OCR picks up stat text mixed with item name
- **Set item near stash**: Tooltip shows "Tal Rasha's Horadric Crest" in green. Stash tabs have green-tinted icons → green pixels from stash contaminate the crop
- **Edge case — no tooltip visible**: Screenshot of gameplay with no tooltip → no dark rectangular background detected → system correctly falls back to original behavior (returns full image, empty category)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When no tooltip is detected in the screenshot, the system must fall back to the original full-image scan (existing `detect_item_text_region` logic), returning the original image bytes with empty category and zero confidence boost
- When OCR correctly reads an item name and the matcher finds a match above the confidence floor, the match result format (category, subcategory, confidence score) must remain identical
- Text normalization (`normalize_text`), tooltip parsing (`parse_tooltip_text`), and OCR character normalization (`normalize_ocr_chars`) must produce identical output for identical input
- The 5-second pipeline timeout, SHA-256 deduplication, and event emission structure remain unchanged
- The `ScreenshotSettings` struct and persistence logic remain unchanged

**Scope:**
All inputs where the bug condition does NOT hold — images without tooltips, images where the tooltip is the only source of colored pixels, and all non-color-detection pipeline stages — must be completely unaffected by this fix.

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **No tooltip localization step**: `detect_item_text_region` jumps directly to color scanning without first identifying where the tooltip is. It treats the entire top half as a candidate region, which is correct only when the tooltip is the sole source of item-colored pixels.

2. **Bounding box includes all matching pixels globally**: The function computes a single min/max bounding box over ALL matching pixels in the scan region. When the inventory panel (right side) has orange/gold pixels, the bounding box stretches horizontally to include them, creating a very wide crop.

3. **No first-line isolation**: Even if the tooltip were correctly located, the current code captures ALL colored text within the bounding box (multiple tooltip lines including stats, sockets info, etc.), not just the first line (item name).

4. **No confidence floor in the pipeline**: `match_items` accepts `_threshold` but never uses it for filtering. The pipeline in `process_image` applies a hardcoded `> 30` filter, which is far too low — a 31% match is almost certainly garbage. The confidence floor should reject matches below ~55% as unreliable.

## Correctness Properties

Property 1: Bug Condition - Tooltip-First Detection Eliminates Contamination

_For any_ screenshot where a D2R tooltip is visible AND non-tooltip UI elements contain pixels within item-color tolerance, the fixed `detect_item_text_region` function SHALL first locate the tooltip bounding box via its dark background, then restrict color scanning exclusively to the first text line within that tooltip, producing a crop that contains only the item name text — no contamination from external UI elements.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - No-Tooltip Fallback Behavior

_For any_ screenshot where no D2R tooltip background is detected (the dark semi-transparent rectangle is absent), the fixed `detect_item_text_region` function SHALL produce the same result as the original function: returning the full original image bytes unmodified, with empty detected_category and zero confidence_boost.

**Validates: Requirements 3.1, 3.3**

Property 3: Confidence Floor - Garbage Match Rejection

_For any_ OCR text input where all fuzzy match scores against the item database fall below the minimum confidence floor (default 55), the pipeline SHALL emit `detection-failed` with reason "no_match" rather than returning a misleading low-confidence suggestion.

**Validates: Requirements 2.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src-tauri/src/screenshot/color_detector.rs`

**Function**: `detect_item_text_region`

**Specific Changes**:

1. **Add tooltip background detection** — New function `find_tooltip_bounds(rgba: &RgbaImage) -> Option<(u32, u32, u32, u32)>`:
   - Scan for contiguous rectangular regions of near-black pixels (R<25, G<25, B<25, A>170)
   - Use connected-component or row-scanning approach to find the largest dark rectangle
   - Minimum size threshold: at least 100px wide and 40px tall (rejects small dark UI elements)
   - Return the bounding box (min_x, min_y, max_x, max_y) or None if no tooltip found

2. **Add first-line extraction** — New function `extract_first_line_region(rgba: &RgbaImage, tooltip_bounds: (u32,u32,u32,u32), color: &ColorRange) -> Option<(u32,u32,u32,u32)>`:
   - Within the tooltip bounds, scan from the top for the first row of pixels matching the target item color
   - Find the vertical extent of this first text line (typically 15-25px tall at 1080p)
   - Return the tight bounding box around just the first line, or None if no colored text found in tooltip

3. **Modify `detect_item_text_region` control flow**:
   - First, call `find_tooltip_bounds` to attempt tooltip localization
   - If tooltip found: for each item color, call `extract_first_line_region` within tooltip bounds; select the color with the most matching first-line pixels; crop and binarize only that first-line region
   - If tooltip NOT found: fall through to the existing top-50% scan logic (preserves fallback behavior for non-tooltip images)

4. **Binarize only the first-line crop** — The existing `binarize_region` function is reused, but applied only to the smaller first-line crop instead of the full bounding box

5. **Add padding for OCR readability** — Add 5px padding around the first-line crop (clamped to tooltip bounds) to give the OCR engine some breathing room

**File**: `src-tauri/src/screenshot/matcher.rs`

**Function**: `match_items`

**Specific Changes**:

6. **Enforce minimum confidence floor** — Change the `_threshold` parameter (currently unused) to `min_confidence: u8`, and filter out all matches below this value before deduplication and sorting. Default value: 55.

**File**: `src-tauri/src/screenshot/monitor.rs`

**Function**: `process_image`

**Specific Changes**:

7. **Pass meaningful confidence floor to `match_items`** — Replace the hardcoded `> 30` filter with the settings-driven confidence floor passed to `match_items`. The pipeline filter becomes `> min_confidence` instead of `> 30`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Construct synthetic test images that simulate the contamination scenario — a small "tooltip" region with colored text plus a separate region with the same color pixels representing the inventory panel. Run `detect_item_text_region` on the unfixed code and observe that the resulting bounding box incorrectly spans both regions.

**Test Cases**:
1. **Contaminated Bounding Box Test**: Create a 1920x1080 synthetic image with orange pixels at (500,300) simulating tooltip text AND orange pixels at (1200,300) simulating inventory text. Assert that the unfixed code produces a crop wider than the tooltip region (will fail on unfixed code — demonstrating contamination)
2. **Multi-Color Contamination Test**: Create an image with green "Set" tooltip text on the left and green inventory elements on the right. Assert that the bounding box spans both (will fail on unfixed code)
3. **First-Line vs Full-Tooltip Test**: Create an image with a multi-line tooltip (item name + stats in different colors). Assert that only the first line is extracted (will fail on unfixed code — current code captures all matching pixels)
4. **Low Confidence Accepted Test**: Pass deliberately bad OCR text ("xqzpwlm") through `match_items` and observe that a match with score 31-40 is still returned (will demonstrate the missing confidence floor)

**Expected Counterexamples**:
- Bounding box includes pixels from both tooltip region AND a distant inventory region, resulting in a crop 2-3x wider than the actual tooltip
- Possible causes confirmed: global pixel scan without region constraint, no tooltip localization step

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := detect_item_text_region_fixed(input)
  tooltip_bounds := find_tooltip_bounds(input)
  ASSERT result.crop IS WITHIN tooltip_bounds
  ASSERT result.crop CONTAINS ONLY first_line_pixels
  ASSERT result.detected_category IS CORRECT for the item color
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT detect_item_text_region_original(input) = detect_item_text_region_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random images without tooltip backgrounds and verifies the fallback path is identical
- It tests the confidence floor boundary exhaustively across many random text inputs
- It catches edge cases in tooltip detection (very small dark regions, dark game world areas)

**Test Plan**: Observe behavior on UNFIXED code first for images without tooltips (should return original image), then write property-based tests capturing that exact behavior on the fixed code.

**Test Cases**:
1. **No-Tooltip Fallback Preservation**: Generate random images with no dark rectangular regions → verify fixed code returns identical output to original code (full image, empty category, zero boost)
2. **Clean Tooltip Preservation**: Generate images with a tooltip as the ONLY source of colored pixels (no inventory contamination) → verify the fixed code still detects the correct category
3. **Confidence Floor Boundary**: Generate random text strings and verify that matches with confidence >= 55 are returned and matches below 55 are rejected
4. **Parser/Matcher Preservation**: Verify that `parse_tooltip_text` and `normalize_text` produce identical output for identical input on both old and new code paths

### Unit Tests

- Test `find_tooltip_bounds` with synthetic images containing dark rectangles of various sizes
- Test `find_tooltip_bounds` returns None for images with no dark rectangles
- Test `find_tooltip_bounds` ignores small dark regions below the minimum size threshold
- Test `extract_first_line_region` correctly identifies the first row of colored text within a tooltip
- Test `extract_first_line_region` returns None when the tooltip has no pixels matching the target color
- Test `match_items` with `min_confidence=55` rejects matches at 54 and accepts at 55
- Test the full pipeline end-to-end with a synthetic tooltip image

### Property-Based Tests

- Generate random RGBA images with no dark rectangular backgrounds and verify `find_tooltip_bounds` returns None (no false positives)
- Generate random images with a planted dark rectangle and verify `find_tooltip_bounds` returns bounds that contain the planted rectangle
- Generate random text strings and verify the confidence floor correctly partitions matches into accepted/rejected sets
- Generate random images with uniform dark pixels below minimum size and verify tooltip detector ignores them

### Integration Tests

- Full pipeline test with a synthetic "clean tooltip" image → verify correct item detection
- Full pipeline test with a synthetic "contaminated" image → verify fixed code rejects contamination and detects correct item (or emits detection-failed)
- Test that the folder watcher and clipboard monitor paths both invoke the fixed `detect_item_text_region`
