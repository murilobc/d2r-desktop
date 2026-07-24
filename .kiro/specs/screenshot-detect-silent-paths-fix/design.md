# Screenshot Detect Silent Paths Fix — Bugfix Design

## Overview

The `process_image` function in the Rust backend has three failure paths that return silently without emitting any Tauri event, leaving the user with no feedback after clicking "Detect Screenshot." The fix adds `screenshot:detection-failed` event emissions (with distinct reason codes) to each silent path, and maps those reason codes to user-friendly messages in the frontend toast system. The change is minimal and follows the exact pattern already used for the `no_text` and `no_match` cases.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — clipboard image processing hits one of the three silent return paths (OCR init failure, OCR extraction failure, empty parsed candidates)
- **Property (P)**: The desired behavior when C holds — the backend emits a `screenshot:detection-failed` event with an appropriate reason code, and the frontend displays a mapped toast message
- **Preservation**: Existing behavior for non-buggy paths (successful detection, no_text, no_match, no_image) that must remain unchanged
- **process_image**: The function in `src-tauri/src/screenshot/monitor.rs` that runs OCR, parses tooltip text, matches items, and emits detection events
- **useDetectionToast**: The React hook in `src/hooks/useDetectionToast.ts` that listens for `screenshot:detection-failed` events and displays toast notifications
- **REASON_MESSAGES**: The `Record<string, string>` map in `useDetectionToast.ts` that translates reason codes to user-facing messages
- **DetectionFailedPayload**: The Rust struct `{ reason: String, message: String }` emitted with each `screenshot:detection-failed` event

## Bug Details

### Bug Condition

The bug manifests when the clipboard image triggers one of three failure paths in `process_image` that currently return early without emitting any event. The user clicks "Detect Screenshot," processing starts, but no event reaches the frontend — resulting in zero visual feedback.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ClipboardDetectionInput
  OUTPUT: boolean

  RETURN input.ocrEngineInitFails = TRUE
      OR input.ocrExtractionFails = TRUE
      OR (input.hasImage = TRUE
          AND input.ocrText ≠ EMPTY
          AND parsedCandidates(input.ocrText) = EMPTY)
END FUNCTION
```

### Examples

- **OCR init failure**: User clicks "Detect Screenshot" with a valid image in clipboard, but system resources prevent OCR engine instantiation → current: silent return, no toast; expected: toast "Screenshot analysis failed — please try again"
- **OCR extraction failure**: User clicks "Detect Screenshot" with a corrupted/unsupported image format that causes `extract_text()` to error → current: silent return, no toast; expected: toast "Could not read text from screenshot"
- **Empty parsed candidates**: User screenshots a non-game window (e.g., browser, chat) — OCR extracts text but `parse_tooltip_text()` returns empty because none of it resembles D2R tooltip format → current: silent return, no toast; expected: toast "No D2R item tooltip detected in image"
- **Edge case — partial tooltip**: User screenshots a partially obscured tooltip where OCR extracts a few characters but `parse_tooltip_text()` finds no valid structure → same as empty candidates case

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful item detection continues to emit `screenshot:item-detected` and show the ConfirmationDialog
- Empty OCR text (`raw_text.is_empty()`) continues to emit `screenshot:detection-failed` with reason `no_text`
- No items above confidence threshold continues to emit `screenshot:detection-failed` with reason `no_match`
- Clipboard with no image data continues to surface "No image found in clipboard" via existing frontend error handling
- The `mapReasonToMessage` fallback ("Screenshot detection failed") continues to work for any unknown reason codes

**Scope:**
All inputs that do NOT hit the three silent return paths should be completely unaffected by this fix. This includes:
- Images that successfully pass through the full detection pipeline
- Images that produce empty OCR text (already handled)
- Images that produce matches below threshold (already handled)
- Clipboard states with no image data (handled in frontend)

## Hypothesized Root Cause

Based on the code analysis of `process_image`, the root cause is clear — it is not a logic error but missing event emissions:

1. **OCR init failure path (line ~212)**: The `Err` branch of `OcrEngine::new()` prints to stderr and returns. No `app_handle.emit(...)` call exists in this branch.

2. **OCR extraction failure path (line ~219)**: The `Err` branch of `engine.extract_text()` prints to stderr and returns. No `app_handle.emit(...)` call exists in this branch.

3. **Empty parsed candidates path (line ~237)**: After `parse_tooltip_text(&raw_text)` returns an empty vec, the code checks `parsed_candidates.is_empty()` and returns. No event emission exists here — unlike the analogous `raw_text.is_empty()` and `above_30.is_empty()` checks which do emit events.

The root cause is straightforward: when these three paths were originally written, the detection-failed event system did not yet exist. The `no_text` and `no_match` emissions were added later but these three paths were overlooked.

## Correctness Properties

Property 1: Bug Condition — Silent Failure Paths Emit Events

_For any_ input where the bug condition holds (isBugCondition returns true — OCR init fails, OCR extraction fails, or parsed candidates are empty), the fixed `process_image` function SHALL emit a `screenshot:detection-failed` event with the corresponding reason code (`ocr_init_failed`, `ocr_failed`, or `no_candidates`) and a descriptive message string.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Non-Silent Paths Unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false — successful detection, empty OCR text, no match above threshold, or no image), the fixed code SHALL produce exactly the same events, payloads, and side effects as the original code, preserving all existing detection and failure feedback behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

The root cause is confirmed — three missing event emissions. The fix follows the identical pattern used for `no_text` and `no_match`.

**File**: `src-tauri/src/screenshot/monitor.rs`

**Function**: `process_image`

**Specific Changes**:

1. **OCR init failure branch** — Add event emission after the `eprintln!`:
   ```rust
   Err(e) => {
       eprintln!("[ClipboardMonitor] OCR init failed: {}", e);
       let payload = DetectionFailedPayload {
           reason: "ocr_init_failed".to_string(),
           message: format!("OCR engine initialization failed: {}", e),
       };
       if let Err(emit_err) = app_handle.emit("screenshot:detection-failed", &payload) {
           eprintln!("[ClipboardMonitor] Failed to emit detection-failed event: {}", emit_err);
       }
       return;
   }
   ```

2. **OCR extraction failure branch** — Add event emission after the `eprintln!`:
   ```rust
   Err(e) => {
       eprintln!("[ClipboardMonitor] OCR extraction failed: {}", e);
       let payload = DetectionFailedPayload {
           reason: "ocr_failed".to_string(),
           message: format!("OCR text extraction failed: {}", e),
       };
       if let Err(emit_err) = app_handle.emit("screenshot:detection-failed", &payload) {
           eprintln!("[ClipboardMonitor] Failed to emit detection-failed event: {}", emit_err);
       }
       return;
   }
   ```

3. **Empty parsed candidates check** — Add event emission before the return:
   ```rust
   if parsed_candidates.is_empty() {
       let payload = DetectionFailedPayload {
           reason: "no_candidates".to_string(),
           message: "OCR text did not match D2R tooltip format".to_string(),
       };
       if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
           eprintln!("[ClipboardMonitor] Failed to emit detection-failed event: {}", e);
       }
       return;
   }
   ```

**File**: `src/hooks/useDetectionToast.ts`

**Object**: `REASON_MESSAGES`

**Specific Changes**:

4. **Add three new entries** to the `REASON_MESSAGES` map:
   ```typescript
   const REASON_MESSAGES: Record<string, string> = {
     no_image: "No image found in clipboard",
     no_text: "No text detected in screenshot",
     no_match: "No item detected in screenshot",
     ocr_init_failed: "Screenshot analysis failed — please try again",
     ocr_failed: "Could not read text from screenshot",
     no_candidates: "No D2R item tooltip detected in image",
   };
   ```

5. **No other changes needed** — the existing `listen` handler and `mapReasonToMessage` function already handle any reason code present in `REASON_MESSAGES`.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (silent returns with no events), then verify the fix emits events correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the three paths currently emit no events.

**Test Plan**: Write Rust unit tests that call `process_image` with inputs that trigger each silent path, and assert that no `screenshot:detection-failed` event is emitted. These tests confirm the bug exists on unfixed code.

**Test Cases**:
1. **OCR Init Failure Test**: Mock `OcrEngine::new()` to return Err → assert no event emitted (will pass on unfixed code, confirming the bug)
2. **OCR Extraction Failure Test**: Mock `engine.extract_text()` to return Err → assert no event emitted (will pass on unfixed code)
3. **Empty Candidates Test**: Provide image where OCR returns non-tooltip text → assert no event emitted (will pass on unfixed code)
4. **Frontend Mapping Test**: Call `mapReasonToMessage("ocr_init_failed")` → assert returns fallback string (confirms no mapping exists yet)

**Expected Counterexamples**:
- All three paths return without calling `app_handle.emit()`
- Frontend `REASON_MESSAGES` has no entry for the new reason codes, falling back to generic message

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function emits the correct `screenshot:detection-failed` event.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := process_image_fixed(input)
  ASSERT event_emitted(result, "screenshot:detection-failed")
  ASSERT result.payload.reason IN {"ocr_init_failed", "ocr_failed", "no_candidates"}
  ASSERT REASON_MESSAGES[result.payload.reason] IS NOT undefined
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same results as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT process_image(input) = process_image_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases where the new code paths might accidentally interfere with existing logic
- It provides strong guarantees that no_text, no_match, and successful detection remain unchanged

**Test Plan**: Observe behavior on UNFIXED code for all non-buggy paths, then write property-based tests ensuring the fixed code produces identical events and payloads.

**Test Cases**:
1. **no_text Preservation**: Verify that empty OCR text still emits reason "no_text" with unchanged message
2. **no_match Preservation**: Verify that no items above threshold still emits reason "no_match" with unchanged message
3. **Successful Detection Preservation**: Verify that valid tooltip images still emit `screenshot:item-detected` with correct payload
4. **Frontend Fallback Preservation**: Verify that `mapReasonToMessage` with unknown reasons still returns "Screenshot detection failed"

### Unit Tests

- Test each new Rust emission path produces correct `DetectionFailedPayload` (reason + message)
- Test `mapReasonToMessage` returns correct strings for all six reason codes
- Test `mapReasonToMessage` fallback for unknown reason codes
- Test that `REASON_MESSAGES` contains exactly the expected keys

### Property-Based Tests

- Generate random OCR failure scenarios and verify the correct reason code is always emitted
- Generate random non-tooltip text strings and verify `no_candidates` is emitted when `parse_tooltip_text` returns empty
- Generate random valid tooltip text and verify existing `no_match` / successful detection behavior is preserved
- Generate random reason strings and verify `mapReasonToMessage` never throws, always returns a string

### Integration Tests

- End-to-end test: trigger detection with a non-game screenshot → verify toast appears with "No D2R item tooltip detected in image"
- End-to-end test: trigger detection with corrupted image data → verify toast appears with appropriate OCR failure message
- End-to-end test: trigger detection with valid D2R tooltip → verify ConfirmationDialog still appears (preservation)
