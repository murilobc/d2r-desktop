# Screenshot Detection Rewrite Bugfix Design

## Overview

The screenshot item detection pipeline has failed with two previous approaches (top-50% color scan and dark rectangle detection) because both attempt to identify the tooltip by its **background** rather than by the text itself. The correct approach, validated by successful D2R image processing libraries, is **spatial clustering of colored pixels** — find the item name by locating a tight horizontal band of same-colored pixels that matches the spatial signature of rendered text.

This fix completely replaces `detect_item_text_region` with a clustering algorithm, removes the defunct `find_tooltip_bounds` and `extract_first_line_region` functions, and improves the matcher with exact-match fast path, dynamic confidence floors, and multi-word matching strategies.

## Glossary

- **Bug_Condition (C)**: The condition under which detection fails — when non-tooltip UI elements (inventory, ground labels, chat) contain pixels of the same color as item names, or when the tooltip background merges with the inventory panel background
- **Property (P)**: The desired behavior — correctly isolating the item name text cluster using spatial clustering, regardless of surrounding UI noise
- **Preservation**: Existing behavior that must remain unchanged — fallback on no-match images, match result format, text normalization, parser behavior, OCR character normalization, pipeline timeout, SHA-256 dedup, settings serialization
- **`detect_item_text_region`**: The function in `color_detector.rs` that processes a screenshot PNG and returns a cropped/binarized region for OCR
- **`match_items`**: The function in `matcher.rs` that fuzzy-matches OCR text against the item database
- **Spatial Cluster**: A group of same-colored pixels that are horizontally connected (within ~5px) on the same or adjacent rows, forming a contiguous region
- **Aspect Ratio**: Width / height of a cluster's bounding box — text lines are typically 5-20x wider than tall
- **Pixel Density**: Ratio of matching pixels to bounding box area — text typically fills 20-50%

## Bug Details

### Bug Condition

The bug manifests when a D2R screenshot contains colored pixels from non-tooltip sources (inventory panel items, ground labels, chat text) that confuse the detection algorithm, OR when the tooltip overlaps the inventory panel making background-based detection impossible. The `detect_item_text_region` function either selects the wrong region (inventory panel via `find_tooltip_bounds`) or aggregates scattered noise pixels (via top-50% scan), sending garbage to OCR.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ScreenshotImage
  OUTPUT: boolean
  
  RETURN (tooltipIsVisible(input) AND nonTooltipColoredPixelsExist(input))
         OR (tooltipIsVisible(input) AND tooltipOverlapsInventory(input))
         OR (tooltipIsVisible(input) AND ocrTextIsShort(extractedText) AND fuzzyMatchIsUnreliable(extractedText))
END FUNCTION
```

The secondary bug condition for the matcher:
```
FUNCTION isMatcherBugCondition(input)
  INPUT: input of type OcrText
  OUTPUT: boolean
  
  RETURN (exactMatchExists(input, database) AND fuzzyMatchReturnsWrongResult(input))
         OR (length(input) < 6 AND staticConfidenceFloorIsTooLow())
         OR (input contains multiple words AND fullStringNotTried(input))
END FUNCTION
```

### Examples

- **Unique item with inventory open**: Tooltip shows "Harlequin Crest" in gold, but inventory contains gold-colored unique items. Old approach: `find_tooltip_bounds` selects the inventory panel as the "tooltip" → OCR reads random inventory text → matcher returns wrong item.
- **Rune tooltip overlapping inventory**: "Ber Rune" tooltip appears over the dark inventory panel. Old approach: dark backgrounds merge into one rectangle → `find_tooltip_bounds` returns bounds encompassing both → `extract_first_line_region` picks wrong text.
- **Short rune name**: OCR correctly reads "Lum" but the static 55% confidence floor means "Lum" matches many short database entries with high normalized Levenshtein scores → wrong match returned instead of exact "Lum Rune".
- **Ground labels present**: Multiple ground labels in Set green color scattered across the screen. Old approach: top-50% scan aggregates all green pixels → bounding box is enormous → OCR reads garbage.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When no colored pixels match any known D2R item color, return full original image with empty category and zero confidence boost
- Match results continue to use the same `MatchCandidate` struct format (item_name, category, subcategory, confidence)
- `normalize_text` function produces identical output for identical input
- `parse_tooltip_text` extracts primary and secondary candidates identically
- `normalize_ocr_chars` maps '0'→'O', '1'→'l', 'I'→'l' identically
- Pipeline timeout of 5 seconds and `detection-failed` emission unchanged
- SHA-256 deduplication behavior unchanged
- `ScreenshotSettings` serialization/deserialization unchanged
- `binarize_region` function behavior unchanged (matching pixels → white, rest → black)
- `pixel_matches` function behavior unchanged
- `ITEM_COLORS` constant values preserved (with addition of gray for Socketed/Ethereal)

**Scope:**
All inputs that do NOT trigger the bug condition (images with no tooltip, images where the correct item is already being detected) should produce the same results after the fix. The fix targets ONLY the region-selection logic and matcher confidence behavior.

## Hypothesized Root Cause

Based on the bug description and two failed approaches, the root causes are:

1. **Fundamentally Wrong Signal (Background vs Text)**: Both previous approaches try to find the tooltip by its dark background. This fails because (a) the inventory panel is also dark, (b) tooltip backgrounds merge with inventory backgrounds, and (c) no reliable way exists to distinguish "tooltip dark" from "inventory dark". The item name text color IS the reliable signal — it's a unique horizontal band of colored pixels.

2. **No Spatial Filtering**: The legacy fallback aggregates ALL matching-color pixels into one bounding box without considering their spatial distribution. Scattered pixels from inventory slots, ground labels, and chat form very different spatial patterns than a single text line, but the current code doesn't distinguish them.

3. **No Exact Match Fast Path in Matcher**: When OCR perfectly reads "Ber" or "Lum Rune", the matcher still runs expensive fuzzy comparison against 800+ items. For short strings, Levenshtein distance is unreliable — "Ber" is close to "Ber Rune", "Breath", "Beast", etc.

4. **Static Confidence Floor**: The fixed 55% threshold works poorly at both extremes — too low for short names (allowing garbage matches) and potentially too high for longer names with minor OCR errors.

5. **Single-Strategy Matching**: The matcher only tries the full OCR string. It doesn't try individual words ("Lum" from "Lum Rune"), word combinations, or the "X Rune" pattern for short text.

## Correctness Properties

Property 1: Bug Condition - Spatial Clustering Isolates Item Name Text

_For any_ screenshot where a D2R tooltip is visible AND non-tooltip colored pixels exist (inventory, ground labels, chat), the fixed `detect_item_text_region` function SHALL identify the item name as the cluster with the best combination of text-like aspect ratio (width >> height), appropriate pixel density (20-50%), and valid size constraints — ignoring scattered or non-text-shaped pixel groups.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - No-Match Fallback Behavior

_For any_ image containing no pixels within tolerance of any known D2R item color, the fixed `detect_item_text_region` function SHALL produce the same result as the original function: returning the full original image data byte-for-byte with empty `detected_category` and zero `confidence_boost`.

**Validates: Requirements 3.1**

Property 3: Bug Condition - Exact Match Fast Path

_For any_ OCR text that is an exact case-insensitive match to any item in the database (after normalization), the fixed matcher SHALL return that item immediately at 100% confidence without fuzzy matching, preventing incorrect fuzzy results from overriding correct exact matches.

**Validates: Requirements 2.5**

Property 4: Bug Condition - Dynamic Confidence Floor

_For any_ OCR text shorter than 6 characters, the fixed matcher SHALL apply a 70% confidence floor (rejecting unreliable short-string fuzzy matches), AND for text 6+ characters the fixed matcher SHALL apply a 50% confidence floor (allowing valid longer matches with minor OCR errors).

**Validates: Requirements 2.6, 2.7**

Property 5: Preservation - Binarization Output Validity

_For any_ RGBA image input and any ColorRange, `binarize_region` SHALL produce a grayscale image of the same dimensions where every pixel is either 0 or 255, preserving existing behavior unchanged by the refactor.

**Validates: Requirements 3.2**

Property 6: Bug Condition - Resolution-Independent Detection

_For any_ screenshot at resolutions from 720p to 4K, the fixed `detect_item_text_region` function SHALL scale all pixel-based thresholds (cluster size constraints, connectivity distance, padding) proportionally to image height, producing consistent detection results across resolutions.

**Validates: Requirements 2.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src-tauri/src/screenshot/color_detector.rs`

**Functions to DELETE**:
- `find_tooltip_bounds` — completely remove (background-based detection doesn't work)
- `extract_first_line_region` — completely remove (depends on tooltip bounds)
- `is_dark_pixel` — completely remove (no longer needed)

**Functions to KEEP**:
- `pixel_matches` — still needed for color matching within clusters
- `binarize_region` — still needed for final output
- `ITEM_COLORS` — keep but add gray color entry for Socketed/Ethereal items

**Function to REWRITE**: `detect_item_text_region`

**New Algorithm (Spatial Clustering)**:

1. **Add Gray to ITEM_COLORS**:
   - `ColorRange { r_center: 148, g_center: 148, b_center: 148, tolerance: 20, category: "Socketed" }`

2. **Resolution Scaling**:
   - `scale_factor = image_height as f64 / 1080.0`
   - All thresholds multiplied by scale_factor

3. **Per-Color Pixel Scan**:
   - For each color in `ITEM_COLORS`, scan ENTIRE image
   - Collect all matching pixel coordinates into a Vec<(u32, u32)>

4. **Horizontal Connectivity Clustering**:
   - Sort pixels by (y, x)
   - Group pixels that are within `(5.0 * scale_factor).round() as u32` pixels horizontally on same row into row-segments
   - Merge row-segments across adjacent rows (within 2px vertical gap) if they overlap horizontally → forms clusters

5. **Cluster Quality Scoring**:
   - For each cluster, compute bounding box (min_x, min_y, max_x, max_y)
   - `width = max_x - min_x + 1`, `height = max_y - min_y + 1`
   - `aspect_ratio = width as f64 / height as f64`
   - `density = pixel_count as f64 / (width * height) as f64`
   - Size constraints (scaled):
     - `min_width = (image_height as f64 * 0.03).round() as u32`
     - `max_width = (image_height as f64 * 0.35).round() as u32`
     - `min_height = (image_height as f64 * 0.01).round() as u32`
     - `max_height = (image_height as f64 * 0.03).round() as u32`
   - Reject if outside size constraints
   - `aspect_ratio_score`: 1.0 if 4-15, 0.5 if 3-4 or 15-25, 0.0 otherwise
   - `density_score`: 1.0 if 15-60%, 0.5 if 10-15% or 60-80%, 0.0 otherwise
   - `score = pixel_count as f64 * aspect_ratio_score * density_score`
   - Reject if score = 0.0

6. **Select Best Cluster**:
   - Across all colors, pick the cluster with highest score
   - Record its color index and bounding box

7. **Crop and Binarize**:
   - Pad bounding box by `(5.0 * scale_factor).round() as u32` (clamped to image bounds)
   - Crop RGBA sub-image
   - Binarize with `binarize_region`
   - Encode to PNG
   - Return `ColorDetectionResult` with `confidence_boost: 15`

8. **Fallback**:
   - If no valid cluster found for any color, return full original image with empty category and zero confidence boost

---

**File**: `src-tauri/src/screenshot/matcher.rs`

**Function**: `match_items`

**Specific Changes**:

1. **Exact Match Fast Path** (before fuzzy matching loop):
   - For each candidate, normalize text (trim, lowercase, `normalize_ocr_chars`)
   - Check if normalized text exactly equals any `item.normalized_name` in database
   - If exact match found → return immediately with confidence=100

2. **"X Rune" Pattern** (after exact match fails):
   - If text length < 5 and no exact match, try `format!("{} rune", text)` normalized
   - Check for exact match with this appended form
   - If found → return with confidence=100

3. **Dynamic Confidence Floor**:
   - Replace the static `min_confidence` parameter usage:
   - `effective_floor = if text.len() < 6 { max(min_confidence, 70) } else { max(min_confidence, 50) }`
   - Apply this per-candidate in the filter step

4. **Multi-Word Matching**:
   - For each candidate text, compute fuzzy scores for:
     - (a) Full text as-is
     - (b) Each individual word (split by space)
     - (c) First N words combined (for N = 1..word_count-1)
   - For each item, take the maximum confidence across all sub-strategies
   - This catches "Lum Rune" matching "Lum Rune" even if the parser sends parts separately

---

**File**: `src-tauri/src/screenshot/monitor.rs`

**Minor Change**: No code changes needed — `monitor.rs` already passes `min_confidence` to `match_items`, and the dynamic floor logic lives inside `match_items`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Create synthetic test images that simulate the bug conditions (colored pixels scattered across the image, dark rectangles that confuse `find_tooltip_bounds`, short rune names). Run detection on unfixed code to observe failures.

**Test Cases**:
1. **Inventory Overlap Test**: Create image with a dark rectangle (simulating inventory) AND a small text-line of gold pixels. Current code will select the large dark rectangle. (will fail on unfixed code)
2. **Scattered Pixels Test**: Create image with same-color pixels scattered across top 50% in non-text patterns. Current code will aggregate them into a large bounding box. (will fail on unfixed code)
3. **Short Rune Name Test**: Feed "Lum" to matcher with 55% floor — observe that wrong matches appear above threshold. (will fail on unfixed code)
4. **Exact Match Bypass Test**: Feed "Ber Rune" text directly — observe that fuzzy matching produces suboptimal results compared to an exact match. (will fail on unfixed code)

**Expected Counterexamples**:
- `find_tooltip_bounds` returns inventory panel bounds instead of tooltip bounds
- Legacy scan produces bounding box 500px+ wide encompassing multiple scattered sources
- Matcher returns wrong item for "Lum" because "Lum" is Levenshtein-close to many 3-4 char substrings
- Possible causes: wrong signal (background vs text), no spatial filtering, no exact-match path

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := detect_item_text_region_fixed(input)
  cluster := selectedCluster(result)
  ASSERT cluster.aspect_ratio IN [3.0, 25.0]
  ASSERT cluster.density IN [0.10, 0.80]
  ASSERT cluster.width IN [min_width, max_width]
  ASSERT cluster.height IN [min_height, max_height]
  ASSERT result.detected_category != ""
END FOR

FOR ALL text WHERE isMatcherBugCondition(text) DO
  result := match_items_fixed(text)
  IF exactMatchExists(text, database) THEN
    ASSERT result.confidence == 100
    ASSERT result.item_name == exactMatch(text, database)
  END IF
  IF length(text) < 6 THEN
    ASSERT ALL fuzzy_matches have confidence >= 70
  END IF
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
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for no-match images and valid single-cluster images, then write property-based tests capturing that behavior.

**Test Cases**:
1. **No-Match Preservation**: Images with no pixels matching any D2R color → must return original bytes unchanged (already tested by existing prop test)
2. **Binarization Preservation**: `binarize_region` output must be pure binary (0 or 255) for any input (already tested by existing prop test)
3. **Text Normalization Preservation**: `normalize_text` must produce valid canonical output for any input (already tested by existing prop test)
4. **Parser Preservation**: `parse_tooltip_text` must extract candidates identically for any input text

### Unit Tests

- Test clustering with synthetic images containing a single horizontal text line
- Test clustering with synthetic images containing scattered noise + one text cluster
- Test cluster scoring: verify aspect ratio scoring boundaries (3, 4, 15, 25)
- Test cluster scoring: verify density scoring boundaries (10%, 15%, 60%, 80%)
- Test resolution scaling at 720p, 1080p, 1440p, 4K
- Test exact match fast path with known item names
- Test "X Rune" pattern for short rune names
- Test dynamic confidence floor thresholds (< 6 chars → 70%, ≥ 6 chars → 50%)
- Test multi-word matching strategies

### Property-Based Tests

- Generate random images with a single horizontal band of colored pixels → verify clustering finds it and produces valid scores
- Generate random item names from database → verify exact match returns 100% confidence
- Generate random short strings (< 6 chars) → verify confidence floor is 70%
- Generate random long strings (≥ 6 chars) → verify confidence floor is 50%
- Generate random image dimensions (720p-4K) → verify thresholds scale proportionally

### Integration Tests

- Full pipeline test: synthetic screenshot with known item text → verify correct item detected
- Full pipeline test: synthetic screenshot with noise + item text → verify clustering selects item text over noise
- Full pipeline test: rune name "Ber" through entire pipeline → verify "Ber Rune" returned at 100% confidence
- Full pipeline test: multi-word item name through matcher → verify highest-confidence result selected
