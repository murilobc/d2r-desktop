# Bugfix Requirements Document

## Introduction

The screenshot item detection pipeline (`detect_item_text_region` in `color_detector.rs`) has never correctly identified item names in D2R screenshots. Two previous approaches have failed:

1. **Top-50% color scan** — picks up colored pixels from inventory panels, ground labels, and UI elements, sending garbage to OCR.
2. **Dark rectangle detection (`find_tooltip_bounds`)** — the D2R inventory panel is also a large dark rectangle, and when the tooltip overlaps it their backgrounds merge, making it impossible to isolate the tooltip by its background alone.

The fundamental insight from successful D2R image processing libraries (d2r_image, D2R-AI-Item-Tracker) is that **the item name text itself is the signal, not the background**. The item name is always rendered at the top of the tooltip in the rarity color of the item (white, gray, blue, yellow, green, gold, or orange for runes/crafted). The correct approach uses spatial clustering of colored pixels to find the single horizontal text line that represents the item name, then crops and binarizes only that cluster for OCR.

Additionally, the matcher lacks an exact-match fast path and uses a static confidence floor that performs poorly on both short item names (runes like "Lum") and long names.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a D2R tooltip is visible AND the inventory panel or other UI elements contain pixels within item-color tolerance THEN the system selects the largest dark rectangle (often the inventory panel) as the "tooltip" via `find_tooltip_bounds`, extracts the wrong first line, and returns an incorrect item name or "No item detected"

1.2 WHEN a D2R tooltip overlaps or is positioned inside the inventory panel THEN the system cannot distinguish the tooltip background from the inventory background because their dark pixels merge into a single contiguous region, causing `find_tooltip_bounds` to return bounds that encompass both

1.3 WHEN no tooltip dark rectangle is detected (fallback path) THEN the system scans the entire top 50% of the image for colored pixels, collecting noise from ground labels, chat text, and inventory slot names, producing a contaminated bounding box sent to OCR

1.4 WHEN the OCR receives a contaminated or oversized crop THEN the fuzzy matcher returns a garbage match (e.g., "Ravenlore" instead of "Lum Rune") because there is no exact-match fast path to short-circuit the fuzzy comparison

1.5 WHEN the item name is short (e.g., rune names "Ber", "Jah", "Lum" at 3-4 characters) THEN the static confidence floor (55%) combined with Levenshtein distance unreliably rejects false positives because short strings have high normalized similarity to many database entries

1.6 WHEN the OCR returns multi-word text like "Lum Rune" THEN the parser may not try matching the full concatenated string against the database, missing an exact match opportunity

### Expected Behavior (Correct)

2.1 WHEN a D2R tooltip is visible AND non-tooltip UI elements contain same-color pixels THEN the system SHALL use spatial clustering of colored pixels to identify the item name as a tight horizontal text-line cluster, ignoring scattered pixels from inventory slots and UI elements that form different spatial patterns

2.2 WHEN a D2R tooltip overlaps or is positioned inside the inventory panel THEN the system SHALL still correctly isolate the item name cluster because clustering relies on the spatial pattern of the text pixels (a single continuous horizontal band), not on detecting a background rectangle

2.3 WHEN multiple colored elements exist on screen (ground labels, chat text, inventory names) THEN the system SHALL evaluate each cluster by quality metrics (aspect ratio width/height > 3, pixel density > 20%, size between 50-500px wide and 10-35px tall scaled by resolution) and select the cluster most consistent with a single line of item name text

2.3.1 WHEN searching for item name text THEN the system SHALL scan for ALL D2R item rarity colors: white (Normal/Inferior/Superior), gray (Socketed/Ethereal), blue (Magic), yellow (Rare), green (Set), gold/dark-bronze (Unique), and orange (Rune/Crafted) — since any item tier can appear in a tooltip

2.4 WHEN a valid item-name text cluster is identified THEN the system SHALL crop only that cluster with small padding, binarize it (matching pixels → white, rest → black), and send it to OCR — producing a clean crop containing only the item name

2.5 WHEN the OCR text is an exact case-insensitive match to any item in the database THEN the system SHALL return that item immediately at 100% confidence without performing fuzzy matching

2.6 WHEN the item name is short (fewer than 6 characters) THEN the system SHALL apply a higher confidence floor (70%) for fuzzy matches to compensate for Levenshtein distance unreliability on short strings

2.7 WHEN the item name is 6 or more characters THEN the system SHALL apply a lower confidence floor (50%) for fuzzy matches to avoid rejecting valid longer item names that may have minor OCR errors

2.8 WHEN no valid text-line cluster is found for any item color THEN the system SHALL return the full original image data with empty category and zero confidence boost (preserving fallback behavior)

2.9 WHEN processing screenshots at different resolutions (720p, 1080p, 1440p, 4K) THEN the system SHALL scale cluster size thresholds proportionally to the image height so detection works consistently across all supported resolutions

### Unchanged Behavior (Regression Prevention)

3.1 WHEN no colored pixels matching any known D2R item color are found in the image THEN the system SHALL CONTINUE TO return the full original image bytes with empty detected_category and zero confidence_boost

3.2 WHEN OCR correctly extracts an item name and the matcher finds a match above the confidence floor THEN the system SHALL CONTINUE TO return the match result in the same format (item_name, category, subcategory, confidence)

3.3 WHEN the text normalization function `normalize_text` is called THEN the system SHALL CONTINUE TO produce identical output for identical input (trim, collapse spaces, strip invalid characters, preserve hyphens and apostrophes)

3.4 WHEN the tooltip parser `parse_tooltip_text` is called THEN the system SHALL CONTINUE TO extract primary and secondary candidates, strip rarity label prefixes, and skip rarity-only lines identically

3.5 WHEN the OCR character normalization `normalize_ocr_chars` is called THEN the system SHALL CONTINUE TO map '0'→'O', '1'→'l', 'I'→'l' identically

3.6 WHEN the pipeline timeout of 5 seconds is exceeded THEN the system SHALL CONTINUE TO emit `detection-failed` with reason "timeout"

3.7 WHEN the SHA-256 deduplication detects a duplicate image THEN the system SHALL CONTINUE TO skip processing without emitting any event

3.8 WHEN the `ScreenshotSettings` struct is serialized or deserialized THEN the system SHALL CONTINUE TO persist and restore all fields identically
