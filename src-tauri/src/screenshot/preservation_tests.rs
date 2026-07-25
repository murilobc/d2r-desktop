//! Preservation property tests for OCR tooltip accuracy fix.
//!
//! These tests verify that behaviors NOT involving the bug condition remain unchanged
//! after the fix is applied. They capture CURRENT behavior on unfixed code and must
//! continue to pass after the fix.
//!
//! Properties tested:
//! - No-Tooltip Fallback: images with no dark rectangle and no item-colored pixels
//!   return original bytes, empty category, zero confidence_boost
//! - normalize_ocr_chars idempotency: applying normalize twice == applying once
//! - Single cluster detection: a single cluster of item-colored pixels in the top half
//!   (no distant contamination) produces the correct detected category
//!
//! **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

#[cfg(test)]
mod ocr_preservation_property_tests {
    use image::RgbaImage;
    use proptest::prelude::*;

    use crate::screenshot::color_detector::{detect_item_text_region, ITEM_COLORS};
    use crate::screenshot::matcher::normalize_ocr_chars;

    // Helper: creates a PNG from an RGBA image
    fn create_png_from_rgba(rgba: &RgbaImage) -> Vec<u8> {
        let mut png_bytes: Vec<u8> = Vec::new();
        let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
        image::ImageEncoder::write_image(
            encoder,
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
        )
        .expect("PNG encoding should not fail for valid RGBA image");
        png_bytes
    }

    // Helper: paint a filled rectangle of a given RGBA color onto an image
    fn fill_rect(img: &mut RgbaImage, x1: u32, y1: u32, x2: u32, y2: u32, color: [u8; 4]) {
        for y in y1..=y2.min(img.height() - 1) {
            for x in x1..=x2.min(img.width() - 1) {
                img.put_pixel(x, y, image::Rgba(color));
            }
        }
    }

    // Helper: check if a color is within tolerance of any known item color
    fn matches_any_item_color(r: u8, g: u8, b: u8) -> bool {
        for color in ITEM_COLORS {
            let dr = (r as i16 - color.r_center as i16).unsigned_abs() as u8;
            let dg = (g as i16 - color.g_center as i16).unsigned_abs() as u8;
            let db = (b as i16 - color.b_center as i16).unsigned_abs() as u8;
            if dr <= color.tolerance && dg <= color.tolerance && db <= color.tolerance {
                return true;
            }
        }
        false
    }

    // =========================================================================
    // Property: No-Tooltip Fallback Preservation
    //
    // For all random RGBA images with no dark rectangle (no pixel with R<25, G<25,
    // B<25, A>170 in a 100x40 contiguous region) AND no item-colored pixels:
    // detect_item_text_region returns original bytes, empty category, zero boost.
    //
    // This captures the fallback behavior that must be preserved after the fix
    // adds tooltip-first detection.
    //
    // **Validates: Requirements 3.1, 3.3**
    // =========================================================================
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(30))]
        #[test]
        fn prop_no_tooltip_fallback_returns_original(
            // Use a mid-range base color far from any item color
            base_r in 70u8..90u8,
            base_g in 70u8..90u8,
            base_b in 70u8..90u8,
            // Small variation for visual variety (still far from item colors)
            var in 0u8..10u8,
            // Image dimensions (reasonable size for speed)
            width in 100u32..300u32,
            height in 100u32..300u32,
        ) {
            // Verify our base color doesn't accidentally match any item color
            prop_assume!(!matches_any_item_color(base_r, base_g, base_b));
            prop_assume!(!matches_any_item_color(
                base_r.saturating_add(var),
                base_g.saturating_add(var),
                base_b.saturating_add(var)
            ));

            // Create image filled with safe mid-tone pixels (no item color match)
            let mut rgba = RgbaImage::new(width, height);
            for pixel in rgba.pixels_mut() {
                *pixel = image::Rgba([base_r, base_g, base_b, 255]);
            }

            let png_data = create_png_from_rgba(&rgba);
            let result = detect_item_text_region(&png_data).unwrap();

            // Fallback: original bytes returned unmodified
            prop_assert_eq!(
                &result.cropped_image,
                &png_data,
                "No-tooltip fallback should return original image data"
            );

            // Empty category
            prop_assert_eq!(
                &result.detected_category,
                "",
                "No-tooltip fallback should have empty category"
            );

            // Zero confidence boost
            prop_assert_eq!(
                result.confidence_boost,
                0u8,
                "No-tooltip fallback should have zero confidence boost"
            );
        }
    }

    // =========================================================================
    // Property: normalize_ocr_chars Idempotency
    //
    // For all random text inputs:
    //   normalize_ocr_chars(normalize_ocr_chars(x)) == normalize_ocr_chars(x)
    //
    // This ensures the normalization is stable — applying it multiple times
    // does not change the result beyond the first application.
    //
    // **Validates: Requirement 3.4**
    // =========================================================================
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(200))]
        #[test]
        fn prop_normalize_ocr_chars_is_idempotent(
            input in "\\PC{0,100}",
        ) {
            let once = normalize_ocr_chars(&input);
            let twice = normalize_ocr_chars(&once);

            prop_assert_eq!(
                &once,
                &twice,
                "normalize_ocr_chars must be idempotent: \
                 input={:?}, once={:?}, twice={:?}",
                input, once, twice
            );
        }
    }

    // =========================================================================
    // Property: Single Cluster Detection — Correct Category
    //
    // For all images with a single cluster of item-colored pixels placed in the
    // top half of the image (no distant contamination), detect_item_text_region
    // should detect the planted color's category correctly.
    //
    // This verifies that clean single-source detection continues to work after
    // the fix modifies the detection control flow.
    //
    // **Validates: Requirement 3.2**
    // =========================================================================
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(30))]
        #[test]
        fn prop_single_cluster_detects_correct_category(
            // Which item color to plant
            color_idx in 0usize..6usize,
            // Cluster position in top half of a 400x400 image
            cluster_x in 50u32..300u32,
            cluster_y in 20u32..150u32,
            // Cluster size (enough pixels to be the largest match)
            cluster_w in 30u32..60u32,
            cluster_h in 5u32..15u32,
        ) {
            let target_color = &ITEM_COLORS[color_idx];
            let img_width = 400u32;
            let img_height = 400u32;

            // Ensure the cluster fits in the top half
            let max_y = cluster_y + cluster_h;
            prop_assume!(max_y < img_height / 2);
            let max_x = cluster_x + cluster_w;
            prop_assume!(max_x < img_width);

            // Create image with a neutral background that doesn't match any item color
            let mut rgba = RgbaImage::new(img_width, img_height);
            for pixel in rgba.pixels_mut() {
                *pixel = image::Rgba([80, 60, 50, 255]);
            }

            // Paint a single cluster of item-colored pixels in the top half
            let paint_color = [
                target_color.r_center,
                target_color.g_center,
                target_color.b_center,
                255,
            ];
            fill_rect(
                &mut rgba,
                cluster_x,
                cluster_y,
                cluster_x + cluster_w,
                cluster_y + cluster_h,
                paint_color,
            );

            // Ensure background doesn't accidentally match any item color
            prop_assume!(!matches_any_item_color(80, 60, 50));

            let png_data = create_png_from_rgba(&rgba);
            let result = detect_item_text_region(&png_data).unwrap();

            // The detected category should match the planted color
            prop_assert_eq!(
                &result.detected_category,
                target_color.category,
                "Single cluster of {} pixels should detect category '{}', got '{}'",
                target_color.category,
                target_color.category,
                result.detected_category
            );

            // Should NOT be the fallback (original bytes)
            prop_assert_ne!(
                result.cropped_image.len(),
                png_data.len(),
                "Single cluster should produce a crop, not the fallback"
            );

            // Confidence boost should be non-zero (we detected something)
            prop_assert!(
                result.confidence_boost > 0,
                "Single cluster detection should have non-zero confidence boost"
            );
        }
    }
}
