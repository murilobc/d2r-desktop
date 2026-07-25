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

/// Detects the item name text region based on D2R color conventions.
///
/// Algorithm:
/// 1. Scan top 50% of image (item names appear at top of tooltip)
/// 2. For each known color, find pixels within tolerance
/// 3. Cluster adjacent matching pixels into regions
/// 4. Select the largest horizontal region (item name is widest text)
/// 5. Expand bounding box by 10px padding
/// 6. Binarize: matching pixels → white (255), rest → black (0)
/// 7. Return cropped + binarized PNG for OCR
///
/// If no colored text region is found, returns the full image as-is (fallback).
pub fn detect_item_text_region(image_data: &[u8]) -> Result<ColorDetectionResult, String> {
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
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
