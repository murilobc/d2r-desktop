//! Bug condition exploration tests for OCR tooltip accuracy fix.
//!
//! These tests encode the EXPECTED behavior. They are designed to FAIL on unfixed code,
//! confirming the bug exists. After the fix is implemented, they should PASS.
//!
//! **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

#[cfg(test)]
mod bug_exploration_property_tests {
    use image::RgbaImage;
    use proptest::prelude::*;

    use crate::screenshot::color_detector::{detect_item_text_region, ITEM_COLORS};
    use crate::screenshot::matcher::{match_items, ITEM_DATABASE};
    use crate::screenshot::parser::ParsedCandidate;

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

    // =========================================================================
    // Property 1: Bug Condition — Contaminated Bounding Box from Non-Tooltip UI Pixels
    //
    // For any synthetic screenshot containing:
    //   - A dark tooltip rectangle at a known position
    //   - Item-colored pixels INSIDE the tooltip (simulating item name text)
    //   - Item-colored pixels OUTSIDE the tooltip at a distant position (inventory contamination)
    //
    // The crop returned by detect_item_text_region must be contained entirely within
    // the tooltip bounds — its width must NOT span from the tooltip to the distant
    // inventory pixels.
    //
    // On UNFIXED code, the bounding box will span both regions (confirming contamination).
    //
    // **Validates: Requirements 1.1, 1.2, 1.3**
    // =========================================================================
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(20))]
        #[test]
        fn prop_crop_must_be_within_tooltip_bounds(
            // Tooltip position (left side of screen)
            tooltip_x in 400u32..500u32,
            tooltip_y in 250u32..320u32,
            tooltip_w in 180u32..250u32,
            tooltip_h in 150u32..200u32,
            // Contaminant position (right side, distant from tooltip)
            contaminant_x in 1100u32..1300u32,
            contaminant_y in 250u32..350u32,
            // Number of colored text pixels inside tooltip (simulating item name)
            text_pixel_count in 30u32..80u32,
            // Number of contaminant pixels outside tooltip
            contaminant_pixel_count in 10u32..40u32,
        ) {
            // Create a 1920x1080 dark game-world image
            let mut img = RgbaImage::new(1920, 1080);
            // Fill with a mid-tone game-world color (not matching any item color)
            for pixel in img.pixels_mut() {
                *pixel = image::Rgba([80, 60, 50, 255]);
            }

            // Paint the dark tooltip background (R<25, G<25, B<25, A>170)
            let tooltip_x2 = tooltip_x + tooltip_w;
            let tooltip_y2 = tooltip_y + tooltip_h;
            fill_rect(&mut img, tooltip_x, tooltip_y, tooltip_x2, tooltip_y2, [10, 10, 10, 200]);

            // Use orange/Rune color (index 2): r=255, g=168, b=0
            let rune_color = &ITEM_COLORS[2]; // Rune: orange
            let text_color = [rune_color.r_center, rune_color.g_center, rune_color.b_center, 255];

            // Paint item-colored pixels INSIDE the tooltip (simulating "Lum Rune" text)
            // Place them in the top portion of the tooltip (first line)
            let text_start_x = tooltip_x + 15;
            let text_start_y = tooltip_y + 12;
            for i in 0..text_pixel_count {
                let px = text_start_x + (i % 60);
                let py = text_start_y + (i / 60);
                if px <= tooltip_x2 && py <= tooltip_y2 {
                    img.put_pixel(px, py, image::Rgba(text_color));
                }
            }

            // Paint contaminant pixels OUTSIDE the tooltip (distant inventory panel)
            // These simulate orange item names visible in the inventory panel
            for i in 0..contaminant_pixel_count {
                let px = contaminant_x + (i % 20);
                let py = contaminant_y + (i / 20);
                if px < 1920 && py < 1080 {
                    img.put_pixel(px, py, image::Rgba(text_color));
                }
            }

            // Encode as PNG and run detection
            let png_data = create_png_from_rgba(&img);
            let result = detect_item_text_region(&png_data).unwrap();

            // The crop should NOT be the fallback (original image)
            prop_assert_ne!(
                result.cropped_image.len(),
                png_data.len(),
                "Detection should find colored pixels and produce a crop (not fallback)"
            );

            // Decode the crop to get its dimensions
            let crop_img = image::load_from_memory(&result.cropped_image)
                .expect("Crop should be a valid image");
            let crop_width = crop_img.width();

            // The crop width should be contained within the tooltip region.
            // Tooltip width is tooltip_w + some padding (10px on each side = 20px extra).
            // If the crop is wider than tooltip_w + 40 (generous padding), it means
            // the bounding box has spanned to the distant contaminant pixels.
            let max_acceptable_width = tooltip_w + 40; // tooltip width + generous padding

            // The distance from tooltip to contaminant is at least ~600px.
            // If crop_width exceeds tooltip region significantly, it's contaminated.
            prop_assert!(
                crop_width <= max_acceptable_width,
                "CONTAMINATION DETECTED: crop width {} exceeds tooltip region width {}. \
                 Expected crop to be within tooltip bounds (x:{}..{}) but it spans to \
                 distant contaminant at x:{}. The bounding box is contaminated by \
                 non-tooltip UI pixels.",
                crop_width,
                max_acceptable_width,
                tooltip_x,
                tooltip_x2,
                contaminant_x
            );
        }
    }

    // =========================================================================
    // Property 2: Confidence Floor — Garbage OCR Text Must Not Match
    //
    // When garbage/nonsense text is passed through match_items with threshold 55,
    // no matches should be returned (since all matches will be below 55% confidence).
    //
    // On UNFIXED code, _threshold is unused, so matches at 31-40% confidence will
    // still be returned.
    //
    // **Validates: Requirements 1.4**
    // =========================================================================
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(30))]
        #[test]
        fn prop_garbage_ocr_text_must_not_match_with_confidence_floor(
            // Generate random consonant-heavy garbage strings long enough to avoid
            // accidental matches with short item names (e.g., "Wind" is only 4 chars,
            // so short garbage like "wbbnd" can score above 55%).
            // Using 10-16 chars ensures no real item name will fuzzy-match above 55%.
            garbage_len in 10usize..16usize,
            garbage_seed in proptest::collection::vec(0u8..26u8, 10..16),
        ) {
            // Build garbage text from consonants only (no vowels = nonsense)
            let consonants = b"bcdfghjklmnpqrstvwxyz";
            let garbage: String = garbage_seed.iter()
                .take(garbage_len)
                .map(|&b| consonants[(b as usize) % consonants.len()] as char)
                .collect();

            let candidates = vec![ParsedCandidate {
                text: garbage.clone(),
                line_index: 0,
            }];

            // Call match_items with threshold 55 (the intended confidence floor)
            let matches = match_items(&candidates, &ITEM_DATABASE, 55);

            // Expected behavior: match_items with threshold=55 should return an EMPTY vec
            // for garbage text, because all fuzzy match scores will be well below 55%.
            // The function should internally filter out matches below the threshold.
            //
            // Actual (buggy) behavior: match_items ignores _threshold entirely and returns
            // all matches with confidence > 0, including garbage matches at 20-40%.
            prop_assert!(
                matches.is_empty(),
                "CONFIDENCE FLOOR BUG: garbage text '{}' produced {} matches from match_items \
                 (threshold=55 is unused!). Top match: '{}' at {}% confidence. \
                 Expected: match_items should return EMPTY when threshold=55 and all \
                 matches score below 55%. The _threshold parameter is ignored.",
                garbage,
                matches.len(),
                matches.first().map(|m| m.item_name.as_str()).unwrap_or("none"),
                matches.first().map(|m| m.confidence).unwrap_or(0),
            );
        }
    }
}
