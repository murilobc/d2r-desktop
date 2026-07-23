# Implementation Plan: Screenshot Item Detection

## Overview

This plan implements OCR-based item detection from clipboard screenshots. The implementation follows a bottom-up approach: Rust backend modules first (settings, matcher, parser, OCR engine, monitor), then frontend components (settings UI, confirmation dialog, event hook), and finally integration wiring. Each task builds incrementally on previous work so there is no orphaned code.

## Tasks

- [x] 1. Add crate dependencies and create module skeleton
  - [x] 1.1 Add new crate dependencies to Cargo.toml
    - Add `leptess = "0.14"`, `arboard = { version = "3", features = ["image-data"] }`, `image = "0.25"`, `strsim = "0.11"`, `sha2 = "0.10"` to `[dependencies]` in `src-tauri/Cargo.toml`
    - Run `cargo check` to verify dependencies resolve
    - _Requirements: 2.1, 3.1, 1.1_

  - [x] 1.2 Create the `screenshot` module directory and `mod.rs`
    - Create `src-tauri/src/screenshot/mod.rs` that declares submodules: `settings`, `matcher`, `parser`, `ocr`, `monitor`
    - Create empty stub files for each submodule: `settings.rs`, `matcher.rs`, `parser.rs`, `ocr.rs`, `monitor.rs`
    - Add `pub mod screenshot;` to `src-tauri/src/lib.rs`
    - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Implement screenshot settings (persistence layer)
  - [x] 2.1 Create the `screenshot_settings` SQLite table and CRUD functions
    - In `src-tauri/src/screenshot/settings.rs`, define the `ScreenshotSettings` struct with `monitoring_enabled: bool`, `auto_detection_enabled: bool`, `confidence_threshold: u8`
    - Implement `create_screenshot_settings_table(conn: &Connection)` with the single-row table schema (CHECK constraints: id=1, threshold 50–100)
    - Implement `get_settings(conn: &Connection) -> ScreenshotSettings` that returns defaults if row doesn't exist
    - Implement `update_settings(conn: &Connection, settings: &ScreenshotSettings) -> Result<(), String>` with validation that rejects threshold values outside 50–100
    - Call `create_screenshot_settings_table` from the existing DB initialization in `src-tauri/src/db.rs`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.2 Write property test for settings threshold validation
    - **Property 7: Settings threshold validation**
    - Test with arbitrary i32 values that `update_settings` succeeds only when 50 ≤ threshold ≤ 100
    - **Validates: Requirements 7.3, 7.4**

  - [x] 2.3 Write property test for settings persistence round-trip
    - **Property 8: Settings persistence round-trip**
    - Test with arbitrary valid `ScreenshotSettings` (bool, bool, 50–100) that save → load produces identical values
    - **Validates: Requirements 7.5**

- [x] 3. Implement the fuzzy matcher
  - [x] 3.1 Define item database types and build the in-memory item list
    - In `src-tauri/src/screenshot/matcher.rs`, define `GameItemEntry { name, normalized_name, category, subcategory }` and `MatchCandidate { item_name, category, subcategory, confidence: u8 }`
    - Create a static item database (mirroring `src/data/items.ts`) loaded once via `lazy_static` or `once_cell`
    - Implement `normalize_ocr_chars(text: &str) -> String` that replaces O↔0, l↔1, I↔l confusions with canonical form
    - Implement `calculate_confidence(extracted: &str, item_name: &str) -> u8` using `strsim::normalized_levenshtein` scaled to 0–100
    - _Requirements: 3.1, 3.3, 3.6_

  - [x] 3.2 Implement `match_items` with ranking and tiebreaker logic
    - Implement `match_items(candidates: &[ParsedCandidate], item_database: &[GameItemEntry], threshold: u8) -> Vec<MatchCandidate>`
    - Return at most 5 candidates sorted by confidence descending
    - Apply category tiebreaker: within a 5-point band, rank Unique/Set/Rune above other categories
    - Return empty list for empty/whitespace-only input without performing matching
    - _Requirements: 3.2, 3.4, 3.5, 3.7_

  - [x] 3.3 Write property test for confidence score range and count invariants
    - **Property 1: Confidence score range and count invariants**
    - For arbitrary UTF-8 strings, verify `match_items` returns ≤5 candidates with confidence in [0, 100]
    - **Validates: Requirements 3.3, 3.4**

  - [x] 3.4 Write property test for sorted results
    - **Property 2: Match results sorted by confidence descending**
    - For arbitrary non-empty strings, verify candidates are ordered by confidence descending (modulo tiebreaker reordering within 5-point band)
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.5 Write property test for category tiebreaker ordering
    - **Property 3: Category tiebreaker ordering within confidence band**
    - Generate strings producing close-score matches and verify Unique/Set/Rune candidates appear before others in same 5-point band
    - **Validates: Requirements 3.5**

  - [x] 3.6 Write property test for OCR character normalization idempotence
    - **Property 4: OCR character normalization is idempotent**
    - For arbitrary strings with OCR-confusable characters, verify `normalize_ocr_chars(normalize_ocr_chars(s)) == normalize_ocr_chars(s)`
    - **Validates: Requirements 3.6**

  - [x] 3.7 Write property test for empty/whitespace input
    - **Property 11: Empty and whitespace-only input returns no candidates**
    - For arbitrary whitespace-only strings, verify `match_items` returns empty list
    - **Validates: Requirements 3.7**

- [x] 4. Implement the tooltip text parser
  - [x] 4.1 Implement `normalize_text` and `parse_tooltip_text`
    - In `src-tauri/src/screenshot/parser.rs`, define `ParsedCandidate { text: String, line_index: usize }`
    - Implement `normalize_text(text: &str) -> String` that trims whitespace, collapses spaces, removes line breaks, and strips characters not in `[A-Za-z0-9 \-']`
    - Implement `parse_tooltip_text(raw_text: &str) -> Vec<ParsedCandidate>` that: extracts first line as primary candidate, concatenates first two lines as secondary candidate, strips known rarity labels ("Unique", "Set", "Rare", "Magic", "Crafted") and base type labels from adjacent lines
    - Handle multi-word item names as single match units
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 4.2 Write property test for text normalization output
    - **Property 5: Text normalization produces valid canonical output**
    - For arbitrary strings, verify output has no leading/trailing whitespace, no consecutive spaces, no line breaks, and only `[A-Za-z0-9 \-']` characters
    - **Validates: Requirements 12.4**

  - [x] 4.3 Write property test for first-line extraction
    - **Property 9: Tooltip parser first-line extraction**
    - For arbitrary multi-line text, verify first candidate contains trimmed first line, and if no DB match a second candidate with first two lines concatenated is present
    - **Validates: Requirements 12.1**

  - [x] 4.4 Write property test for label stripping
    - **Property 10: Label stripping from tooltip candidates**
    - For item names with adjacent rarity labels, verify parsed candidates do not contain the labels
    - **Validates: Requirements 12.2**

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the OCR engine
  - [x] 6.1 Implement image preprocessing and text extraction
    - In `src-tauri/src/screenshot/ocr.rs`, define `OcrError` enum with variants: `InitFailed`, `UnsupportedFormat`, `Timeout`, `Internal`
    - Implement `OcrEngine::new() -> Result<Self, OcrError>` that initializes Tesseract with English language data
    - Implement `preprocess(image_data: &[u8]) -> Result<Vec<u8>, OcrError>` using `image` crate to convert to grayscale and apply contrast enhancement
    - Implement `extract_text(image_data: &[u8]) -> Result<String, OcrError>` that preprocesses, runs Tesseract OCR, and returns extracted text
    - Add a 5-second timeout: if processing exceeds 5s, abort and return `OcrError::Timeout`
    - Return empty string (not error) when no text is found
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 11.2, 11.5_

- [x] 7. Implement the clipboard monitor
  - [x] 7.1 Implement `ClipboardMonitor` with polling and hash deduplication
    - In `src-tauri/src/screenshot/monitor.rs`, define `ClipboardMonitor` struct with `running: Arc<AtomicBool>`, `last_hash: Arc<Mutex<Option<[u8; 32]>>>`, `pending_image: Arc<Mutex<Option<Vec<u8>>>>`, `processing: Arc<AtomicBool>`
    - Implement `start(app_handle: AppHandle, settings: ScreenshotSettings) -> Self` that spawns a tokio task polling clipboard at 1s interval using `arboard::Clipboard`
    - Compute SHA-256 hash of each image; skip if same as `last_hash`
    - On new image: dispatch OCR processing via `tokio::task::spawn_blocking`; limit to 1 concurrent + 1 queued (discard older)
    - Implement `stop(&self)` that sets `running` to false
    - Implement `is_running(&self) -> bool`
    - Handle errors gracefully: log and continue polling on clipboard read failures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 8.1, 8.5, 8.6, 11.1, 11.3, 11.6_

  - [x] 7.2 Wire the full detection pipeline: monitor → OCR → parser → matcher → event emission
    - In the monitor's processing flow, call `OcrEngine::extract_text`, then `parse_tooltip_text`, then `match_items`
    - Build a `DetectionResult` struct (with `top_match`, `candidates`, `raw_text`, `is_auto_suggested`, `detected_at`)
    - Set `is_auto_suggested = true` if top candidate confidence > threshold, `false` otherwise
    - Emit the result via Tauri event `screenshot:item-detected`
    - Do not emit event if no candidates match above score 30
    - Release image data from memory after processing (no disk writes)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 9.3, 9.4_

  - [x] 7.3 Write property test for detection routing by confidence threshold
    - **Property 6: Detection routing by confidence threshold**
    - For arbitrary threshold T (50–100) and score vectors, verify: top > T → auto-suggested; top in (30, T] → not auto-suggested with non-empty candidates; all ≤ 30 → ItemSearch fallback
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5**

- [x] 8. Implement Tauri commands for screenshot feature
  - [x] 8.1 Register Tauri commands and state management
    - Define `MonitorState` (wrapping `Arc<Mutex<Option<ClipboardMonitor>>>`) and register it as Tauri managed state
    - Implement `get_screenshot_settings` command that reads from DB
    - Implement `update_screenshot_settings` command that validates, persists, and starts/stops monitor accordingly (within 1s of toggle change)
    - Implement `detect_from_clipboard` command that triggers one-shot detection from current clipboard content (for manual "Detect from Screenshot" button)
    - Register all three commands in the Tauri builder in `src-tauri/src/lib.rs`
    - _Requirements: 6.5, 7.6, 7.7, 7.8_

- [x] 9. Checkpoint — Ensure Rust backend compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement frontend API layer and types
  - [x] 10.1 Add TypeScript types and API functions for screenshot detection
    - Add `ScreenshotSettings`, `DetectionResult`, and `MatchCandidate` interfaces to `src/types.ts`
    - Add `getScreenshotSettings`, `updateScreenshotSettings`, and `detectFromClipboard` functions to `src/api.ts`
    - _Requirements: 7.1, 7.3, 6.5_

- [x] 11. Implement the `useScreenshotDetection` hook
  - [x] 11.1 Create the event listener hook with state management
    - Create `src/hooks/useScreenshotDetection.ts`
    - Listen for `screenshot:item-detected` Tauri event and parse the `DetectionResult` payload
    - Manage state: current detection result, 30-second auto-dismiss timer (reset on new detection)
    - Expose: `detection`, `dismiss()`, `confirm(item)`, `triggerManual()`
    - On confirm: call `createItem` with appropriate `CreateItemInput` (name, item_type, rarity, profile_id, run_id); if item is a Rune, also call `syncRuneOnCreate` equivalent (`updateRuneCount`)
    - On dismiss: clear detection state
    - Handle case where no active run exists: create a standalone run before logging
    - _Requirements: 5.5, 5.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 12. Implement the ConfirmationDialog component
  - [x] 12.1 Create `ConfirmationDialog.tsx` with confirm/change/dismiss actions
    - Create `src/components/ConfirmationDialog.tsx`
    - Render non-modal (no overlay) with item name, category, confidence score displayed
    - Show "Auto-detected" label when `isAutoSuggested` is true
    - Show dropdown of candidates (up to 5) when not auto-suggested (confidence ≤ threshold but > 30)
    - Provide Confirm, Change, and Dismiss buttons with keyboard accessibility (role, tabIndex, onKeyDown)
    - On "Change": close dialog and open `ItemSearch` component pre-filled with `rawText`
    - Replace content (not stack) when a new detection arrives while dialog is visible
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 6.1, 6.2, 6.3, 6.6_

  - [x] 12.2 Write unit tests for ConfirmationDialog
    - Test rendering for auto-suggested state (label visible, item pre-selected)
    - Test rendering for manual-selection state (dropdown with candidates)
    - Test confirm action invokes `onConfirm` callback
    - Test dismiss action invokes `onDismiss` callback
    - Test change action invokes `onChange` callback
    - Test 30-second auto-dismiss timer fires
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 13. Implement the ScreenshotSettings component
  - [x] 13.1 Create `ScreenshotSettings.tsx` settings panel
    - Create `src/components/ScreenshotSettings.tsx`
    - Render under a "Screenshot Detection" section within the existing Settings page
    - Provide toggle for clipboard monitoring (default: disabled)
    - Provide toggle for auto-detection (default: enabled, configurable independently)
    - Provide numeric input for confidence threshold (default: 80, range: 50–100, step: 1)
    - Reject invalid threshold values (show inline error, retain previous value)
    - On toggle change: call `updateScreenshotSettings` API which starts/stops monitor
    - Show error toast if settings save fails
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8, 7.9_

  - [x] 13.2 Write unit tests for ScreenshotSettings component
    - Test that toggles render with correct default states
    - Test threshold input rejects values outside 50–100
    - Test settings save calls API with correct payload
    - Test error display on save failure
    - _Requirements: 7.3, 7.4, 7.9_

- [x] 14. Integrate detection UI into the main application
  - [x] 14.1 Wire `useScreenshotDetection` hook and `ConfirmationDialog` into the app
    - Import and use `useScreenshotDetection` hook in the main App component (or appropriate parent)
    - Render `ConfirmationDialog` conditionally when a detection result exists
    - When detection falls below score 30 or has no candidates, open the existing `ItemSearch` component pre-filled with raw text
    - Add "Detect from Screenshot" button (visible when auto-detection is disabled) that calls `triggerManual()`
    - Add `ScreenshotSettings` component to the existing Settings page
    - _Requirements: 4.4, 4.5, 6.4, 6.5, 7.6_

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–11)
- Unit tests validate specific examples and edge cases
- The Rust backend must compile (`cargo check`) before frontend integration begins
- Tesseract `eng.traineddata` must be bundled with the application for OCR to function
- The item database in Rust should mirror `src/data/items.ts` — consider code generation or a shared JSON source

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["3.3", "3.4", "3.5", "3.6", "3.7", "6.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["10.1"] },
    { "id": 9, "tasks": ["11.1", "13.1"] },
    { "id": 10, "tasks": ["12.1", "13.2"] },
    { "id": 11, "tasks": ["12.2", "14.1"] }
  ]
}
```
