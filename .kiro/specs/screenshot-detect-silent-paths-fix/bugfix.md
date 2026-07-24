# Bugfix Requirements Document

## Introduction

The "Detect Screenshot" button in the sidebar provides no visual feedback when certain failure paths are hit in the Rust backend's `process_image` function. A previous fix (screenshot-detect-no-feedback-fix) addressed the frontend-only "no_image" case, but three additional paths in the backend return silently without emitting any Tauri event — leaving the user with no indication that anything happened. These silent paths are: OCR engine initialization failure, OCR text extraction failure, and the case where parsed tooltip candidates are empty (OCR found text but it doesn't resemble D2R item tooltip text). The last case is likely the most commonly encountered, since users may have arbitrary non-game images in their clipboard.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user clicks "Detect Screenshot" and the clipboard image triggers an OCR engine initialization failure (`OcrEngine::new()` returns Err) THEN the system prints an error to stderr and returns without emitting any event, providing no visual feedback to the user

1.2 WHEN the user clicks "Detect Screenshot" and the clipboard image triggers an OCR text extraction failure (`engine.extract_text()` returns Err) THEN the system prints an error to stderr and returns without emitting any event, providing no visual feedback to the user

1.3 WHEN the user clicks "Detect Screenshot" and OCR extracts text but `parse_tooltip_text()` returns an empty candidate list (the text does not resemble D2R tooltip text) THEN the system returns without emitting any event, providing no visual feedback to the user

### Expected Behavior (Correct)

2.1 WHEN the user clicks "Detect Screenshot" and OCR engine initialization fails THEN the system SHALL emit a `screenshot:detection-failed` event with reason "ocr_init_failed" and a descriptive message, so the toast system displays feedback to the user

2.2 WHEN the user clicks "Detect Screenshot" and OCR text extraction fails THEN the system SHALL emit a `screenshot:detection-failed` event with reason "ocr_failed" and a descriptive message, so the toast system displays feedback to the user

2.3 WHEN the user clicks "Detect Screenshot" and OCR extracts text but `parse_tooltip_text()` returns an empty candidate list THEN the system SHALL emit a `screenshot:detection-failed` event with reason "no_candidates" and a descriptive message, so the toast system displays feedback to the user

2.4 WHEN the frontend receives a `screenshot:detection-failed` event with reason "ocr_init_failed", "ocr_failed", or "no_candidates" THEN the system SHALL display a user-friendly toast message mapped from the reason code via the `REASON_MESSAGES` map

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the clipboard contains a valid image and detection succeeds (item detected above confidence threshold) THEN the system SHALL CONTINUE TO emit the `screenshot:item-detected` event and display the ConfirmationDialog with match candidates

3.2 WHEN the clipboard contains a valid image but OCR extracts no text (`raw_text.is_empty()`) THEN the system SHALL CONTINUE TO emit `screenshot:detection-failed` with reason "no_text" and display the toast "No text detected in screenshot"

3.3 WHEN the clipboard contains a valid image but no item match scores above 30 (`above_30.is_empty()`) THEN the system SHALL CONTINUE TO emit `screenshot:detection-failed` with reason "no_match" and display the toast "No item detected in screenshot"

3.4 WHEN the clipboard contains no image data THEN the system SHALL CONTINUE TO surface the "No image found in clipboard" feedback via the existing frontend error handling path

---

### Bug Condition (Structured Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ClipboardDetectionInput
  OUTPUT: boolean

  // Returns true when the clipboard image hits one of the three silent failure paths
  RETURN (X.ocrEngineInitFails = TRUE)
      OR (X.ocrExtractionFails = TRUE)
      OR (X.hasImage = TRUE AND X.ocrText ≠ EMPTY AND X.parsedCandidates = EMPTY)
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking - All silent failure paths now emit detection-failed events
FOR ALL X WHERE isBugCondition(X) DO
  result ← process_image'(X)
  ASSERT event_emitted(result, "screenshot:detection-failed")
  ASSERT result.reason IN {"ocr_init_failed", "ocr_failed", "no_candidates"}
  ASSERT toast_displayed(result.reason)
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking - Non-buggy paths remain unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT process_image(X) = process_image'(X)
END FOR
```

**Key Definitions:**
- **F** (`process_image`): The original function that silently returns on OCR init failure, OCR extraction failure, and empty parsed candidates
- **F'** (`process_image'`): The fixed function that emits `screenshot:detection-failed` events with appropriate reason codes for all three silent paths
