use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use super::matcher::{match_items, MatchCandidate, ITEM_DATABASE};
use super::ocr::OcrEngine;
use super::parser::parse_tooltip_text;
use super::settings::ScreenshotSettings;

/// The result of running the full detection pipeline on a clipboard image.
///
/// Contains the top match (if auto-suggested), all viable candidates,
/// the raw OCR text, and metadata about when detection occurred.
#[derive(Debug, Serialize, Deserialize, Clone)]
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

    /// Runs the full detection pipeline: OCR → Parser → Matcher → Event emission.
    ///
    /// 1. Initializes the OCR engine and extracts text from the image
    /// 2. Parses tooltip text into candidate item names
    /// 3. Matches candidates against the item database
    /// 4. Filters results below score 30
    /// 5. Builds a `DetectionResult` and emits it via Tauri event
    ///
    /// Image data is not persisted — it is released after processing.
    fn process_image(
        app_handle: &AppHandle,
        image_data: &[u8],
        settings: &ScreenshotSettings,
    ) {
        // 1. Run OCR
        let mut engine = match OcrEngine::new() {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[ClipboardMonitor] OCR init failed: {}", e);
                return;
            }
        };

        let raw_text = match engine.extract_text(image_data) {
            Ok(text) => text,
            Err(e) => {
                eprintln!("[ClipboardMonitor] OCR extraction failed: {}", e);
                return;
            }
        };

        if raw_text.is_empty() {
            return; // No text found, no event
        }

        // 2. Parse tooltip text into candidate item names
        let parsed_candidates = parse_tooltip_text(&raw_text);
        if parsed_candidates.is_empty() {
            return;
        }

        // 3. Match against item database
        let matches = match_items(&parsed_candidates, &ITEM_DATABASE, settings.confidence_threshold);

        // 4. Filter: only keep candidates above score 30
        let above_30: Vec<MatchCandidate> =
            matches.into_iter().filter(|m| m.confidence > 30).collect();
        if above_30.is_empty() {
            return; // No event if nothing above 30
        }

        // 5. Build DetectionResult
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

        // 6. Emit Tauri event
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

        let image = clipboard
            .get_image()
            .map_err(|e| format!("No image in clipboard: {}", e))?;

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

    /// Feature: screenshot-item-detection, Property 6: Detection routing by confidence threshold
    mod property_tests {
        use super::*;
        use proptest::prelude::*;

        /// **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
        ///
        /// For arbitrary threshold T (50–100) and score vectors, verify:
        /// - top > T → auto-suggested
        /// - top in (30, T] → not auto-suggested with non-empty candidates
        /// - all ≤ 30 → ItemSearch fallback
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
