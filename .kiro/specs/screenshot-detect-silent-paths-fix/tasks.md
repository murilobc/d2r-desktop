# Implementation Plan

## Overview

Fix the three silent failure paths in `process_image` (src-tauri/src/screenshot/monitor.rs) that return without emitting any Tauri event, leaving the user with no feedback. The fix adds `screenshot:detection-failed` event emissions with distinct reason codes (`ocr_init_failed`, `ocr_failed`, `no_candidates`) to each silent path, and maps those reason codes to user-friendly messages in the frontend `REASON_MESSAGES` map.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Silent Failure Paths Emit No Events
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the three silent paths currently produce no `screenshot:detection-failed` event
  - **Scoped PBT Approach**: Scope the property to the three concrete failing cases — OCR init failure, OCR extraction failure, and empty parsed candidates
  - **Testing Strategy**: Since `process_image` requires an `AppHandle` (hard to unit test directly), test the frontend mapping side: verify that `REASON_MESSAGES` does NOT contain entries for the new reason codes, and write a Rust test for `determine_process_outcome` to verify the code paths produce no event emission instruction
  - Create file `src/hooks/useDetectionToast.property.test.ts`
  - Use fast-check to generate arbitrary reason strings from `fc.constantFrom("ocr_init_failed", "ocr_failed", "no_candidates")`
  - Test that `REASON_MESSAGES[reason]` returns `undefined` for all three new reason codes (confirming no mapping exists yet)
  - Test that `mapReasonToMessage(reason)` returns the generic fallback "Screenshot detection failed" for these codes
  - Additionally, create Rust test in `src-tauri/src/screenshot/monitor.rs` (or a test module) that verifies the current `process_image` code structure lacks `emit` calls in the three silent branches (code inspection / compile-time assertion)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL — the property asserts these reason codes SHOULD map to specific messages, but they don't yet (confirming the bug exists on the frontend side)
  - Document counterexamples found: `REASON_MESSAGES["ocr_init_failed"]` is undefined, `mapReasonToMessage("ocr_init_failed")` returns generic fallback instead of specific message
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Reason Codes and Fallback Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create file `src/hooks/useDetectionToast.preservation.property.test.ts`
  - Observe on UNFIXED code: `REASON_MESSAGES["no_text"]` returns "No text detected in screenshot"
  - Observe on UNFIXED code: `REASON_MESSAGES["no_match"]` returns "No item detected in screenshot"
  - Observe on UNFIXED code: `REASON_MESSAGES["no_image"]` returns "No image found in clipboard"
  - Observe on UNFIXED code: `mapReasonToMessage("unknown_xyz")` returns "Screenshot detection failed" (fallback)
  - Write property-based test: for all existing reason codes (`no_text`, `no_match`, `no_image`), `mapReasonToMessage` returns the expected specific message (not the fallback)
  - Write property-based test: for all arbitrary strings NOT in REASON_MESSAGES keys, `mapReasonToMessage` returns "Screenshot detection failed"
  - Use fast-check to generate random strings (`fc.string()`) and verify `mapReasonToMessage` never throws, always returns a string
  - Use fast-check `fc.constantFrom("no_text", "no_match", "no_image")` and verify each maps to its known message
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for silent failure paths in process_image

  - [x] 3.1 Add event emissions to three silent paths in Rust backend
    - In `src-tauri/src/screenshot/monitor.rs`, function `process_image`:
    - **OCR init failure branch** (where `OcrEngine::new()` returns `Err`): Add `app_handle.emit("screenshot:detection-failed", &payload)` with reason `"ocr_init_failed"` and message `format!("OCR engine initialization failed: {}", e)`
    - **OCR extraction failure branch** (where `engine.extract_text()` returns `Err`): Add `app_handle.emit("screenshot:detection-failed", &payload)` with reason `"ocr_failed"` and message `format!("OCR text extraction failed: {}", e)`
    - **Empty parsed candidates branch** (where `parsed_candidates.is_empty()` is true): Add `app_handle.emit("screenshot:detection-failed", &payload)` with reason `"no_candidates"` and message `"OCR text did not match D2R tooltip format".to_string()`
    - Each emission follows the existing pattern: construct `DetectionFailedPayload`, wrap `emit` in `if let Err(emit_err)` for error handling
    - _Bug_Condition: isBugCondition(input) where ocrEngineInitFails OR ocrExtractionFails OR (hasImage AND ocrText≠EMPTY AND parsedCandidates=EMPTY)_
    - _Expected_Behavior: app_handle.emit("screenshot:detection-failed", payload) with correct reason code_
    - _Preservation: Existing no_text and no_match emissions untouched; successful detection path untouched_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Add three new entries to REASON_MESSAGES in frontend
    - In `src/hooks/useDetectionToast.ts`, add to the `REASON_MESSAGES` map:
    - `ocr_init_failed: "Screenshot analysis failed — please try again"`
    - `ocr_failed: "Could not read text from screenshot"`
    - `no_candidates: "No D2R item tooltip detected in image"`
    - No other changes needed — existing `listen` handler and `mapReasonToMessage` already handle any reason code present in `REASON_MESSAGES`
    - _Bug_Condition: Frontend receives detection-failed event with new reason codes_
    - _Expected_Behavior: mapReasonToMessage returns specific user-friendly message instead of generic fallback_
    - _Preservation: Existing no_text, no_match, no_image mappings unchanged; fallback for unknown codes unchanged_
    - _Requirements: 2.4, 3.2, 3.3, 3.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Silent Failure Paths Now Emit Events with Mapped Messages
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (new reason codes map to specific messages)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — reason codes now have specific messages in REASON_MESSAGES)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Reason Codes and Fallback Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — existing mappings untouched, fallback still works)
    - Confirm all preservation tests still pass after fix (no regressions introduced)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npm test`
  - Run TypeScript check: `npx tsc --noEmit`
  - Run Rust check: `cd src-tauri && cargo check`
  - Ensure all property-based tests pass (both bug condition and preservation)
  - Ensure existing `DetectionToast.test.tsx` still passes
  - Ask the user if questions arise

## Notes

- The Rust side is hard to unit test directly since `process_image` requires `AppHandle`. The bug condition test focuses on the frontend mapping (which is the user-visible symptom) and verifies that the new reason codes get proper messages.
- The preservation tests verify that existing `REASON_MESSAGES` entries and the fallback behavior remain stable after adding new entries.
- Property-based tests use fast-check with vitest, matching existing project patterns (see `RuneCell.property.test.tsx`, `ScreenshotSettings.property.test.tsx`).
- The fix is purely additive — new `emit` calls in Rust error branches, new entries in a TypeScript map — so it cannot break existing behavior.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2"] },
    { "id": 2, "tasks": ["3.3", "3.4"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
