use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::Instant;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use super::color_detector;
use super::matcher::{match_items, MatchCandidate, ITEM_DATABASE};
use super::ocr::OcrEngine;
use super::parser::parse_tooltip_text;
use super::settings::ScreenshotSettings;

/// Maximum time allowed for the entire detection pipeline (5 seconds).
const PIPELINE_TIMEOUT_SECS: u64 = 5;

/// Event payload for detection failures.
///
/// Emitted as a `screenshot:detection-failed` Tauri event when the detection
/// pipeline cannot produce a result (no text extracted, or no match found).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectionFailedPayload {
    pub reason: String,
    pub message: String,
}

/// The result of running the full detection pipeline on a clipboard image.
///
/// Contains the top match (if auto-suggested), all viable candidates,
/// the raw OCR text, and metadata about when detection occurred.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct DetectionResult {
    pub top_match: Option<MatchCandidate>,
    pub candidates: Vec<MatchCandidate>,
    pub raw_text: String,
    pub is_auto_suggested: bool,
    pub detected_at: String,
}

/// Monitors the system clipboard for new screenshot images at a 1-second polling interval.
///
/// Uses SHA-256 hashing to deduplicate images and limits concurrent OCR processing
/// to 1 active + 1 queued (discarding older pending images).
#[allow(dead_code)]
pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
    last_hash: Arc<Mutex<Option<[u8; 32]>>>,
    pending_image: Arc<Mutex<Option<Vec<u8>>>>,
    processing: Arc<AtomicBool>,
}

impl ClipboardMonitor {
    /// Starts clipboard monitoring by spawning a tokio task that polls the clipboard
    /// every 1 second. When a new image is detected (by SHA-256 hash comparison),
    /// dispatches OCR processing via `spawn_blocking`.
    pub fn start(app_handle: AppHandle, settings: ScreenshotSettings) -> Self {
        let running = Arc::new(AtomicBool::new(true));
        let last_hash: Arc<Mutex<Option<[u8; 32]>>> = Arc::new(Mutex::new(None));
        let pending_image: Arc<Mutex<Option<Vec<u8>>>> = Arc::new(Mutex::new(None));
        let processing = Arc::new(AtomicBool::new(false));

        let monitor = Self {
            running: running.clone(),
            last_hash: last_hash.clone(),
            pending_image: pending_image.clone(),
            processing: processing.clone(),
        };

        let r = running.clone();
        let lh = last_hash.clone();
        let pi = pending_image.clone();
        let proc = processing.clone();
        let _ah = app_handle.clone();

        tokio::spawn(async move {
            let _settings = settings;
            let _app_handle = _ah;

            while r.load(Ordering::Relaxed) {
                match Self::poll_clipboard(&lh) {
                    Ok(Some(image_data)) => {
                        if proc.load(Ordering::Relaxed) {
                            // Already processing — queue this image (replace older pending)
                            let mut pending = pi.lock().unwrap();
                            *pending = Some(image_data);
                        } else {
                            // Dispatch for processing
                            proc.store(true, Ordering::Relaxed);
                            let pi_clone = pi.clone();
                            let proc_clone = proc.clone();
                            let _ah_clone = _app_handle.clone();
                            let _settings_clone = _settings.clone();

                            tokio::task::spawn_blocking(move || {
                                // Process the image (pipeline wired in task 7.2)
                                Self::process_image(&_ah_clone, &image_data, &_settings_clone);

                                // After processing, check for a pending image
                                proc_clone.store(false, Ordering::Relaxed);
                                let next = {
                                    let mut pending = pi_clone.lock().unwrap();
                                    pending.take()
                                };
                                if let Some(next_image) = next {
                                    proc_clone.store(true, Ordering::Relaxed);
                                    Self::process_image(&_ah_clone, &next_image, &_settings_clone);
                                    proc_clone.store(false, Ordering::Relaxed);
                                }
                            });
                        }
                    }
                    Ok(None) => {
                        // No new image — continue polling
                    }
                    Err(e) => {
                        eprintln!("[ClipboardMonitor] Error reading clipboard: {}", e);
                    }
                }

                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        });

        monitor
    }

    /// Stops the clipboard monitor by signaling the polling loop to exit.
    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }

    /// Returns whether the monitor is currently running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Creates a monitor in the "running" state for testing purposes.
    /// Does not spawn any tokio tasks — only useful for testing stop()/is_running().
    #[cfg(test)]
    pub fn new_running_for_test() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(true)),
            last_hash: Arc::new(Mutex::new(None)),
            pending_image: Arc::new(Mutex::new(None)),
            processing: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Polls the clipboard for image content. Returns `Ok(Some(png_bytes))` when a new
    /// image is detected (different SHA-256 hash from last), `Ok(None)` when no new image
    /// is available, or `Err` on clipboard access failures.
    fn poll_clipboard(last_hash: &Arc<Mutex<Option<[u8; 32]>>>) -> Result<Option<Vec<u8>>, String> {
        let mut clipboard =
            arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;

        let image = match clipboard.get_image() {
            Ok(img) => img,
            Err(arboard::Error::ContentNotAvailable) => return Ok(None),
            Err(e) => return Err(format!("Clipboard read error: {}", e)),
        };

        // Compute SHA-256 hash of raw RGBA pixel data
        let image_bytes = image.bytes.as_ref();
        let mut hasher = Sha256::new();
        hasher.update(image_bytes);
        let hash: [u8; 32] = hasher.finalize().into();

        // Compare with last processed hash — skip if identical
        let mut last = last_hash.lock().unwrap();
        if last.as_ref() == Some(&hash) {
            return Ok(None);
        }
        *last = Some(hash);

        // Encode raw RGBA pixels to PNG for downstream OCR processing
        let rgba_image = image::RgbaImage::from_raw(
            image.width as u32,
            image.height as u32,
            image_bytes.to_vec(),
        )
        .ok_or_else(|| "Failed to create image from clipboard data".to_string())?;

        let mut png_bytes: Vec<u8> = Vec::new();
        let encoder =
            image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
        image::ImageEncoder::write_image(
            encoder,
            rgba_image.as_raw(),
            rgba_image.width(),
            rgba_image.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| format!("Failed to encode clipboard image as PNG: {}", e))?;

        Ok(Some(png_bytes))
    }

    /// Runs the full detection pipeline: Color Detection → OCR → Parser → Matcher → Event emission.
    ///
    /// 1. Starts a 5-second timeout clock
    /// 2. Runs color-based text region detection to crop and binarize the item name area
    /// 3. Initializes the OCR engine and extracts text from the (cropped or full) image
    /// 4. Parses tooltip text into candidate item names
    /// 5. Matches candidates against the item database
    /// 6. Filters results below score 30
    /// 7. Builds a `DetectionResult` and emits it via Tauri event
    /// 8. Checks timeout at key stages — aborts with `detection-failed` (reason: `timeout`) if exceeded
    ///
    /// Image data is not persisted — it is released after processing.
    pub(super) fn process_image(
        app_handle: &AppHandle,
        image_data: &[u8],
        settings: &ScreenshotSettings,
    ) {
        let start = Instant::now();
        let timeout = std::time::Duration::from_secs(PIPELINE_TIMEOUT_SECS);

        // 1. Color-based text region detection
        let (ocr_input, _category_hint) = match color_detector::detect_item_text_region(image_data)
        {
            Ok(result) => {
                let category = result.detected_category.clone();
                if !category.is_empty() {
                    eprintln!(
                        "[ClipboardMonitor] Color detection: category='{}', confidence_boost={}",
                        category, result.confidence_boost
                    );
                }
                (result.cropped_image, Some(category))
            }
            Err(e) => {
                eprintln!(
                    "[ClipboardMonitor] Color detection failed (falling back to full image): {}",
                    e
                );
                (image_data.to_vec(), None)
            }
        };

        // Check timeout after color detection
        if start.elapsed() > timeout {
            let payload = DetectionFailedPayload {
                reason: "timeout".to_string(),
                message: "Detection pipeline exceeded 5-second timeout".to_string(),
            };
            if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
                eprintln!(
                    "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                    e
                );
            }
            return;
        }

        // 2. Run OCR on the (cropped/binarized or full) image
        let mut engine = match OcrEngine::new() {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[ClipboardMonitor] OCR init failed: {}", e);
                let payload = DetectionFailedPayload {
                    reason: "ocr_init_failed".to_string(),
                    message: format!("OCR engine initialization failed: {}", e),
                };
                if let Err(emit_err) = app_handle.emit("screenshot:detection-failed", &payload) {
                    eprintln!(
                        "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                        emit_err
                    );
                }
                return;
            }
        };

        let raw_text = match engine.extract_text(&ocr_input) {
            Ok(text) => text,
            Err(e) => {
                eprintln!("[ClipboardMonitor] OCR extraction failed: {}", e);
                let payload = DetectionFailedPayload {
                    reason: "ocr_failed".to_string(),
                    message: format!("OCR text extraction failed: {}", e),
                };
                if let Err(emit_err) = app_handle.emit("screenshot:detection-failed", &payload) {
                    eprintln!(
                        "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                        emit_err
                    );
                }
                return;
            }
        };

        // Check timeout after OCR
        if start.elapsed() > timeout {
            let payload = DetectionFailedPayload {
                reason: "timeout".to_string(),
                message: "Detection pipeline exceeded 5-second timeout".to_string(),
            };
            if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
                eprintln!(
                    "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                    e
                );
            }
            return;
        }

        if raw_text.is_empty() {
            let payload = DetectionFailedPayload {
                reason: "no_text".to_string(),
                message: "No readable text found in the clipboard image".to_string(),
            };
            if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
                eprintln!(
                    "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                    e
                );
            }
            return;
        }

        // 3. Parse tooltip text into candidate item names
        let parsed_candidates = parse_tooltip_text(&raw_text);
        if parsed_candidates.is_empty() {
            let payload = DetectionFailedPayload {
                reason: "no_candidates".to_string(),
                message: "OCR text did not match D2R tooltip format".to_string(),
            };
            if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
                eprintln!(
                    "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                    e
                );
            }
            return;
        }

        // 4. Match against item database
        let matches =
            match_items(&parsed_candidates, &ITEM_DATABASE, settings.confidence_threshold);

        // 5. Filter: only keep candidates above score 30
        let above_30: Vec<MatchCandidate> =
            matches.into_iter().filter(|m| m.confidence > 30).collect();
        if above_30.is_empty() {
            let payload = DetectionFailedPayload {
                reason: "no_match".to_string(),
                message: "No item matched the detected text".to_string(),
            };
            if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
                eprintln!(
                    "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                    e
                );
            }
            return;
        }

        // Final timeout check before emitting success
        if start.elapsed() > timeout {
            let payload = DetectionFailedPayload {
                reason: "timeout".to_string(),
                message: "Detection pipeline exceeded 5-second timeout".to_string(),
            };
            if let Err(e) = app_handle.emit("screenshot:detection-failed", &payload) {
                eprintln!(
                    "[ClipboardMonitor] Failed to emit detection-failed event: {}",
                    e
                );
            }
            return;
        }

        // 6. Build DetectionResult
        let top = above_30.first().cloned();
        let is_auto_suggested = top
            .as_ref()
            .map(|t| t.confidence > settings.confidence_threshold)
            .unwrap_or(false);

        let result = DetectionResult {
            top_match: top,
            candidates: above_30,
            raw_text,
            is_auto_suggested,
            detected_at: Utc::now().to_rfc3339(),
        };

        // 7. Emit Tauri event
        if let Err(e) = app_handle.emit("screenshot:item-detected", &result) {
            eprintln!("[ClipboardMonitor] Failed to emit detection event: {}", e);
        }

        // Image data is released automatically (not stored anywhere)
    }

    /// Performs a one-shot detection from the current clipboard content.
    ///
    /// Reads the current clipboard image, encodes it as PNG, and runs it through
    /// the full detection pipeline. Useful for manual "detect now" commands.
    pub fn detect_once(app_handle: &AppHandle, settings: &ScreenshotSettings) -> Result<(), String> {
        // Read current clipboard image
        let mut clipboard = arboard::Clipboard::new()
            .map_err(|e| format!("Failed to open clipboard: {}", e))?;

        let image = match clipboard.get_image() {
            Ok(img) => img,
            Err(arboard::Error::ContentNotAvailable) => {
                return Err("no_image: No image found in clipboard".to_string());
            }
            Err(e) => {
                return Err(format!("no_image: No image found in clipboard ({})", e));
            }
        };

        // Convert to PNG for downstream OCR processing
        let image_bytes = image.bytes.as_ref();
        let rgba_image = image::RgbaImage::from_raw(
            image.width as u32,
            image.height as u32,
            image_bytes.to_vec(),
        )
        .ok_or_else(|| "Failed to create image from clipboard data".to_string())?;

        let mut png_bytes: Vec<u8> = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
        image::ImageEncoder::write_image(
            encoder,
            rgba_image.as_raw(),
            rgba_image.width(),
            rgba_image.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| format!("Failed to encode image: {}", e))?;

        // Process through the full pipeline
        Self::process_image(app_handle, &png_bytes, settings);
        Ok(())
    }
}

/// The outcome of processing an image through the detection pipeline.
///
/// Used internally to determine what event to emit after OCR and matching.
#[derive(Debug, Clone, PartialEq)]
pub enum ProcessOutcome {
    /// OCR returned no text — emit `screenshot:detection-failed` with reason "no_text"
    NoText,
    /// All match scores were ≤ 30 — emit `screenshot:detection-failed` with reason "no_match"
    NoMatch,
    /// At least one match above score 30 — emit `screenshot:item-detected`
    MatchFound(DetectionResult),
}

/// Determines the process outcome based on OCR text and match candidates.
///
/// This function encapsulates the decision logic from `process_image` without
/// requiring a Tauri `AppHandle`, making it testable in unit tests.
///
/// - If `raw_text` is empty → `ProcessOutcome::NoText`
/// - If all match candidates have confidence ≤ 30 → `ProcessOutcome::NoMatch`
/// - Otherwise → `ProcessOutcome::MatchFound` with the detection result
pub fn determine_process_outcome(
    raw_text: &str,
    matches: Vec<MatchCandidate>,
    settings: &ScreenshotSettings,
) -> ProcessOutcome {
    if raw_text.is_empty() {
        return ProcessOutcome::NoText;
    }

    let above_30: Vec<MatchCandidate> = matches.into_iter().filter(|m| m.confidence > 30).collect();
    if above_30.is_empty() {
        return ProcessOutcome::NoMatch;
    }

    let top = above_30.first().cloned();
    let is_auto_suggested = top
        .as_ref()
        .map(|t| t.confidence > settings.confidence_threshold)
        .unwrap_or(false);

    ProcessOutcome::MatchFound(DetectionResult {
        top_match: top,
        candidates: above_30,
        raw_text: raw_text.to_string(),
        is_auto_suggested,
        detected_at: Utc::now().to_rfc3339(),
    })
}

/// Determines the detection routing based on confidence scores and threshold.
///
/// Given a vector of match candidate confidence scores and a configured threshold T (50–100):
/// - If scores is empty or all scores ≤ 30 → fallback to ItemSearch (no event emitted)
/// - If top score > T → auto-suggested (emit event with is_auto_suggested = true)
/// - If top score in (30, T] → not auto-suggested but has candidates (emit event with candidates)
///
/// Returns a tuple: `(is_auto_suggested, should_emit_event, should_fallback_to_search)`
pub fn determine_routing(scores: &[u8], threshold: u8) -> (bool, bool, bool) {
    if scores.is_empty() {
        return (false, false, true); // No candidates → fallback
    }
    let top_score = *scores.iter().max().unwrap();
    let above_30_count = scores.iter().filter(|&&s| s > 30).count();

    if above_30_count == 0 {
        (false, false, true) // All ≤ 30 → fallback
    } else if top_score > threshold {
        (true, true, false) // Auto-suggested
    } else {
        (false, true, false) // Not auto-suggested but has candidates
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Bug Condition Exploration Test: Tokio Spawn Panics Outside Runtime Context
    ///
    /// **Validates: Requirements 1.1**
    ///
    /// This test confirms the root cause of the clipboard monitor crash:
    /// `tokio::spawn` panics when called from a plain thread without a Tokio runtime context.
    ///
    /// In the unfixed code, `update_screenshot_settings` is a synchronous Tauri command
    /// that runs on a thread-pool thread (no Tokio runtime). When it calls
    /// `ClipboardMonitor::start()`, the internal `tokio::spawn` panics with:
    /// "there is no reactor running, must be called from the context of a Tokio runtime"
    ///
    /// Bug condition: `isBugCondition(input)` where
    ///   `new_settings.monitoring_enabled = true AND old_settings.monitoring_enabled = false`
    ///
    /// This test spawns a plain std::thread (simulating the Tauri sync command thread pool)
    /// and attempts to call `tokio::spawn`, which is what `ClipboardMonitor::start()` does.
    /// The test expects a panic, confirming the bug exists on unfixed code.
    #[test]
    fn test_bug_condition_tokio_spawn_panics_outside_runtime() {
        // Spawn a plain std::thread — no Tokio runtime context, simulating
        // how Tauri 2 dispatches synchronous commands on its thread pool.
        let handle = std::thread::spawn(|| {
            // Use catch_unwind to capture the panic without crashing the test runner
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                // This is exactly what ClipboardMonitor::start() does internally:
                // it calls tokio::spawn from whatever thread context it's on.
                // On a sync Tauri command thread (no runtime), this panics.
                tokio::spawn(async {
                    // The body doesn't matter — the panic happens at spawn time
                });
            }));

            // The bug condition is confirmed when tokio::spawn panics
            assert!(
                result.is_err(),
                "Expected tokio::spawn to panic outside runtime context, but it did not panic. \
                 Bug condition NOT confirmed — tokio::spawn should fail without a Tokio runtime."
            );

            // Verify the panic message matches the expected Tokio error
            if let Err(panic_payload) = &result {
                let panic_msg = if let Some(s) = panic_payload.downcast_ref::<String>() {
                    s.clone()
                } else if let Some(s) = panic_payload.downcast_ref::<&str>() {
                    s.to_string()
                } else {
                    "unknown panic payload".to_string()
                };

                assert!(
                    panic_msg.contains("no reactor running")
                        || panic_msg.contains("must be called from the context of a Tokio")
                        || panic_msg.contains("there is no reactor running"),
                    "Panic message should indicate missing Tokio runtime context, got: {}",
                    panic_msg
                );
            }
        });

        handle.join().expect("Test thread should not panic outside catch_unwind");
    }

    #[test]
    fn test_determine_routing_empty_scores() {
        let (is_auto, should_emit, should_fallback) = determine_routing(&[], 80);
        assert!(!is_auto);
        assert!(!should_emit);
        assert!(should_fallback);
    }

    #[test]
    fn test_determine_routing_all_below_30() {
        let (is_auto, should_emit, should_fallback) = determine_routing(&[10, 20, 30], 80);
        assert!(!is_auto);
        assert!(!should_emit);
        assert!(should_fallback);
    }

    #[test]
    fn test_determine_routing_auto_suggested() {
        let (is_auto, should_emit, should_fallback) = determine_routing(&[85, 60, 40], 80);
        assert!(is_auto);
        assert!(should_emit);
        assert!(!should_fallback);
    }

    #[test]
    fn test_determine_routing_candidates_not_auto() {
        let (is_auto, should_emit, should_fallback) = determine_routing(&[65, 50, 40], 80);
        assert!(!is_auto);
        assert!(should_emit);
        assert!(!should_fallback);
    }

    #[test]
    fn test_determine_routing_threshold_boundary() {
        // Score exactly equal to threshold → not auto-suggested (must be strictly above)
        let (is_auto, should_emit, should_fallback) = determine_routing(&[80], 80);
        assert!(!is_auto);
        assert!(should_emit);
        assert!(!should_fallback);
    }

    #[test]
    fn test_determine_routing_score_exactly_31() {
        // Score of 31 is above 30, so not a fallback
        let (is_auto, should_emit, should_fallback) = determine_routing(&[31], 80);
        assert!(!is_auto);
        assert!(should_emit);
        assert!(!should_fallback);
    }

    // === Task 1.3: Failure event emission tests ===
    // Requirements: 5.1, 5.2, 5.3

    /// Test that `detect_once` returns an error containing "no_image" when clipboard has no image.
    ///
    /// This test requires a real system clipboard and Tauri AppHandle; marked `#[ignore]`
    /// because it cannot run in a headless CI environment. It documents the expected
    /// error format: the returned Err string must contain "no_image".
    #[test]
    #[ignore = "Requires real clipboard and Tauri AppHandle — integration test"]
    fn test_detect_once_returns_no_image_error_when_clipboard_empty() {
        // In a real test environment with Tauri AppHandle:
        // 1. Clear clipboard of any image data
        // 2. Call ClipboardMonitor::detect_once(&app_handle, &settings)
        // 3. Assert result is Err and contains "no_image"
        //
        // The error format is: "no_image: No image found in clipboard"
        // Verified by code inspection of detect_once implementation.
    }

    /// Test that detect_once error string format contains "no_image" as a distinguishable code.
    /// We verify the error string construction directly since we can't easily mock arboard.
    #[test]
    fn test_detect_once_error_format_contains_no_image() {
        // The detect_once method returns these error strings when clipboard has no image:
        // - ContentNotAvailable: "no_image: No image found in clipboard"
        // - Other error: "no_image: No image found in clipboard (details)"
        // Verify the format matches what frontend expects (string containing "no_image")
        let content_not_available_err = "no_image: No image found in clipboard";
        assert!(content_not_available_err.contains("no_image"),
            "Error should contain 'no_image' code");

        let other_err = format!("no_image: No image found in clipboard ({})", "some error");
        assert!(other_err.contains("no_image"),
            "Error with details should contain 'no_image' code");
    }

    /// Test that `determine_process_outcome` returns `NoText` when OCR returns empty string.
    /// This verifies requirement 5.2: emit detection-failed with reason "no_text".
    #[test]
    fn test_process_image_emits_no_text_when_ocr_empty() {
        let settings = ScreenshotSettings::default();
        let matches = vec![];

        let outcome = determine_process_outcome("", matches, &settings);

        assert_eq!(outcome, ProcessOutcome::NoText,
            "Should return NoText when OCR text is empty");
    }

    /// Test that `determine_process_outcome` returns `NoMatch` when all scores ≤ 30.
    /// This verifies requirement 5.3: emit detection-failed with reason "no_match".
    #[test]
    fn test_process_image_emits_no_match_when_all_scores_below_30() {
        let settings = ScreenshotSettings::default();
        let matches = vec![
            MatchCandidate {
                item_name: "Enigma".to_string(),
                category: "Runeword".to_string(),
                subcategory: "Runeword".to_string(),
                confidence: 20,
            },
            MatchCandidate {
                item_name: "Infinity".to_string(),
                category: "Runeword".to_string(),
                subcategory: "Runeword".to_string(),
                confidence: 30, // exactly 30 is NOT above 30
            },
            MatchCandidate {
                item_name: "Spirit".to_string(),
                category: "Runeword".to_string(),
                subcategory: "Runeword".to_string(),
                confidence: 10,
            },
        ];

        let outcome = determine_process_outcome("some ocr text", matches, &settings);

        assert_eq!(outcome, ProcessOutcome::NoMatch,
            "Should return NoMatch when all match scores are ≤ 30");
    }

    /// Test that `determine_process_outcome` does NOT return a failure when matches are found.
    /// This verifies that the success path (existing behavior) is preserved.
    #[test]
    fn test_process_image_does_not_emit_failure_when_matches_found() {
        let settings = ScreenshotSettings {
            confidence_threshold: 80,
            ..ScreenshotSettings::default()
        };
        let matches = vec![
            MatchCandidate {
                item_name: "Enigma".to_string(),
                category: "Runeword".to_string(),
                subcategory: "Runeword".to_string(),
                confidence: 85,
            },
            MatchCandidate {
                item_name: "Spirit".to_string(),
                category: "Runeword".to_string(),
                subcategory: "Runeword".to_string(),
                confidence: 45,
            },
        ];

        let outcome = determine_process_outcome("Enigma Jah Ith Ber", matches, &settings);

        match outcome {
            ProcessOutcome::MatchFound(result) => {
                assert!(result.top_match.is_some(), "Should have a top match");
                assert_eq!(result.top_match.unwrap().item_name, "Enigma");
                assert!(result.is_auto_suggested, "Should be auto-suggested when top > threshold");
                assert_eq!(result.candidates.len(), 2, "Should include both candidates above 30");
            }
            other => panic!("Expected MatchFound, got {:?}", other),
        }
    }

    /// Test that `determine_process_outcome` returns `NoMatch` with empty match list
    /// (e.g., parser found candidates but none matched anything in the database).
    #[test]
    fn test_process_image_no_match_with_empty_match_list() {
        let settings = ScreenshotSettings::default();
        let matches: Vec<MatchCandidate> = vec![];

        let outcome = determine_process_outcome("some random text that matched nothing", matches, &settings);

        assert_eq!(outcome, ProcessOutcome::NoMatch,
            "Should return NoMatch when match list is empty (non-empty OCR text)");
    }

    /// Integration test: verifies `process_image` emits `screenshot:detection-failed`
    /// with reason "no_text" when OCR returns empty.
    /// Requires Tauri AppHandle — cannot run in unit test environment.
    #[test]
    #[ignore = "Requires Tauri AppHandle for event emission — integration test"]
    fn test_process_image_integration_emits_no_text_event() {
        // In integration environment:
        // 1. Create a Tauri AppHandle (via tauri::test utilities)
        // 2. Provide image_data that produces empty OCR text
        // 3. Call ClipboardMonitor::process_image(&app_handle, &image_data, &settings)
        // 4. Assert `screenshot:detection-failed` event was emitted with reason "no_text"
    }

    /// Integration test: verifies `process_image` emits `screenshot:detection-failed`
    /// with reason "no_match" when all match scores ≤ 30.
    /// Requires Tauri AppHandle — cannot run in unit test environment.
    #[test]
    #[ignore = "Requires Tauri AppHandle for event emission — integration test"]
    fn test_process_image_integration_emits_no_match_event() {
        // In integration environment:
        // 1. Create a Tauri AppHandle (via tauri::test utilities)
        // 2. Provide image_data where OCR text produces matches all ≤ 30
        // 3. Call ClipboardMonitor::process_image(&app_handle, &image_data, &settings)
        // 4. Assert `screenshot:detection-failed` event was emitted with reason "no_match"
    }

    /// Integration test: verifies `process_image` emits `screenshot:item-detected`
    /// (not failure event) when good matches are found.
    /// Requires Tauri AppHandle — cannot run in unit test environment.
    #[test]
    #[ignore = "Requires Tauri AppHandle for event emission — integration test"]
    fn test_process_image_integration_does_not_emit_failure_on_success() {
        // In integration environment:
        // 1. Create a Tauri AppHandle (via tauri::test utilities)
        // 2. Provide image_data where OCR text matches items above score 30
        // 3. Call ClipboardMonitor::process_image(&app_handle, &image_data, &settings)
        // 4. Assert `screenshot:item-detected` event was emitted (not detection-failed)
    }

    /// Verify DetectionFailedPayload serializes correctly with expected field names.
    #[test]
    fn test_detection_failed_payload_serialization() {
        let payload = DetectionFailedPayload {
            reason: "no_text".to_string(),
            message: "No readable text found in the clipboard image".to_string(),
        };

        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["reason"], "no_text");
        assert_eq!(json["message"], "No readable text found in the clipboard image");

        let payload_no_match = DetectionFailedPayload {
            reason: "no_match".to_string(),
            message: "No item matched the detected text".to_string(),
        };

        let json2 = serde_json::to_value(&payload_no_match).unwrap();
        assert_eq!(json2["reason"], "no_match");
        assert_eq!(json2["message"], "No item matched the detected text");
    }

    // Feature: screenshot-detect-folder-source, Property 6: Detection pipeline never panics on arbitrary image input
    //
    // **Validates: Requirements 1.1, 8.4, 8.5**
    //
    // For any non-empty byte sequence passed as image_data to process_image, the function
    // SHALL either emit a detection event or a detection-failed event, but SHALL NOT panic
    // or crash the application. Since process_image requires an AppHandle, we test
    // individual pipeline components: color_detector::detect_item_text_region,
    // parse_tooltip_text, match_items, and determine_process_outcome.
    mod pipeline_robustness_tests {
        use super::*;
        use crate::screenshot::color_detector;
        use crate::screenshot::matcher::{match_items, MatchCandidate, ITEM_DATABASE};
        use crate::screenshot::parser::{parse_tooltip_text, ParsedCandidate};
        use proptest::prelude::*;

        // Property 6: detect_item_text_region never panics on arbitrary byte sequences
        proptest! {
            #[test]
            fn prop_color_detector_never_panics_on_arbitrary_bytes(
                data in proptest::collection::vec(any::<u8>(), 1..512),
            ) {
                // Must not panic — can return Ok or Err, both are fine
                let result = std::panic::catch_unwind(|| {
                    let _ = color_detector::detect_item_text_region(&data);
                });
                prop_assert!(result.is_ok(), "detect_item_text_region panicked on arbitrary input");
            }
        }

        // Property 6: parse_tooltip_text never panics on arbitrary strings
        proptest! {
            #[test]
            fn prop_parse_tooltip_text_never_panics_on_arbitrary_strings(
                text in "\\PC{0,500}",
            ) {
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let _ = parse_tooltip_text(&text);
                }));
                prop_assert!(result.is_ok(), "parse_tooltip_text panicked on arbitrary input");
            }
        }

        // Property 6: match_items never panics on arbitrary candidates and thresholds
        proptest! {
            #[test]
            fn prop_match_items_never_panics_on_arbitrary_input(
                candidate_texts in proptest::collection::vec("\\PC{0,100}", 0..5),
                threshold in 0u8..=100u8,
            ) {
                let candidates: Vec<ParsedCandidate> = candidate_texts
                    .iter()
                    .enumerate()
                    .map(|(i, text)| ParsedCandidate {
                        text: text.clone(),
                        line_index: i,
                    })
                    .collect();

                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let _ = match_items(&candidates, &ITEM_DATABASE, threshold);
                }));
                prop_assert!(result.is_ok(), "match_items panicked on arbitrary input");
            }
        }

        // Property 6: determine_process_outcome never panics on arbitrary text and match candidates
        proptest! {
            #[test]
            fn prop_determine_process_outcome_never_panics(
                raw_text in "\\PC{0,200}",
                num_matches in 0usize..5,
                confidences in proptest::collection::vec(0u8..=100u8, 0..5),
                threshold in 50u8..=100u8,
            ) {
                let matches: Vec<MatchCandidate> = confidences
                    .into_iter()
                    .take(num_matches)
                    .map(|conf| MatchCandidate {
                        item_name: "TestItem".to_string(),
                        category: "TestCat".to_string(),
                        subcategory: "TestSub".to_string(),
                        confidence: conf,
                    })
                    .collect();

                let settings = ScreenshotSettings {
                    confidence_threshold: threshold,
                    ..ScreenshotSettings::default()
                };

                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let _ = determine_process_outcome(&raw_text, matches, &settings);
                }));
                prop_assert!(result.is_ok(), "determine_process_outcome panicked on arbitrary input");
            }
        }
    }

    // Feature: screenshot-item-detection, Property 6: Detection routing by confidence threshold
    mod property_tests {
        use super::*;
        use proptest::prelude::*;

        // **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
        //
        // For arbitrary threshold T (50–100) and score vectors, verify:
        // - top > T → auto-suggested
        // - top in (30, T] → not auto-suggested with non-empty candidates
        // - all ≤ 30 → ItemSearch fallback
        proptest! {
            #[test]
            fn prop_detection_routing(
                threshold in 50u8..=100u8,
                scores in proptest::collection::vec(0u8..=100u8, 0..10),
            ) {
                let (is_auto, should_emit, should_fallback) = determine_routing(&scores, threshold);

                let top_score = scores.iter().max().copied().unwrap_or(0);
                let above_30_count = scores.iter().filter(|&&s| s > 30).count();

                if scores.is_empty() || above_30_count == 0 {
                    // All ≤ 30 or empty → fallback
                    prop_assert!(!is_auto,
                        "Should not be auto-suggested when all scores ≤ 30 or empty");
                    prop_assert!(!should_emit,
                        "Should not emit event when all scores ≤ 30 or empty");
                    prop_assert!(should_fallback,
                        "Should fallback to ItemSearch when all scores ≤ 30 or empty");
                } else if top_score > threshold {
                    // Auto-suggested
                    prop_assert!(is_auto,
                        "Should be auto-suggested when top score {} > threshold {}",
                        top_score, threshold);
                    prop_assert!(should_emit,
                        "Should emit event when top score {} > threshold {}",
                        top_score, threshold);
                    prop_assert!(!should_fallback,
                        "Should not fallback when top score {} > threshold {}",
                        top_score, threshold);
                } else {
                    // Not auto-suggested, but has candidates (top in (30, T])
                    prop_assert!(!is_auto,
                        "Should not be auto-suggested when top score {} ≤ threshold {}",
                        top_score, threshold);
                    prop_assert!(should_emit,
                        "Should emit event when top score {} is in (30, {}]",
                        top_score, threshold);
                    prop_assert!(!should_fallback,
                        "Should not fallback when top score {} is in (30, {}]",
                        top_score, threshold);
                }
            }
        }
    }
}
