# Bugfix Requirements Document

## Introduction

The screenshot item detection feature incorrectly identifies items because the color detector scans the top 50% of the entire screenshot for item-colored pixels rather than first locating the tooltip bounding box. This causes the system to pick up orange/colored pixels from the inventory panel, UI elements, and other non-tooltip areas. The resulting binarized crop fed to OCR contains irrelevant data, producing garbage text that the fuzzy matcher then matches to an incorrect item (e.g., "Ravenlore" instead of "Lum Rune"). Additionally, the fuzzy matcher always returns a result regardless of confidence level, meaning even very poor OCR output produces a misleading suggestion.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN taking a screenshot with a tooltip visible THEN the system scans the top 50% of the entire screenshot for item-colored pixels, picking up matching pixels from the inventory panel, UI chrome, and other non-tooltip areas

1.2 WHEN the color detector finds pixels from non-tooltip areas THEN the system computes a bounding box that spans unrelated UI regions instead of the tooltip

1.3 WHEN the binarized crop contains non-tooltip pixels THEN the OCR engine receives a garbage image region and produces incorrect text

1.4 WHEN the OCR produces garbage text THEN the fuzzy matcher always returns the "best" match regardless of how low the confidence score is, resulting in a completely wrong item suggestion (e.g., "Ravenlore" instead of "Lum Rune")

### Expected Behavior (Correct)

2.1 WHEN taking a screenshot with a tooltip visible THEN the system SHALL first locate the tooltip bounding box by detecting the distinctive dark semi-transparent rectangular background before searching for item-colored text

2.2 WHEN a tooltip bounding box is detected THEN the system SHALL restrict color detection to only the first line of text within that tooltip region, ignoring all pixels outside the tooltip

2.3 WHEN the tooltip region is correctly isolated THEN the system SHALL binarize only the first-line text area within the tooltip, producing a clean crop containing only the item name for OCR

2.4 WHEN the fuzzy matcher receives OCR text THEN the system SHALL reject matches below a minimum confidence threshold (returning no match rather than a misleading low-confidence suggestion)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN no tooltip is visible in the screenshot THEN the system SHALL CONTINUE TO return a no-match / detection-failed result (existing fallback behavior)

3.2 WHEN the OCR correctly reads an item name and the fuzzy matcher finds a high-confidence match THEN the system SHALL CONTINUE TO return that match with the correct category and confidence score

3.3 WHEN the screenshot contains no pixels matching any known D2R item color THEN the system SHALL CONTINUE TO return the original image as fallback with empty category and zero confidence boost

3.4 WHEN text normalization and tooltip parsing are applied to correctly extracted text THEN the system SHALL CONTINUE TO produce valid normalized candidates with rarity labels stripped
