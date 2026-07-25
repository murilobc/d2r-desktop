use image::{GrayImage, RgbaImage};

/// Known D2R item name text colors with tolerance.
#[derive(Debug, Clone)]
pub struct ColorRange {
    pub r_center: u8,
    pub g_center: u8,
    pub b_center: u8,
    pub tolerance: u8,
    pub category: &'static str,
}

/// All D2R item name colors. Ordered by visual distinctiveness.
pub const ITEM_COLORS: &[ColorRange] = &[
    ColorRange { r_center: 199, g_center: 179, b_center: 119, tolerance: 30, category: "Unique" },
    ColorRange { r_center: 0,   g_center: 255, b_center: 0,   tolerance: 30, category: "Set" },
    ColorRange { r_center: 255, g_center: 168, b_center: 0,   tolerance: 30, category: "Rune" },
    ColorRange { r_center: 255, g_center: 255, b_center: 119, tolerance: 30, category: "Rare" },
    ColorRange { r_center: 107, g_center: 107, b_center: 255, tolerance: 30, category: "Magic" },
    ColorRange { r_center: 255, g_center: 255, b_center: 255, tolerance: 15, category: "Normal" },
];

/// Result of color-based text region detection.
pub struct ColorDetectionResult {
    pub cropped_image: Vec<u8>,
    pub detected_category: String,
    pub confidence_boost: u8,
}

/// Returns true if the given pixel (r, g, b) is within the tolerance of the color range.
fn pixel_matches(r: u8, g: u8, b: u8, color: &ColorRange) -> bool {
    let dr = (r as i16 - color.r_center as i16).unsigned_abs() as u8;
    let dg = (g as i16 - color.g_center as i16).unsigned_abs() as u8;
    let db = (b as i16 - color.b_center as i16).unsigned_abs() as u8;
    dr <= color.tolerance && dg <= color.tolerance && db <= color.tolerance
}

// Returns true if the given pixel is a dark tooltip background pixel.
// D2R tooltip backgrounds are near-black with moderate-to-high alpha.
fn is_dark_pixel(r: u8, g: u8, b: u8, a: u8) -> bool {
    r < 25 && g < 25 && b < 25 && a > 170
}

/// Finds the bounding box of the largest dark rectangular region in the image.
///
/// D2R tooltips have a near-black semi-transparent background. This function
/// locates that background by scanning for contiguous dark pixels and finding
/// the largest rectangle that meets minimum size requirements.
///
/// After finding the largest dark rectangle as a seed, the function expands it
/// upward and downward to include adjacent rows that still have high dark pixel
/// density (≥50%) within the same x-range. This handles tooltips with colored
/// text lines that interrupt the strict dark-pixel continuity.
///
/// Returns `Some((min_x, min_y, max_x, max_y))` if a dark rectangle at least
/// 100px wide × 40px tall is found, or `None` otherwise.
pub fn find_tooltip_bounds(rgba: &RgbaImage) -> Option<(u32, u32, u32, u32)> {
    let (width, height) = rgba.dimensions();

    // Build a boolean row for "is this pixel dark?"
    // Then use the histogram-based maximal rectangle algorithm per row.
    // heights[x] = number of consecutive dark pixels ending at current row for column x.
    let mut heights: Vec<u32> = vec![0; width as usize];

    let mut best_area: u32 = 0;
    let mut best_rect: Option<(u32, u32, u32, u32)> = None; // (min_x, min_y, max_x, max_y)

    for y in 0..height {
        // Update histogram heights for this row
        for x in 0..width {
            let pixel = rgba.get_pixel(x, y);
            if is_dark_pixel(pixel[0], pixel[1], pixel[2], pixel[3]) {
                heights[x as usize] += 1;
            } else {
                heights[x as usize] = 0;
            }
        }

        // Find the largest rectangle in the histogram using a stack-based approach
        let mut stack: Vec<usize> = Vec::new(); // indices into heights

        for x in 0..=(width as usize) {
            let current_height = if x < width as usize { heights[x] } else { 0 };

            while !stack.is_empty() && heights[*stack.last().unwrap()] > current_height {
                let top = stack.pop().unwrap();
                let h = heights[top];
                let w = if stack.is_empty() {
                    x as u32
                } else {
                    (x - stack.last().unwrap() - 1) as u32
                };

                let area = h * w;
                if area > best_area && w >= 100 && h >= 40 {
                    best_area = area;
                    // Compute bounding box
                    let min_x = if stack.is_empty() {
                        0u32
                    } else {
                        (*stack.last().unwrap() as u32) + 1
                    };
                    let max_x = (x as u32) - 1;
                    let max_y = y;
                    let min_y = y - h + 1;
                    best_rect = Some((min_x, min_y, max_x, max_y));
                }
            }

            stack.push(x);
        }
    }

    // Expand the seed rectangle to include adjacent rows with high dark pixel density.
    // Tooltip text lines (colored pixels) break strict continuity but the surrounding
    // rows still have mostly dark pixels. Expanding captures the full tooltip extent.
    if let Some((min_x, min_y, max_x, max_y)) = best_rect {
        let rect_width = max_x - min_x + 1;
        // Require at least 50% of the row's pixels within the x-range to be dark
        let density_threshold = rect_width / 2;

        // Expand upward
        let mut expanded_min_y = min_y;
        if min_y > 0 {
            let mut y = min_y - 1;
            loop {
                let mut dark_count: u32 = 0;
                for x in min_x..=max_x {
                    let pixel = rgba.get_pixel(x, y);
                    if is_dark_pixel(pixel[0], pixel[1], pixel[2], pixel[3]) {
                        dark_count += 1;
                    }
                }
                if dark_count >= density_threshold {
                    expanded_min_y = y;
                } else {
                    break;
                }
                if y == 0 {
                    break;
                }
                y -= 1;
            }
        }

        // Expand downward
        let mut expanded_max_y = max_y;
        for y in (max_y + 1)..height {
            let mut dark_count: u32 = 0;
            for x in min_x..=max_x {
                let pixel = rgba.get_pixel(x, y);
                if is_dark_pixel(pixel[0], pixel[1], pixel[2], pixel[3]) {
                    dark_count += 1;
                }
            }
            if dark_count >= density_threshold {
                expanded_max_y = y;
            } else {
                break;
            }
        }

        // Only return if the expanded rectangle still meets minimum size
        let final_h = expanded_max_y - expanded_min_y + 1;
        if rect_width >= 100 && final_h >= 40 {
            return Some((min_x, expanded_min_y, max_x, expanded_max_y));
        }
    }

    best_rect
}

/// Detects the item name text region based on D2R color conventions.
///
/// Algorithm (tooltip-first path):
/// 1. Decode image to RGBA
/// 2. Attempt to find tooltip bounds via dark background detection
/// 3. If tooltip found: extract first line for each color, pick best, crop + binarize
/// 4. If tooltip NOT found: fall through to legacy top-50% scan
///
/// Legacy fallback (no tooltip):
/// 1. Scan top 50% of image for item-colored pixels
/// 2. For each known color, find pixels within tolerance
/// 3. Select the color with the most matching pixels
/// 4. Expand bounding box by 10px padding
/// 5. Binarize: matching pixels → white (255), rest → black (0)
/// 6. Return cropped + binarized PNG for OCR
///
/// If no colored text region is found, returns the full image as-is (fallback).
pub fn detect_item_text_region(image_data: &[u8]) -> Result<ColorDetectionResult, String> {
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // --- Tooltip-first path ---
    // Attempt to locate the tooltip background and constrain scanning to it
    if let Some(tooltip_bounds) = find_tooltip_bounds(&rgba) {
        // For each item color, find the first-line region within the tooltip
        // and count matching pixels to determine the best color
        let mut best_color_idx: Option<usize> = None;
        let mut best_pixel_count: u32 = 0;
        let mut best_first_line: (u32, u32, u32, u32) = (0, 0, 0, 0);

        for (color_idx, color) in ITEM_COLORS.iter().enumerate() {
            if let Some(first_line) = extract_first_line_region(&rgba, tooltip_bounds, color) {
                // Count matching pixels within the first-line region
                let (fl_min_x, fl_min_y, fl_max_x, fl_max_y) = first_line;
                let mut count: u32 = 0;
                for y in fl_min_y..=fl_max_y {
                    for x in fl_min_x..=fl_max_x {
                        let pixel = rgba.get_pixel(x, y);
                        if pixel_matches(pixel[0], pixel[1], pixel[2], color) {
                            count += 1;
                        }
                    }
                }

                if count > best_pixel_count {
                    best_pixel_count = count;
                    best_color_idx = Some(color_idx);
                    best_first_line = first_line;
                }
            }
        }

        // If we found colored text in the tooltip first line, crop and binarize it
        if let Some(color_idx) = best_color_idx {
            let color = &ITEM_COLORS[color_idx];
            let (fl_min_x, fl_min_y, fl_max_x, fl_max_y) = best_first_line;

            let crop_w = fl_max_x - fl_min_x + 1;
            let crop_h = fl_max_y - fl_min_y + 1;

            // Crop the first-line region from the RGBA image
            let cropped_rgba =
                image::imageops::crop_imm(&rgba, fl_min_x, fl_min_y, crop_w, crop_h).to_image();

            // Binarize: matching pixels → white, rest → black
            let binarized = binarize_region(&cropped_rgba, color);

            // Encode binarized image to PNG
            let mut png_bytes: Vec<u8> = Vec::new();
            let encoder =
                image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
            image::ImageEncoder::write_image(
                encoder,
                binarized.as_raw(),
                binarized.width(),
                binarized.height(),
                image::ExtendedColorType::L8,
            )
            .map_err(|e| format!("Failed to encode binarized image: {}", e))?;

            return Ok(ColorDetectionResult {
                cropped_image: png_bytes,
                detected_category: color.category.to_string(),
                confidence_boost: 15,
            });
        }
        // If no colored text found in tooltip, fall through to legacy scan
    }

    // --- Legacy fallback path (no tooltip detected or no colored text in tooltip) ---
    let scan_height = height / 2; // top 50%

    // For each color, find matching pixels in the top half and compute bounding box
    let mut best_color_idx: Option<usize> = None;
    let mut best_pixel_count: u32 = 0;
    let mut best_bbox: (u32, u32, u32, u32) = (0, 0, 0, 0); // min_x, min_y, max_x, max_y

    for (color_idx, color) in ITEM_COLORS.iter().enumerate() {
        let mut min_x = width;
        let mut min_y = scan_height;
        let mut max_x = 0u32;
        let mut max_y = 0u32;
        let mut count = 0u32;

        for y in 0..scan_height {
            for x in 0..width {
                let pixel = rgba.get_pixel(x, y);
                if pixel_matches(pixel[0], pixel[1], pixel[2], color) {
                    count += 1;
                    if x < min_x { min_x = x; }
                    if y < min_y { min_y = y; }
                    if x > max_x { max_x = x; }
                    if y > max_y { max_y = y; }
                }
            }
        }

        // Select the color with the most matching pixels (largest region)
        if count > best_pixel_count {
            best_pixel_count = count;
            best_color_idx = Some(color_idx);
            best_bbox = (min_x, min_y, max_x, max_y);
        }
    }

    // If no matching pixels found, return the original image data as fallback
    if best_pixel_count == 0 || best_color_idx.is_none() {
        return Ok(ColorDetectionResult {
            cropped_image: image_data.to_vec(),
            detected_category: String::new(),
            confidence_boost: 0,
        });
    }

    let color = &ITEM_COLORS[best_color_idx.unwrap()];
    let (min_x, min_y, max_x, max_y) = best_bbox;

    // Expand bounding box by 10px padding (clamped to image bounds)
    let pad = 10u32;
    let crop_x = min_x.saturating_sub(pad);
    let crop_y = min_y.saturating_sub(pad);
    let crop_x2 = (max_x + pad).min(width - 1);
    let crop_y2 = (max_y + pad).min(height - 1);
    let crop_w = crop_x2 - crop_x + 1;
    let crop_h = crop_y2 - crop_y + 1;

    // Crop the region
    let cropped_rgba = image::imageops::crop_imm(&rgba, crop_x, crop_y, crop_w, crop_h).to_image();

    // Binarize: matching pixels → white, rest → black
    let binarized = binarize_region(&cropped_rgba, color);

    // Encode binarized image to PNG
    let mut png_bytes: Vec<u8> = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
    image::ImageEncoder::write_image(
        encoder,
        binarized.as_raw(),
        binarized.width(),
        binarized.height(),
        image::ExtendedColorType::L8,
    )
    .map_err(|e| format!("Failed to encode binarized image: {}", e))?;

    Ok(ColorDetectionResult {
        cropped_image: png_bytes,
        detected_category: color.category.to_string(),
        confidence_boost: 10,
    })
}

/// Binarizes a region: pixels matching the target color become white, rest black.
pub fn binarize_region(image: &RgbaImage, color: &ColorRange) -> GrayImage {
    let (width, height) = image.dimensions();
    let mut output = GrayImage::new(width, height);

    for y in 0..height {
        for x in 0..width {
            let pixel = image.get_pixel(x, y);
            let value = if pixel_matches(pixel[0], pixel[1], pixel[2], color) {
                255u8
            } else {
                0u8
            };
            output.put_pixel(x, y, image::Luma([value]));
        }
    }

    output
}

/// Extracts the bounding box of the first line of text matching the given color
/// within the specified tooltip bounds.
///
/// Scans from the top of the tooltip region downward to find the first row containing
/// pixels that match the target item color, then determines the vertical extent of that
/// first text line. Returns a tight bounding box with 5px padding (clamped to tooltip bounds)
/// for OCR readability, or None if no matching pixels are found.
pub fn extract_first_line_region(
    rgba: &RgbaImage,
    tooltip_bounds: (u32, u32, u32, u32),
    color: &ColorRange,
) -> Option<(u32, u32, u32, u32)> {
    let (tb_min_x, tb_min_y, tb_max_x, tb_max_y) = tooltip_bounds;

    // Find the first row (from top) within tooltip bounds that has a matching pixel
    let mut first_row: Option<u32> = None;
    for y in tb_min_y..=tb_max_y {
        for x in tb_min_x..=tb_max_x {
            let pixel = rgba.get_pixel(x, y);
            if pixel_matches(pixel[0], pixel[1], pixel[2], color) {
                first_row = Some(y);
                break;
            }
        }
        if first_row.is_some() {
            break;
        }
    }

    let first_row = first_row?;

    // Now find the vertical extent of this first text line.
    // Scan downward from first_row: the line continues as long as rows contain
    // matching pixels. Allow small gaps (up to 2px) for anti-aliased text edges.
    let mut last_row = first_row;
    let mut gap = 0u32;
    let max_gap = 2;

    for y in (first_row + 1)..=tb_max_y {
        let mut row_has_match = false;
        for x in tb_min_x..=tb_max_x {
            let pixel = rgba.get_pixel(x, y);
            if pixel_matches(pixel[0], pixel[1], pixel[2], color) {
                row_has_match = true;
                break;
            }
        }

        if row_has_match {
            last_row = y;
            gap = 0;
        } else {
            gap += 1;
            if gap > max_gap {
                break;
            }
        }
    }

    // Find horizontal extent (min_x, max_x) across the first line rows
    let mut min_x = tb_max_x;
    let mut max_x = tb_min_x;
    for y in first_row..=last_row {
        for x in tb_min_x..=tb_max_x {
            let pixel = rgba.get_pixel(x, y);
            if pixel_matches(pixel[0], pixel[1], pixel[2], color) {
                if x < min_x {
                    min_x = x;
                }
                if x > max_x {
                    max_x = x;
                }
            }
        }
    }

    // Safety check: ensure we found valid horizontal extent
    if max_x < min_x {
        return None;
    }

    // Add 5px padding, clamped to tooltip bounds
    let pad = 5u32;
    let padded_min_x = min_x.saturating_sub(pad).max(tb_min_x);
    let padded_min_y = first_row.saturating_sub(pad).max(tb_min_y);
    let padded_max_x = (max_x + pad).min(tb_max_x);
    let padded_max_y = (last_row + pad).min(tb_max_y);

    Some((padded_min_x, padded_min_y, padded_max_x, padded_max_y))
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // Helper: creates a minimal valid PNG from an RGBA image
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

    // Validates: Requirements 2.2, 2.5
    // Property 1: Color detection identifies known D2R item colors
    //
    // For any pixel with RGB values within the defined tolerance of a known D2R item color,
    // detect_item_text_region SHALL include that pixel in the candidate text region and
    // return the correct category label.
    proptest! {
        #[test]
        fn prop_color_detection_identifies_known_colors(
            color_idx in 0..6usize,
            // Image dimensions (small for speed)
            width in 10u32..50u32,
            height in 10u32..50u32,
            // Position of the colored pixel block in the top half
            block_x in 0u32..10u32,
            block_y in 0u32..5u32,
            // Random offsets within tolerance for the color pixel
            r_offset in 0u8..30u8,
            g_offset in 0u8..30u8,
            b_offset in 0u8..30u8,
        ) {
            let color = &ITEM_COLORS[color_idx];
            let tol = color.tolerance;

            // Clamp offsets to actual tolerance
            let r_off = r_offset % (tol + 1);
            let g_off = g_offset % (tol + 1);
            let b_off = b_offset % (tol + 1);

            // Generate a pixel within tolerance (randomly above or below center)
            let r = if r_off <= tol / 2 {
                color.r_center.saturating_add(r_off)
            } else {
                color.r_center.saturating_sub(r_off)
            };
            let g = if g_off <= tol / 2 {
                color.g_center.saturating_add(g_off)
            } else {
                color.g_center.saturating_sub(g_off)
            };
            let b = if b_off <= tol / 2 {
                color.b_center.saturating_add(b_off)
            } else {
                color.b_center.saturating_sub(b_off)
            };

            // Create a dark image with a small block of the target color pixels
            let mut rgba = RgbaImage::new(width, height);
            // Fill with dark pixels (far from any item color)
            for pixel in rgba.pixels_mut() {
                *pixel = image::Rgba([50, 50, 50, 255]);
            }

            // Place a 3x3 block of matching-color pixels in the top half
            let px = block_x.min(width - 3);
            let py = block_y.min(height / 2 - 3);
            for dy in 0..3 {
                for dx in 0..3 {
                    rgba.put_pixel(px + dx, py + dy, image::Rgba([r, g, b, 255]));
                }
            }

            let png_data = create_png_from_rgba(&rgba);
            let result = detect_item_text_region(&png_data).unwrap();

            // The detected category should match the expected color
            prop_assert_eq!(
                &result.detected_category,
                color.category,
                "Expected category '{}' for color at index {}, got '{}'",
                color.category, color_idx, result.detected_category
            );
        }
    }

    // Validates: Requirements 2.4, 2.7
    // Property 2: Binarization produces valid binary output
    //
    // For any RGBA image input and any ColorRange, calling binarize_region SHALL produce
    // a grayscale image of the same dimensions where every pixel value is either 0 or 255
    // (pure binary), with no intermediate grayscale values.
    proptest! {
        #[test]
        fn prop_binarization_produces_valid_binary_output(
            width in 1u32..30u32,
            height in 1u32..30u32,
            color_idx in 0..6usize,
            pixels in proptest::collection::vec(0u8..=255u8, 4..3600),
        ) {
            let color = &ITEM_COLORS[color_idx];

            // Build an RGBA image from random pixel data
            let pixel_count = (width * height * 4) as usize;
            let mut pixel_data = pixels;
            // Pad or truncate to exact size needed
            pixel_data.resize(pixel_count, 128);

            let rgba = RgbaImage::from_raw(width, height, pixel_data)
                .expect("Should create valid RGBA image from raw data");

            let result = binarize_region(&rgba, color);

            // Verify dimensions match
            prop_assert_eq!(result.width(), width, "Output width must match input");
            prop_assert_eq!(result.height(), height, "Output height must match input");

            // Verify all pixels are either 0 or 255
            for y in 0..height {
                for x in 0..width {
                    let pixel_val = result.get_pixel(x, y).0[0];
                    prop_assert!(
                        pixel_val == 0 || pixel_val == 255,
                        "Pixel at ({}, {}) has value {} — expected 0 or 255",
                        x, y, pixel_val
                    );
                }
            }
        }
    }

    // Validates: Requirement 2.6
    // Property 3: Color detection fallback on no-match images
    //
    // For any image containing no pixels within tolerance of any known D2R item color,
    // detect_item_text_region SHALL return the full original image data unmodified
    // (byte-for-byte identical to input).
    proptest! {
        #[test]
        fn prop_color_detection_fallback_on_no_match_images(
            width in 2u32..30u32,
            height in 2u32..30u32,
            r in 40u8..=60u8,
            g in 40u8..=60u8,
            b in 40u8..=60u8,
        ) {
            // Create an image filled with pixels far from all known D2R colors
            let mut rgba = RgbaImage::new(width, height);
            for pixel in rgba.pixels_mut() {
                *pixel = image::Rgba([r, g, b, 255]);
            }

            let png_data = create_png_from_rgba(&rgba);
            let result = detect_item_text_region(&png_data).unwrap();

            // The result should be the original image data byte-for-byte
            prop_assert_eq!(
                &result.cropped_image,
                &png_data,
                "Fallback should return original image data unmodified"
            );

            // Category should be empty (no color detected)
            prop_assert_eq!(
                &result.detected_category,
                "",
                "Fallback should have empty category"
            );

            // Confidence boost should be 0
            prop_assert_eq!(
                result.confidence_boost,
                0u8,
                "Fallback should have zero confidence boost"
            );
        }
    }
}
