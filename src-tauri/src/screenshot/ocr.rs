use std::fmt;

#[cfg(feature = "ocr")]
use std::time::Instant;

/// Errors that can occur during OCR processing.
#[derive(Debug)]
pub enum OcrError {
    /// Tesseract initialization failed (e.g., missing language data).
    InitFailed(String),
    /// The provided image data is in an unsupported or corrupt format.
    UnsupportedFormat(String),
    /// OCR processing exceeded the 5-second timeout.
    Timeout,
    /// An internal error occurred during processing.
    Internal(String),
}

impl fmt::Display for OcrError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OcrError::InitFailed(msg) => write!(f, "OCR initialization failed: {}", msg),
            OcrError::UnsupportedFormat(msg) => write!(f, "Unsupported image format: {}", msg),
            OcrError::Timeout => write!(f, "OCR processing timed out (exceeded 5 seconds)"),
            OcrError::Internal(msg) => write!(f, "Internal OCR error: {}", msg),
        }
    }
}

impl std::error::Error for OcrError {}

/// The OCR engine wrapping Tesseract for text extraction from images.
#[cfg(feature = "ocr")]
pub struct OcrEngine {
    tess: leptess::LepTess,
}

#[cfg(feature = "ocr")]
impl OcrEngine {
    /// Creates a new OcrEngine by initializing Tesseract with English language data.
    ///
    /// Uses the system default datapath for Tesseract language files.
    pub fn new() -> Result<Self, OcrError> {
        let tess = leptess::LepTess::new(None, "eng")
            .map_err(|e| OcrError::InitFailed(e.to_string()))?;
        Ok(Self { tess })
    }

    /// Extracts text from image data using Tesseract OCR.
    ///
    /// The image is preprocessed (grayscale + contrast enhancement) before OCR.
    /// Returns the extracted text trimmed, or an empty string if no text was found.
    /// Aborts and returns `OcrError::Timeout` if processing exceeds 5 seconds.
    pub fn extract_text(&mut self, image_data: &[u8]) -> Result<String, OcrError> {
        let start = Instant::now();
        let timeout = std::time::Duration::from_secs(5);

        // Preprocess the image
        let preprocessed = preprocess(image_data)?;

        // Check timeout after preprocessing
        if start.elapsed() > timeout {
            return Err(OcrError::Timeout);
        }

        // Set the preprocessed image on the Tesseract instance
        self.tess
            .set_image_from_mem(&preprocessed)
            .map_err(|e| OcrError::Internal(format!("Failed to set image: {}", e)))?;

        // Check timeout before running OCR
        if start.elapsed() > timeout {
            return Err(OcrError::Timeout);
        }

        // Run OCR and get text
        let text = self
            .tess
            .get_utf8_text()
            .map_err(|e| OcrError::Internal(format!("Failed to extract text: {}", e)))?;

        // Check timeout after OCR
        if start.elapsed() > timeout {
            return Err(OcrError::Timeout);
        }

        let trimmed = text.trim().to_string();
        Ok(trimmed)
    }
}

/// Stub OcrEngine when the `ocr` feature is not enabled.
#[cfg(not(feature = "ocr"))]
#[derive(Debug)]
pub struct OcrEngine;

#[cfg(not(feature = "ocr"))]
impl OcrEngine {
    /// Returns an error indicating OCR is not available without the `ocr` feature.
    pub fn new() -> Result<Self, OcrError> {
        Err(OcrError::InitFailed(
            "OCR feature is not enabled. Rebuild with --features ocr".to_string(),
        ))
    }

    /// Returns an error indicating OCR is not available without the `ocr` feature.
    pub fn extract_text(&mut self, _image_data: &[u8]) -> Result<String, OcrError> {
        Err(OcrError::InitFailed(
            "OCR feature is not enabled. Rebuild with --features ocr".to_string(),
        ))
    }
}

/// Preprocesses image data for OCR: converts to grayscale and applies contrast enhancement.
///
/// The contrast enhancement scales pixel values: `(pixel - 128) * 1.5 + 128`, clamped to 0-255.
/// Returns the processed image encoded as PNG bytes.
pub fn preprocess(image_data: &[u8]) -> Result<Vec<u8>, OcrError> {
    // Load image from bytes
    let img = image::load_from_memory(image_data)
        .map_err(|e| OcrError::UnsupportedFormat(format!("Failed to decode image: {}", e)))?;

    // Convert to grayscale
    let gray = img.to_luma8();

    // Apply contrast enhancement: (pixel - 128) * 1.5 + 128, clamped to [0, 255]
    let enhanced = image::GrayImage::from_fn(gray.width(), gray.height(), |x, y| {
        let pixel = gray.get_pixel(x, y).0[0] as f32;
        let enhanced_value = (pixel - 128.0) * 1.5 + 128.0;
        let clamped = enhanced_value.clamp(0.0, 255.0) as u8;
        image::Luma([clamped])
    });

    // Encode back to PNG bytes
    let mut output = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut output));
    image::ImageEncoder::write_image(
        encoder,
        enhanced.as_raw(),
        enhanced.width(),
        enhanced.height(),
        image::ExtendedColorType::L8,
    )
    .map_err(|e| OcrError::Internal(format!("Failed to encode preprocessed image: {}", e)))?;

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_error_display() {
        let init_err = OcrError::InitFailed("missing eng.traineddata".to_string());
        assert!(init_err.to_string().contains("initialization failed"));
        assert!(init_err.to_string().contains("missing eng.traineddata"));

        let format_err = OcrError::UnsupportedFormat("not a valid image".to_string());
        assert!(format_err.to_string().contains("Unsupported image format"));

        let timeout_err = OcrError::Timeout;
        assert!(timeout_err.to_string().contains("timed out"));
        assert!(timeout_err.to_string().contains("5 seconds"));

        let internal_err = OcrError::Internal("allocation failed".to_string());
        assert!(internal_err.to_string().contains("Internal OCR error"));
    }

    #[test]
    fn test_preprocess_invalid_image_data() {
        let result = preprocess(b"not an image");
        assert!(result.is_err());
        match result.unwrap_err() {
            OcrError::UnsupportedFormat(msg) => {
                assert!(msg.contains("Failed to decode image"));
            }
            other => panic!("Expected UnsupportedFormat, got: {:?}", other),
        }
    }

    #[test]
    fn test_preprocess_valid_png() {
        // Create a small 2x2 white PNG image
        let mut img = image::GrayImage::new(2, 2);
        for pixel in img.pixels_mut() {
            *pixel = image::Luma([200u8]);
        }

        let mut png_bytes = Vec::new();
        let encoder =
            image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
        image::ImageEncoder::write_image(
            encoder,
            img.as_raw(),
            img.width(),
            img.height(),
            image::ExtendedColorType::L8,
        )
        .unwrap();

        let result = preprocess(&png_bytes);
        assert!(result.is_ok());

        // Verify the output is valid PNG and can be decoded
        let output = result.unwrap();
        let decoded = image::load_from_memory(&output).unwrap();
        assert_eq!(decoded.width(), 2);
        assert_eq!(decoded.height(), 2);
    }

    #[test]
    fn test_preprocess_contrast_enhancement() {
        // Create a 1x3 image with known pixel values to verify contrast formula
        // Formula: (pixel - 128) * 1.5 + 128, clamped to [0, 255]
        // pixel=128 -> (128-128)*1.5+128 = 128
        // pixel=0   -> (0-128)*1.5+128 = -192+128 = -64 -> clamped to 0
        // pixel=255 -> (255-128)*1.5+128 = 190.5+128 = 318.5 -> clamped to 255
        let mut img = image::GrayImage::new(3, 1);
        img.put_pixel(0, 0, image::Luma([128u8]));
        img.put_pixel(1, 0, image::Luma([0u8]));
        img.put_pixel(2, 0, image::Luma([255u8]));

        let mut png_bytes = Vec::new();
        let encoder =
            image::codecs::png::PngEncoder::new(std::io::Cursor::new(&mut png_bytes));
        image::ImageEncoder::write_image(
            encoder,
            img.as_raw(),
            img.width(),
            img.height(),
            image::ExtendedColorType::L8,
        )
        .unwrap();

        let result = preprocess(&png_bytes).unwrap();
        let decoded = image::load_from_memory(&result).unwrap().to_luma8();

        assert_eq!(decoded.get_pixel(0, 0).0[0], 128); // midpoint stays the same
        assert_eq!(decoded.get_pixel(1, 0).0[0], 0); // dark clamped to 0
        assert_eq!(decoded.get_pixel(2, 0).0[0], 255); // bright clamped to 255
    }

    #[test]
    fn test_preprocess_empty_data() {
        let result = preprocess(&[]);
        assert!(result.is_err());
        match result.unwrap_err() {
            OcrError::UnsupportedFormat(_) => {}
            other => panic!("Expected UnsupportedFormat, got: {:?}", other),
        }
    }

    #[cfg(not(feature = "ocr"))]
    #[test]
    fn test_ocr_engine_without_feature() {
        let result = OcrEngine::new();
        assert!(result.is_err());
        match result.unwrap_err() {
            OcrError::InitFailed(msg) => {
                assert!(msg.contains("not enabled"));
            }
            other => panic!("Expected InitFailed, got: {:?}", other),
        }
    }
}
