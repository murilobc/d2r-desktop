use image::{GrayImage, ImageEncoder, RgbaImage};

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
/// Tolerances are generous to handle different monitor profiles, D2R rendering
/// modes (DX11/DX12), HDR, and JPEG compression artifacts in screenshots.
/// JPEG at D2R default quality (~85%) can shift colors by up to ±25 per channel.
pub const ITEM_COLORS: &[ColorRange] = &[
    ColorRange { r_center: 199, g_center: 179, b_center: 119, tolerance: 45, category: "Unique" },
    ColorRange { r_center: 0,   g_center: 255, b_center: 0,   tolerance: 50, category: "Set" },
    ColorRange { r_center: 255, g_center: 168, b_center: 0,   tolerance: 50, category: "Rune" },
    ColorRange { r_center: 255, g_center: 255, b_center: 119, tolerance: 50, category: "Rare" },
    ColorRange { r_center: 107, g_center: 107, b_center: 255, tolerance: 50, category: "Magic" },
    ColorRange { r_center: 255, g_center: 255, b_center: 255, tolerance: 20, category: "Normal" },
    ColorRange { r_center: 148, g_center: 148, b_center: 148, tolerance: 20, category: "Socketed" },
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
/// Uses spatial clustering of colored pixels to identify the item name text
/// region, selecting the cluster with the best text-like aspect ratio and density.
pub fn detect_item_text_region(image_data: &[u8]) -> Result<ColorDetectionResult, String> {
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    let rgba = img.to_rgba8();
    let (img_width, img_height) = rgba.dimensions();

    let scale_factor = img_height as f64 / 1080.0;
    let connectivity_gap = (5.0 * scale_factor).round() as u32;

    // Size constraints scaled by image height
    let min_width = (img_height as f64 * 0.03).round() as u32;
    let max_width = (img_height as f64 * 0.35).round() as u32;
    let min_height_px = (img_height as f64 * 0.01).round() as u32;
    let max_height_px = (img_height as f64 * 0.03).round() as u32;

    // Collect matching pixel coordinates per color in a single image pass
    let num_colors = ITEM_COLORS.len();
    let mut pixels_per_color: Vec<Vec<(u32, u32)>> = vec![Vec::new(); num_colors];

    for y in 0..img_height {
        for x in 0..img_width {
            let p = rgba.get_pixel(x, y);
            let (pr, pg, pb) = (p[0], p[1], p[2]);
            for (color_idx, color) in ITEM_COLORS.iter().enumerate() {
                if pixel_matches(pr, pg, pb, color) {
                    pixels_per_color[color_idx].push((x, y));
                    break; // Each pixel matches at most one color (first match wins)
                }
            }
        }
    }

    let mut best_score: f64 = 0.0;
    let mut best_color_idx: usize = 0;
    let mut best_bbox: (u32, u32, u32, u32) = (0, 0, 0, 0);

    for (color_idx, pixels) in pixels_per_color.iter().enumerate() {
        if pixels.is_empty() {
            continue;
        }

        // Pixels are already sorted by (y, x) since we scanned row by row
        // Group into row-segments
        let segments = build_row_segments(pixels, connectivity_gap);

        // Merge segments into clusters
        let clusters = merge_segments_into_clusters(&segments);

        // Score each cluster
        for cluster in &clusters {
            let (c_min_x, c_min_y, c_max_x, c_max_y) = cluster_bounding_box(cluster);
            let c_width = c_max_x - c_min_x + 1;
            let c_height = c_max_y - c_min_y + 1;

            // Apply size constraints
            if c_width < min_width || c_width > max_width {
                continue;
            }
            if c_height < min_height_px || c_height > max_height_px {
                continue;
            }

            let pixel_count = cluster_pixel_count(cluster);
            let aspect_ratio = c_width as f64 / c_height as f64;
            let density = pixel_count as f64 / (c_width as f64 * c_height as f64);

            let aspect_ratio_score = if (4.0..=15.0).contains(&aspect_ratio) {
                1.0
            } else if (3.0..4.0).contains(&aspect_ratio) || (15.0..=25.0).contains(&aspect_ratio)
            {
                0.5
            } else {
                0.0
            };

            let density_score = if (0.15..=0.60).contains(&density) {
                1.0
            } else if (0.10..0.15).contains(&density) || (0.60..=0.80).contains(&density) {
                0.5
            } else {
                0.0
            };

            let score = pixel_count as f64 * aspect_ratio_score * density_score;

            if score > 0.0 && score > best_score {
                best_score = score;
                best_color_idx = color_idx;
                best_bbox = (c_min_x, c_min_y, c_max_x, c_max_y);
            }
        }
    }

    // Fallback: no valid cluster found — try quadrant scanning before giving up
    if best_score == 0.0 {
        // D2R tooltips appear wherever the cursor is, but commonly in right or center
        // of the screen. Try processing quadrants of the image to find the tooltip.
        // Right half, then left half, then center strip — cover common tooltip positions.
        let quadrants: &[(u32, u32, u32, u32)] = &[
            // (x_start_frac_num, x_start_frac_den, x_end_frac_num, x_end_frac_den) as fractions
        ];
        let _ = quadrants; // unused for now — implement quadrant detection below

        // Sub-image regions to scan: right third, left third, center third vertically
        let region_defs: &[(f64, f64, f64, f64)] = &[
            (0.5, 0.0, 1.0, 1.0),   // right half
            (0.0, 0.0, 0.5, 1.0),   // left half
            (0.25, 0.2, 0.75, 0.8), // center rectangle
        ];

        for &(x0f, y0f, x1f, y1f) in region_defs {
            let rx0 = (img_width as f64 * x0f) as u32;
            let ry0 = (img_height as f64 * y0f) as u32;
            let rx1 = (img_width as f64 * x1f).min(img_width as f64 - 1.0) as u32;
            let ry1 = (img_height as f64 * y1f).min(img_height as f64 - 1.0) as u32;

            // Re-scan this sub-region
            let mut sub_pixels_per_color: Vec<Vec<(u32, u32)>> = vec![Vec::new(); num_colors];
            for y in ry0..=ry1 {
                for x in rx0..=rx1 {
                    let p = rgba.get_pixel(x, y);
                    let (pr, pg, pb) = (p[0], p[1], p[2]);
                    for (color_idx, color) in ITEM_COLORS.iter().enumerate() {
                        if pixel_matches(pr, pg, pb, color) {
                            sub_pixels_per_color[color_idx].push((x, y));
                            break;
                        }
                    }
                }
            }

            for (color_idx, pixels) in sub_pixels_per_color.iter().enumerate() {
                if pixels.is_empty() { continue; }
                let segments = build_row_segments(pixels, connectivity_gap);
                let clusters = merge_segments_into_clusters(&segments);
                for cluster in &clusters {
                    let (c_min_x, c_min_y, c_max_x, c_max_y) = cluster_bounding_box(cluster);
                    let c_width = c_max_x - c_min_x + 1;
                    let c_height = c_max_y - c_min_y + 1;
                    if c_width < min_width || c_width > max_width { continue; }
                    if c_height < min_height_px || c_height > max_height_px { continue; }
                    let pixel_count = cluster_pixel_count(cluster);
                    let aspect_ratio = c_width as f64 / c_height as f64;
                    let density = pixel_count as f64 / (c_width as f64 * c_height as f64);
                    let aspect_ratio_score = if (4.0..=15.0).contains(&aspect_ratio) { 1.0 }
                        else if (3.0..4.0).contains(&aspect_ratio) || (15.0..=25.0).contains(&aspect_ratio) { 0.5 }
                        else { 0.0 };
                    let density_score = if (0.15..=0.60).contains(&density) { 1.0 }
                        else if (0.10..0.15).contains(&density) || (0.60..=0.80).contains(&density) { 0.5 }
                        else { 0.0 };
                    let score = pixel_count as f64 * aspect_ratio_score * density_score;
                    if score > 0.0 && score > best_score {
                        best_score = score;
                        best_color_idx = color_idx;
                        best_bbox = (c_min_x, c_min_y, c_max_x, c_max_y);
                    }
                }
            }
            if best_score > 0.0 { break; } // found in this quadrant
        }

        // If still nothing found, return full image for OCR fallback
        if best_score == 0.0 {
            return Ok(ColorDetectionResult {
                cropped_image: image_data.to_vec(),
                detected_category: String::new(),
                confidence_boost: 0,
            });
        }
    }

    // Pad bounding box
    let pad = (5.0 * scale_factor).round() as u32;
    let padded_min_x = best_bbox.0.saturating_sub(pad);
    let padded_min_y = best_bbox.1.saturating_sub(pad);
    let padded_max_x = (best_bbox.2 + pad).min(img_width - 1);
    let padded_max_y = (best_bbox.3 + pad).min(img_height - 1);

    let crop_width = padded_max_x - padded_min_x + 1;
    let crop_height = padded_max_y - padded_min_y + 1;

    // Crop RGBA sub-image
    let mut cropped_rgba = RgbaImage::new(crop_width, crop_height);
    for y in 0..crop_height {
        for x in 0..crop_width {
            let src_x = padded_min_x + x;
            let src_y = padded_min_y + y;
            cropped_rgba.put_pixel(x, y, *rgba.get_pixel(src_x, src_y));
        }
    }

    // Binarize
    let color = &ITEM_COLORS[best_color_idx];
    let binarized = binarize_region(&cropped_rgba, color);

    // Encode to PNG
    let mut png_bytes: Vec<u8> = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
    encoder
        .write_image(
            binarized.as_raw(),
            binarized.width(),
            binarized.height(),
            image::ExtendedColorType::L8,
        )
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;

    Ok(ColorDetectionResult {
        cropped_image: png_bytes,
        detected_category: color.category.to_string(),
        confidence_boost: 15,
    })
}

/// A row-segment: a contiguous horizontal group of pixels on a single row.
struct RowSegment {
    y: u32,
    x_min: u32,
    x_max: u32,
    pixel_count: u32,
}

/// Builds row-segments from sorted pixels. Pixels on the same row within
/// `connectivity_gap` horizontal distance are grouped together.
fn build_row_segments(pixels: &[(u32, u32)], connectivity_gap: u32) -> Vec<RowSegment> {
    let mut segments: Vec<RowSegment> = Vec::new();
    if pixels.is_empty() {
        return segments;
    }

    let mut seg_y = pixels[0].1;
    let mut seg_x_min = pixels[0].0;
    let mut seg_x_max = pixels[0].0;
    let mut seg_count = 1u32;

    for &(x, y) in pixels.iter().skip(1) {
        if y == seg_y && x <= seg_x_max + connectivity_gap {
            // Same row, within gap — extend segment
            seg_x_max = x;
            seg_count += 1;
        } else {
            // New segment
            segments.push(RowSegment {
                y: seg_y,
                x_min: seg_x_min,
                x_max: seg_x_max,
                pixel_count: seg_count,
            });
            seg_y = y;
            seg_x_min = x;
            seg_x_max = x;
            seg_count = 1;
        }
    }
    segments.push(RowSegment {
        y: seg_y,
        x_min: seg_x_min,
        x_max: seg_x_max,
        pixel_count: seg_count,
    });

    segments
}

/// A cluster is a collection of row-segments that are vertically adjacent
/// (within 2px gap) and horizontally overlapping.
struct Cluster {
    segments: Vec<RowSegment>,
}

/// Merges row-segments into clusters. Segments on adjacent rows (within 2px
/// vertical gap) that overlap horizontally are merged into the same cluster.
fn merge_segments_into_clusters(segments: &[RowSegment]) -> Vec<Cluster> {
    if segments.is_empty() {
        return Vec::new();
    }

    // Use union-find approach: assign each segment to a cluster index
    let n = segments.len();
    let mut parent: Vec<usize> = (0..n).collect();

    fn find(parent: &mut [usize], i: usize) -> usize {
        let mut root = i;
        while parent[root] != root {
            root = parent[root];
        }
        // Path compression
        let mut curr = i;
        while parent[curr] != root {
            let next = parent[curr];
            parent[curr] = root;
            curr = next;
        }
        root
    }

    fn union(parent: &mut [usize], a: usize, b: usize) {
        let ra = find(parent, a);
        let rb = find(parent, b);
        if ra != rb {
            parent[rb] = ra;
        }
    }

    // Segments are sorted by y (inherited from pixel sort).
    // For each segment, only look backwards at segments within 2px vertical gap.
    for i in 1..n {
        let seg_i_y = segments[i].y;
        for j in (0..i).rev() {
            let seg_j_y = segments[j].y;
            // Since segments are ordered by y, once we go more than 2 rows back, stop.
            if seg_i_y > seg_j_y + 2 {
                break;
            }
            // Check horizontal overlap
            if segments[i].x_min <= segments[j].x_max
                && segments[j].x_min <= segments[i].x_max
            {
                union(&mut parent, i, j);
            }
        }
    }

    // Group segments by their root
    let mut cluster_map: std::collections::HashMap<usize, Vec<usize>> =
        std::collections::HashMap::new();
    for i in 0..n {
        let root = find(&mut parent, i);
        cluster_map.entry(root).or_default().push(i);
    }

    // Build cluster objects
    cluster_map
        .into_values()
        .map(|indices| {
            let segs = indices
                .into_iter()
                .map(|idx| {
                    let s = &segments[idx];
                    RowSegment {
                        y: s.y,
                        x_min: s.x_min,
                        x_max: s.x_max,
                        pixel_count: s.pixel_count,
                    }
                })
                .collect();
            Cluster { segments: segs }
        })
        .collect()
}

/// Computes bounding box (min_x, min_y, max_x, max_y) for a cluster.
fn cluster_bounding_box(cluster: &Cluster) -> (u32, u32, u32, u32) {
    let mut min_x = u32::MAX;
    let mut min_y = u32::MAX;
    let mut max_x = 0u32;
    let mut max_y = 0u32;

    for seg in &cluster.segments {
        min_x = min_x.min(seg.x_min);
        max_x = max_x.max(seg.x_max);
        min_y = min_y.min(seg.y);
        max_y = max_y.max(seg.y);
    }

    (min_x, min_y, max_x, max_y)
}

/// Computes total pixel count across all segments in a cluster.
fn cluster_pixel_count(cluster: &Cluster) -> u32 {
    cluster.segments.iter().map(|s| s.pixel_count).sum()
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
    // detect_item_text_region SHALL identify a text-like cluster of those pixels and
    // return the correct category label.
    proptest! {
        #[test]
        fn prop_color_detection_identifies_known_colors(
            color_idx in 0..7usize,
            // Random offsets within tolerance for the color pixel
            r_offset in 0u8..30u8,
            g_offset in 0u8..30u8,
            b_offset in 0u8..30u8,
            // Vary the text band position slightly
            band_y in 100u32..200u32,
            band_x in 50u32..150u32,
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

            // Use a 540x540 image (scale_factor=0.5) to keep tests fast
            // At this scale: min_width=16, max_width=189, min_height=5, max_height=16
            let img_width = 540u32;
            let img_height = 540u32;

            // Skip this test case if the generated pixel also matches any EARLIER color
            // (first-match-wins means an earlier color would "steal" the detection).
            for earlier_color in &ITEM_COLORS[..color_idx] {
                if pixel_matches(r, g, b, earlier_color) {
                    return Ok(()); // prop_assume equivalent — discard this case
                }
            }

            let mut rgba = RgbaImage::new(img_width, img_height);
            // Fill with dark pixels (far from any item color)
            for pixel in rgba.pixels_mut() {
                *pixel = image::Rgba([50, 50, 50, 255]);
            }

            // Place a text-like horizontal band: ~80px wide, ~10px tall, ~50% density
            let band_width = 80u32;
            let band_height = 10u32;
            let bx = band_x.min(img_width - band_width - 1);
            let by = band_y.min(img_height - band_height - 1);
            for dy in 0..band_height {
                for dx in 0..band_width {
                    // ~50% density (checkerboard-like pattern)
                    if (dx + dy) % 2 == 0 {
                        rgba.put_pixel(bx + dx, by + dy, image::Rgba([r, g, b, 255]));
                    }
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

    // Validates: Requirements 3.1, 3.2
    // Property: pixel_matches returns true iff each channel difference ≤ tolerance
    //
    // For all pixels and any ColorRange, pixel_matches SHALL return true if and only if
    // the absolute difference between each channel (r, g, b) and the corresponding
    // center value is less than or equal to the tolerance.
    proptest! {
        #[test]
        fn prop_pixel_matches_correctness(
            r in 0u8..=255u8,
            g in 0u8..=255u8,
            b in 0u8..=255u8,
            r_center in 0u8..=255u8,
            g_center in 0u8..=255u8,
            b_center in 0u8..=255u8,
            tolerance in 0u8..=50u8,
        ) {
            let color = ColorRange {
                r_center,
                g_center,
                b_center,
                tolerance,
                category: "Test",
            };

            let result = pixel_matches(r, g, b, &color);

            // Compute expected result: true iff each channel diff ≤ tolerance
            let dr = (r as i16 - r_center as i16).unsigned_abs() as u8;
            let dg = (g as i16 - g_center as i16).unsigned_abs() as u8;
            let db = (b as i16 - b_center as i16).unsigned_abs() as u8;
            let expected = dr <= tolerance && dg <= tolerance && db <= tolerance;

            prop_assert_eq!(
                result,
                expected,
                "pixel_matches({}, {}, {}) with center=({}, {}, {}) tol={}: got {}, expected {}",
                r, g, b, r_center, g_center, b_center, tolerance, result, expected
            );
        }
    }

    // **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3**
    //
    // Bug Condition Exploration Test: Spatial Clustering vs Background Detection
    //
    // This test creates a synthetic 1920x1080 image with:
    // - A tight horizontal band of ~50 gold (Unique) pixels at (x:400-500, y:200-215)
    //   simulating an item name like "Harlequin Crest"
    // - 30+ scattered gold pixels at distant positions (x:1200-1400, y:100-500)
    //   simulating inventory panel items
    //
    // Expected behavior (after fix): the returned crop isolates the text cluster
    // with width < 200px and text-like aspect ratio (width/height > 3.0).
    //
    // Bug condition (unfixed code): the legacy top-50% scan aggregates ALL gold pixels
    // into one bounding box spanning from x:400 to x:1400, producing a ~1000px crop.
    //
    // This test is EXPECTED TO FAIL on unfixed code, confirming the bug exists.
    proptest! {
        #![proptest_config(ProptestConfig::with_cases(10))]
        #[test]
        fn prop_bug_condition_spatial_clustering_isolates_text(
            // Vary the exact position of the text band slightly
            text_x_start in 400u32..420u32,
            text_y_start in 200u32..210u32,
            // Vary noise pixel positions in the inventory region
            noise_x_offset in 0u32..200u32,
            noise_y_offset in 0u32..400u32,
        ) {
            let width = 1920u32;
            let height = 1080u32;

            // Create a 1920x1080 image with a medium-gray background.
            // Using (80,80,80) which is NOT dark (won't trigger find_tooltip_bounds)
            // and NOT matching any item color (far from all ITEM_COLORS entries).
            // This forces the code through the legacy top-50% scan path where the
            // bounding-box aggregation bug manifests.
            let mut rgba = RgbaImage::new(width, height);
            for pixel in rgba.pixels_mut() {
                *pixel = image::Rgba([80, 80, 80, 255]);
            }

            // Gold/Unique color (within tolerance of ITEM_COLORS[0]: r:199 g:179 b:119 tol:30)
            let gold = image::Rgba([199u8, 179, 119, 255]);

            // Place a tight horizontal band of ~50 gold pixels simulating item name text
            // This represents "Harlequin Crest" text - a single line ~100px wide, ~15px tall
            let text_width = 100u32;
            let text_height = 15u32;
            for y in text_y_start..(text_y_start + text_height) {
                for x in text_x_start..(text_x_start + text_width) {
                    // Place pixels in a text-like pattern (not every pixel, ~50% density)
                    if (x + y) % 2 == 0 {
                        rgba.put_pixel(x, y, gold);
                    }
                }
            }

            // Place 30+ scattered gold pixels in the inventory region (distant from text)
            // These simulate inventory items with gold-colored names
            let noise_base_x = 1200u32 + (noise_x_offset % 200);
            let noise_base_y = 100u32 + (noise_y_offset % 400);
            for i in 0..35u32 {
                let nx = noise_base_x + (i * 7) % 150;
                let ny = noise_base_y + (i * 13) % 300;
                if nx < width && ny < height / 2 {
                    rgba.put_pixel(nx, ny, gold);
                }
            }

            let png_data = create_png_from_rgba(&rgba);
            let result = detect_item_text_region(&png_data).unwrap();

            // Detection should succeed (category non-empty)
            prop_assert!(
                !result.detected_category.is_empty(),
                "Detection should identify the gold text cluster"
            );

            // Decode the cropped image to check its dimensions
            let cropped_img = image::load_from_memory(&result.cropped_image)
                .expect("Cropped image should be valid");
            let crop_width = cropped_img.width();
            let crop_height = cropped_img.height();

            // The crop should isolate the text cluster, NOT span from text to noise.
            // Text cluster is ~100px wide, so with padding crop should be < 200px.
            // Bug condition: legacy code returns ~1000px+ spanning text+noise.
            prop_assert!(
                crop_width < 200,
                "Crop width should be < 200px (isolated text cluster), got {}px. \
                 Bug: legacy code aggregates text+noise into one bounding box.",
                crop_width
            );

            // Text-like aspect ratio: width/height > 3.0
            let aspect_ratio = crop_width as f64 / crop_height as f64;
            prop_assert!(
                aspect_ratio > 3.0,
                "Crop should have text-like aspect ratio > 3.0, got {:.2} \
                 (width={}, height={}). Bug: oversized crop has low aspect ratio.",
                aspect_ratio, crop_width, crop_height
            );
        }
    }
}
