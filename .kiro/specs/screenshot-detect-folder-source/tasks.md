# Implementation Plan: Screenshot Detection — Folder Source & OCR Fix

## Overview

This plan replaces the broken Tesseract-based OCR with a layered Windows native + embedded fallback strategy, adds a color-based text region detector for improved accuracy, and introduces folder-based screenshot monitoring as a second image source. Each task builds incrementally on the previous, with the dependency/Cargo changes first, then pure modules, then wiring, then frontend.

## Tasks

- [x] 1. Update Cargo.toml dependencies
  - [x] 1.1 Remove `leptess` dependency and `ocr` feature flag
    - Remove `leptess = { version = "0.14", optional = true }` from `[dependencies]`
    - Remove `ocr = ["leptess"]` from `[features]` section
    - Remove the `[features]` section entirely if no other features remain (keep `default = []` if needed)
    - _Requirements: 1.6_

  - [x] 1.2 Add new dependencies for OCR and folder monitoring
    - Add `windows = { version = "0.58", features = ["Media_Ocr", "Graphics_Imaging", "Storage_Streams", "Foundation"] }`
    - Add `ocrs = "0.9"`
    - Add `rten = "0.13"`
    - Add `dirs = "5"`
    - Verify `cargo check` passes after changes
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement color detector module
  - [x] 2.1 Create `src-tauri/src/screenshot/color_detector.rs`
    - Define `ColorRange` struct with `r_center`, `g_center`, `b_center`, `tolerance`, `category` fields
    - Define `ITEM_COLORS` constant array with all 6 D2R item name colors and their tolerances (±30 for colored, ±15 for white)
    - Define `ColorDetectionResult` struct with `cropped_image: Vec<u8>`, `detected_category: String`, `confidence_boost: u8`
    - Implement `detect_item_text_region(image_data: &[u8]) -> Result<ColorDetectionResult, String>`
      - Decode image, scan top 50% for pixels matching any known color within tolerance
      - Cluster adjacent matching pixels into regions, select largest horizontal region
      - Expand bounding box by 10px padding
      - Call `binarize_region` on the cropped area
      - Encode result as PNG bytes and return with category
      - If no matching pixels found, return full original image as fallback
    - Implement `binarize_region(image: &image::RgbaImage, color: &ColorRange) -> image::GrayImage`
      - Matching pixels become 255 (white), all others become 0 (black)
      - Output must be pure binary (no intermediate grayscale values)
    - Register module in `mod.rs` with `pub mod color_detector;`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 2.2 Write property tests for color detector
    - **Property 1: Color detection identifies known D2R item colors**
    - **Property 2: Binarization produces valid binary output**
    - **Property 3: Color detection fallback on no-match images**
    - **Validates: Requirements 2.2, 2.4, 2.5, 2.6, 2.7**

- [x] 3. Rewrite OCR engine
  - [x] 3.1 Rewrite `src-tauri/src/screenshot/ocr.rs` — Windows native backend
    - Remove all `leptess` imports and `#[cfg(feature = "ocr")]` conditional compilation
    - Define `OcrBackend` enum with `WindowsNative(WindowsOcrEngine)` and `Embedded(EmbeddedOcrEngine)` variants
    - Define `OcrEngine` struct containing `backend: OcrBackend`
    - Implement `WindowsOcrEngine::new() -> Result<Self, OcrError>` using `windows::Media::Ocr::OcrEngine`
    - Implement `WindowsOcrEngine::extract_text(&self, image_data: &[u8]) -> Result<String, OcrError>`
      - Convert PNG bytes to `SoftwareBitmap` via `Windows::Graphics::Imaging`
      - Call `OcrEngine::RecognizeAsync` and collect line text
    - Keep existing `OcrError` enum (remove `InitFailed` Tesseract-specific message, update to generic)
    - Keep `preprocess` function for potential use but mark it as available without feature gate
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [x] 3.2 Implement embedded OCR fallback backend
    - Implement `EmbeddedOcrEngine::new() -> Result<Self, OcrError>` using `ocrs` + `rten`
    - Load ONNX models via `include_bytes!` or from a bundled models directory
    - Implement `EmbeddedOcrEngine::extract_text(&self, image_data: &[u8]) -> Result<String, OcrError>`
    - Implement `OcrEngine::new()` with fallback logic: try `WindowsOcrEngine::new()` first, fall back to `EmbeddedOcrEngine::new()`
    - Implement `OcrEngine::extract_text()` that delegates to whichever backend was initialized
    - Add build script or download step for ocrs models (text-detection.rten, text-recognition.rten)
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 3.3 Write unit tests for OCR engine
    - Test that `OcrEngine::new()` succeeds without Tesseract installed
    - Test that `extract_text` handles invalid image data gracefully (returns error, no panic)
    - Test OcrError display formatting
    - _Requirements: 1.1, 1.4_

- [x] 4. Wire color detector and new OCR into detection pipeline
  - [x] 4.1 Update `process_image` in `src-tauri/src/screenshot/monitor.rs`
    - Add `use super::color_detector;` import
    - Insert color detection step before OCR: call `color_detector::detect_item_text_region(image_data)`
    - On success: use `result.cropped_image` as OCR input, pass `result.detected_category` as category hint
    - On failure: fall through to full image as OCR input (existing behavior)
    - Remove the old `preprocess` call from the OCR path (color detector handles preprocessing now)
    - Ensure `process_image` runs in `spawn_blocking` and never blocks UI thread
    - Add 5-second total timeout: if exceeded, emit `detection-failed` with reason `timeout`
    - _Requirements: 5.2, 8.4, 8.5_

  - [x] 4.2 Write property test for pipeline robustness
    - **Property 6: Detection pipeline never panics on arbitrary image input**
    - **Validates: Requirements 1.1, 8.4, 8.5**

- [x] 5. Checkpoint — Verify OCR replacement works
  - Ensure `cargo check` passes with no warnings
  - Ensure existing screenshot unit tests pass (`cargo test -p d2r-desktop`)
  - Verify the `ocr` feature flag is completely gone
  - Ask the user if questions arise.

- [x] 6. Implement folder watcher module
  - [x] 6.1 Create `src-tauri/src/screenshot/folder_watcher.rs`
    - Define `FolderWatcher` struct with `watch_path: PathBuf`, `last_modified: Arc<Mutex<Option<SystemTime>>>`, `running: Arc<AtomicBool>`
    - Implement `FolderWatcher::resolve_default_path() -> Option<PathBuf>`
      - Check `%USERPROFILE%\Documents\Diablo II Resurrected\Screenshots\` first (use `dirs::document_dir()`)
      - Check `%USERPROFILE%\Saved Games\Diablo II Resurrected\Screenshots\` second
      - Return `None` if neither exists
    - Implement `FolderWatcher::start(app_handle: AppHandle, path: PathBuf, settings: ScreenshotSettings) -> Self`
      - Spawn tokio task that polls every 2 seconds
      - Record current time as baseline on start (only process files after this time)
      - On each poll, call `poll_new_files()` and feed results into `process_image`
    - Implement `FolderWatcher::stop(&self)` — set running to false
    - Implement `FolderWatcher::is_running(&self) -> bool`
    - Implement `poll_new_files(&self) -> Vec<PathBuf>`
      - Read directory entries, filter `.jpg` and `.png` extensions
      - Filter to files with modification time strictly after `last_modified`
      - Update `last_modified` to the newest file's time
      - Sort by modification time (oldest first) for sequential processing
    - Use only standard `std::fs::read`, `std::fs::read_dir` — no kernel-level file watch APIs
    - Handle errors gracefully: log and skip files that can't be read (permission denied, locked, corrupt)
    - Register module in `mod.rs` with `pub mod folder_watcher;`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.2 Write property test for folder watcher file detection
    - **Property 4: Folder watcher detects new files by modification time**
    - **Validates: Requirements 3.2, 3.3**

- [x] 7. Database migration and settings update
  - [x] 7.1 Update `src-tauri/src/screenshot/settings.rs`
    - Add `folder_monitoring_enabled: bool` field to `ScreenshotSettings` (default: `false`)
    - Add `screenshot_folder_path: Option<String>` field (default: `None`)
    - Update `Default` impl with new fields
    - Update `create_screenshot_settings_table` to include new columns in the CREATE TABLE
    - Add migration function `migrate_screenshot_settings(conn: &Connection) -> rusqlite::Result<()>`
      - Execute `ALTER TABLE screenshot_settings ADD COLUMN folder_monitoring_enabled INTEGER NOT NULL DEFAULT 0`
      - Execute `ALTER TABLE screenshot_settings ADD COLUMN screenshot_folder_path TEXT DEFAULT NULL`
      - Handle "duplicate column" errors gracefully (skip if already migrated)
    - Update `get_settings` to read new columns (handle NULL for `screenshot_folder_path` as `None`)
    - Update `update_settings` to persist new fields
    - Call migration from `init_db` or app setup
    - _Requirements: 4.1, 4.5, 7.1, 7.2, 7.3, 7.4_

  - [x] 7.2 Write property test for settings round-trip
    - **Property 5: Settings persistence round-trip with new fields**
    - **Validates: Requirements 4.5, 7.1, 7.4**

  - [x] 7.3 Update TypeScript types in `src/api.ts`
    - Add `folderMonitoringEnabled: boolean` to ScreenshotSettings interface
    - Add `screenshotFolderPath: string | null` to ScreenshotSettings interface
    - Add `getDefaultScreenshotFolder` API function: `invoke<string | null>("get_default_screenshot_folder")`
    - Add `detectFromFile` API function: `invoke<void>("detect_from_file", { path })`
    - _Requirements: 4.2, 9.1, 9.2_

- [x] 8. Tauri command registration and state management
  - [x] 8.1 Add new commands and state to `src-tauri/src/screenshot/mod.rs`
    - Add `pub mod folder_watcher;` (if not already done in step 6)
    - Define `FolderWatcherState(pub Arc<Mutex<Option<FolderWatcher>>>)` struct
    - Implement `get_default_screenshot_folder` Tauri command
      - Call `FolderWatcher::resolve_default_path()` and return `Option<String>`
    - Implement `detect_from_file` Tauri command
      - Validate file exists and is readable
      - Read file bytes and call `process_image` on them
      - Return error if file doesn't exist or isn't a valid image
    - Update `update_screenshot_settings` to start/stop `FolderWatcher` when `folder_monitoring_enabled` toggles
      - When enabling: resolve path (custom or auto-detect), validate folder exists, start watcher
      - When disabling: stop watcher
      - Return error if folder path is invalid when enabling
    - _Requirements: 3.6, 4.3, 4.4, 9.1, 9.2, 9.3, 9.4_

  - [x] 8.2 Register new commands and state in `src-tauri/src/lib.rs`
    - Add `app.manage(screenshot::FolderWatcherState(...))` in setup closure
    - Add `screenshot::get_default_screenshot_folder` to `generate_handler!` list
    - Add `screenshot::detect_from_file` to `generate_handler!` list
    - _Requirements: 9.1, 9.2, 9.4_

- [x] 9. Checkpoint — Backend complete
  - Ensure `cargo check` passes with zero warnings
  - Run `cargo test -p d2r-desktop` and ensure all tests pass
  - Verify new commands are registered and settings migration works
  - Ask the user if questions arise.

- [x] 10. Frontend settings UI for folder monitoring
  - [x] 10.1 Update `src/components/ScreenshotSettings.tsx`
    - Add "Folder Monitoring" section below existing clipboard monitoring settings
    - Add toggle switch for "Monitor D2R Screenshots Folder" bound to `folderMonitoringEnabled`
    - Add path display field showing the resolved folder path (from `screenshotFolderPath` or auto-detected)
    - Add "Auto-detect" button that calls `getDefaultScreenshotFolder` and updates the path
    - Add "Browse" button that uses `@tauri-apps/plugin-dialog` to open a folder picker
    - Add status indicator showing whether the configured folder exists and file count
    - Add validation warning when folder path doesn't exist (prevent enabling toggle)
    - Ensure all interactive elements are keyboard-accessible (`tabIndex`, `onKeyDown`, proper labels)
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 3.6_

  - [x] 10.2 Write unit tests for ScreenshotSettings folder monitoring UI
    - Test that folder monitoring toggle renders and dispatches settings update
    - Test that Browse button opens dialog
    - Test that validation warning appears for invalid paths
    - _Requirements: 4.1, 4.2, 4.7_

- [x] 11. Final checkpoint — End-to-end verification
  - Run full verification checklist: `npm test`, `npx tsc --noEmit`, `cd src-tauri && cargo check`, `npx vite build`
  - Verify clipboard monitoring still works (backwards compatibility)
  - Verify folder monitoring can be enabled/disabled from settings
  - Verify existing frontend components (DetectionToast, confirmation flow) work with both sources
  - Ensure no `leptess` or `ocr` feature references remain anywhere in the codebase
  - Ask the user if questions arise.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["5"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["8.1", "8.2"] },
    { "id": 8, "tasks": ["9"] },
    { "id": 9, "tasks": ["10.1", "10.2"] },
    { "id": 10, "tasks": ["11"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests validate universal correctness properties from the design document
- The `leptess` removal (task 1.1) must happen before OCR rewrite (task 3) to avoid conflicts
- Model files for `ocrs` need to be downloaded/bundled as part of task 3.2 — this may require a build script update
- All Rust code must compile with zero warnings per project conventions
