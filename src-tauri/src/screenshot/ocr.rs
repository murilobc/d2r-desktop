use std::fmt;
use std::path::PathBuf;

/// Errors that can occur during OCR processing.
#[derive(Debug)]
pub enum OcrError {
    /// OCR engine initialization failed (backend unavailable or models missing).
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

/// OCR engine with layered strategy: Windows native → ocrs fallback.
pub struct OcrEngine {
    backend: OcrBackend,
}

enum OcrBackend {
    /// Windows.Media.Ocr — native, zero external dependencies (Windows 10+ only)
    #[cfg(target_os = "windows")]
    WindowsNative(WindowsOcrEngine),
    /// ocrs — pure Rust with ONNX models
    Embedded(EmbeddedOcrEngine),
}

impl OcrEngine {
    /// Creates the OCR engine, preferring Windows native API.
    /// Falls back to embedded ocrs if native is unavailable.
    pub fn new() -> Result<Self, OcrError> {
        // Try Windows native first (only available on Windows)
        #[cfg(target_os = "windows")]
        {
            match WindowsOcrEngine::new() {
                Ok(engine) => {
                    return Ok(Self {
                        backend: OcrBackend::WindowsNative(engine),
                    });
                }
                Err(_) => {
                    // Fall through to embedded backend
                }
            }
        }

        // Fallback to embedded OCR engine
        let engine = EmbeddedOcrEngine::new()?;
        Ok(Self {
            backend: OcrBackend::Embedded(engine),
        })
    }

    /// Extracts text from image data (PNG bytes).
    pub fn extract_text(&mut self, image_data: &[u8]) -> Result<String, OcrError> {
        match &self.backend {
            #[cfg(target_os = "windows")]
            OcrBackend::WindowsNative(engine) => engine.extract_text(image_data),
            OcrBackend::Embedded(engine) => engine.extract_text(image_data),
        }
    }
}

// =============================================================================
// Windows Native OCR Backend
// =============================================================================

/// Windows.Media.Ocr implementation using the `windows` crate.
#[cfg(target_os = "windows")]
struct WindowsOcrEngine {
    engine: windows::Media::Ocr::OcrEngine,
}

#[cfg(target_os = "windows")]
impl WindowsOcrEngine {
    /// Creates a new WindowsOcrEngine using Windows.Media.Ocr.
    /// Uses TryCreateFromUserProfileLanguages to initialize.
    fn new() -> Result<Self, OcrError> {
        let engine =
            windows::Media::Ocr::OcrEngine::TryCreateFromUserProfileLanguages().map_err(|e| {
                OcrError::InitFailed(format!("Windows OCR API unavailable: {}", e))
            })?;

        Ok(Self { engine })
    }

    /// Extracts text from PNG image bytes using Windows.Media.Ocr.
    ///
    /// Steps:
    /// 1. Write PNG bytes into an InMemoryRandomAccessStream
    /// 2. Create a BitmapDecoder from the stream
    /// 3. Get SoftwareBitmap from the decoder
    /// 4. Run OCR recognition on the bitmap
    /// 5. Collect text from all recognized lines
    fn extract_text(&self, image_data: &[u8]) -> Result<String, OcrError> {
        use windows::Graphics::Imaging::BitmapDecoder;
        use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

        // Create an InMemoryRandomAccessStream and write image bytes
        let stream = InMemoryRandomAccessStream::new()
            .map_err(|e| OcrError::Internal(format!("Failed to create memory stream: {}", e)))?;

        let writer = DataWriter::CreateDataWriter(&stream)
            .map_err(|e| OcrError::Internal(format!("Failed to create data writer: {}", e)))?;

        writer
            .WriteBytes(image_data)
            .map_err(|e| OcrError::Internal(format!("Failed to write image data: {}", e)))?;

        writer
            .StoreAsync()
            .map_err(|e| OcrError::Internal(format!("Failed to store data: {}", e)))?
            .get()
            .map_err(|e| OcrError::Internal(format!("Failed to await store: {}", e)))?;

        writer
            .FlushAsync()
            .map_err(|e| OcrError::Internal(format!("Failed to flush stream: {}", e)))?
            .get()
            .map_err(|e| OcrError::Internal(format!("Failed to await flush: {}", e)))?;

        // Detach the stream from the writer so it can be read
        writer
            .DetachStream()
            .map_err(|e| OcrError::Internal(format!("Failed to detach stream: {}", e)))?;

        // Reset stream position to the beginning
        stream
            .Seek(0)
            .map_err(|e| OcrError::Internal(format!("Failed to seek stream: {}", e)))?;

        // Create BitmapDecoder from the stream (auto-detects format)
        let decoder = BitmapDecoder::CreateAsync(&stream)
            .map_err(|e| {
                OcrError::UnsupportedFormat(format!("Failed to create bitmap decoder: {}", e))
            })?
            .get()
            .map_err(|e| OcrError::UnsupportedFormat(format!("Failed to decode image: {}", e)))?;

        // Get SoftwareBitmap
        let bitmap = decoder
            .GetSoftwareBitmapAsync()
            .map_err(|e| OcrError::Internal(format!("Failed to start bitmap extraction: {}", e)))?
            .get()
            .map_err(|e| OcrError::Internal(format!("Failed to get software bitmap: {}", e)))?;

        // Run OCR recognition
        let result = self
            .engine
            .RecognizeAsync(&bitmap)
            .map_err(|e| OcrError::Internal(format!("Failed to start OCR: {}", e)))?
            .get()
            .map_err(|e| OcrError::Internal(format!("OCR recognition failed: {}", e)))?;

        // Collect text from all lines
        let lines = result
            .Lines()
            .map_err(|e| OcrError::Internal(format!("Failed to get OCR lines: {}", e)))?;

        let mut text_parts: Vec<String> = Vec::new();
        for line in &lines {
            if let Ok(line_text) = line.Text() {
                let s = line_text.to_string();
                if !s.is_empty() {
                    text_parts.push(s);
                }
            }
        }

        Ok(text_parts.join("\n"))
    }
}

// =============================================================================
// Embedded OCR Backend (ocrs + rten)
// =============================================================================

/// Embedded OCR using ocrs + rten with ONNX models.
struct EmbeddedOcrEngine {
    engine: ocrs::OcrEngine,
}

impl EmbeddedOcrEngine {
    /// Creates a new EmbeddedOcrEngine by loading ONNX models.
    ///
    /// Tries to load models from a `models/` directory relative to the executable.
    /// If models are not found, returns an init error.
    fn new() -> Result<Self, OcrError> {
        let models_dir = Self::resolve_models_dir()?;

        let detection_path = models_dir.join("text-detection.rten");
        let recognition_path = models_dir.join("text-recognition.rten");

        if !detection_path.exists() {
            return Err(OcrError::InitFailed(format!(
                "Text detection model not found at: {}",
                detection_path.display()
            )));
        }
        if !recognition_path.exists() {
            return Err(OcrError::InitFailed(format!(
                "Text recognition model not found at: {}",
                recognition_path.display()
            )));
        }

        let detection_model = rten::Model::load_file(&detection_path).map_err(|e| {
            OcrError::InitFailed(format!("Failed to load detection model: {}", e))
        })?;

        let recognition_model = rten::Model::load_file(&recognition_path).map_err(|e| {
            OcrError::InitFailed(format!("Failed to load recognition model: {}", e))
        })?;

        let engine = ocrs::OcrEngine::new(ocrs::OcrEngineParams {
            detection_model: Some(detection_model),
            recognition_model: Some(recognition_model),
            ..Default::default()
        })
        .map_err(|e| OcrError::InitFailed(format!("Failed to create ocrs engine: {}", e)))?;

        Ok(Self { engine })
    }

    /// Extracts text from PNG image bytes using the embedded ocrs engine.
    fn extract_text(&self, image_data: &[u8]) -> Result<String, OcrError> {
        let img = image::load_from_memory(image_data)
            .map_err(|e| OcrError::UnsupportedFormat(format!("Failed to decode image: {}", e)))?;

        let rgb_image = img.into_rgb8();
        let (width, height) = rgb_image.dimensions();

        let image_source =
            ocrs::ImageSource::from_bytes(rgb_image.as_raw(), (width, height)).map_err(|e| {
                OcrError::Internal(format!("Failed to create OCR image source: {:?}", e))
            })?;

        let ocr_input = self.engine.prepare_input(image_source).map_err(|e| {
            OcrError::Internal(format!("Failed to prepare OCR input: {}", e))
        })?;

        let text = self.engine.get_text(&ocr_input).map_err(|e| {
            OcrError::Internal(format!("ocrs text extraction failed: {}", e))
        })?;

        Ok(text)
    }

    /// Resolves the models directory path.
    /// Checks in order:
    /// 1. `{exe_dir}/models/` — for production deployment
    /// 2. `{app_data_dir}/d2r-desktop/models/` — for user-installed models
    /// 3. `./models/` relative to CWD — for development
    fn resolve_models_dir() -> Result<PathBuf, OcrError> {
        // 1. Next to the executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let models_dir = exe_dir.join("models");
                if models_dir.is_dir() {
                    return Ok(models_dir);
                }
            }
        }

        // 2. App data directory
        if let Some(data_dir) = dirs::data_dir() {
            let models_dir = data_dir.join("d2r-desktop").join("models");
            if models_dir.is_dir() {
                return Ok(models_dir);
            }
        }

        // 3. Current working directory (development)
        let cwd_models = PathBuf::from("models");
        if cwd_models.is_dir() {
            return Ok(cwd_models);
        }

        Err(OcrError::InitFailed(
            "Models directory not found. \
             Place text-detection.rten and text-recognition.rten in a 'models/' directory \
             next to the executable, or download them from \
             https://huggingface.co/robertknight/ocrs"
                .to_string(),
        ))
    }
}

// =============================================================================
// Preprocessing utility
// =============================================================================

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

    // --- Test 1: OcrEngine::new() succeeds without Tesseract ---

    #[test]
    fn test_ocr_engine_new_does_not_panic() {
        // OcrEngine::new() must never panic regardless of platform.
        // On Windows 10+ it succeeds with the native backend.
        // On Linux CI both backends are unavailable (no Windows API, no model files),
        // so it returns Err — but it must NOT panic and NOT mention Tesseract.
        let result = OcrEngine::new();
        match &result {
            Ok(_) => {
                // Engine initialized successfully — valid on Windows 10+
            }
            Err(err) => {
                // Verify the error does NOT reference Tesseract/leptess
                let msg = err.to_string().to_lowercase();
                assert!(
                    !msg.contains("tesseract"),
                    "OcrEngine::new() error should not mention Tesseract, got: {}",
                    err
                );
                assert!(
                    !msg.contains("traineddata"),
                    "OcrEngine::new() error should not mention traineddata, got: {}",
                    err
                );
                assert!(
                    !msg.contains("leptess"),
                    "OcrEngine::new() error should not mention leptess, got: {}",
                    err
                );
            }
        }
    }

    #[test]
    fn test_ocr_engine_new_returns_init_failed_when_unavailable() {
        // When OcrEngine::new() fails, the error variant should be InitFailed
        let result = OcrEngine::new();
        if let Err(err) = result {
            match err {
                OcrError::InitFailed(_) => {
                    // Expected — no backends available on this platform
                }
                other => panic!(
                    "Expected OcrError::InitFailed when backends unavailable, got: {:?}",
                    other
                ),
            }
        }
        // Ok is valid too — means a backend is available
    }

    // --- Test 2: extract_text handles invalid image data gracefully ---

    #[test]
    fn test_extract_text_invalid_image_data_no_panic() {
        // If the engine can be created, passing garbage bytes must return Err, not panic
        match OcrEngine::new() {
            Ok(mut engine) => {
                let garbage = b"this is definitely not valid image data at all!!!";
                let result = engine.extract_text(garbage);
                assert!(
                    result.is_err(),
                    "extract_text with garbage data should return Err"
                );
                // Verify error is UnsupportedFormat or Internal — not a panic
                match result.unwrap_err() {
                    OcrError::UnsupportedFormat(_) | OcrError::Internal(_) => {
                        // Expected error variants for invalid image data
                    }
                    other => panic!(
                        "Expected UnsupportedFormat or Internal for garbage data, got: {:?}",
                        other
                    ),
                }
            }
            Err(_) => {
                // Engine couldn't initialize (Linux CI) — the no-panic guarantee
                // for new() is verified in the test above
            }
        }
    }

    #[test]
    fn test_extract_text_empty_data_no_panic() {
        // Empty byte slice must return Err, not panic
        match OcrEngine::new() {
            Ok(mut engine) => {
                let result = engine.extract_text(&[]);
                assert!(
                    result.is_err(),
                    "extract_text with empty data should return Err"
                );
            }
            Err(_) => {
                // Engine couldn't initialize — tested above
            }
        }
    }

    // --- Test 3: OcrError display formatting ---

    #[test]
    fn test_ocr_error_display_init_failed() {
        let err = OcrError::InitFailed("backend unavailable".to_string());
        let display = err.to_string();
        assert!(
            display.contains("OCR initialization failed"),
            "Expected 'OCR initialization failed' in: {}",
            display
        );
        assert!(
            display.contains("backend unavailable"),
            "Expected inner message preserved in: {}",
            display
        );
    }

    #[test]
    fn test_ocr_error_display_unsupported_format() {
        let err = OcrError::UnsupportedFormat("not a valid image".to_string());
        let display = err.to_string();
        assert!(
            display.contains("Unsupported image format"),
            "Expected 'Unsupported image format' in: {}",
            display
        );
        assert!(
            display.contains("not a valid image"),
            "Expected inner message preserved in: {}",
            display
        );
    }

    #[test]
    fn test_ocr_error_display_timeout() {
        let err = OcrError::Timeout;
        let display = err.to_string();
        assert!(
            display.contains("timed out"),
            "Expected 'timed out' in: {}",
            display
        );
        assert!(
            display.contains("5 seconds"),
            "Expected '5 seconds' in: {}",
            display
        );
    }

    #[test]
    fn test_ocr_error_display_internal() {
        let err = OcrError::Internal("allocation failed".to_string());
        let display = err.to_string();
        assert!(
            display.contains("Internal OCR error"),
            "Expected 'Internal OCR error' in: {}",
            display
        );
        assert!(
            display.contains("allocation failed"),
            "Expected inner message preserved in: {}",
            display
        );
    }

    #[test]
    fn test_ocr_error_implements_std_error() {
        // Verify OcrError implements std::error::Error trait
        let err: Box<dyn std::error::Error> =
            Box::new(OcrError::Internal("test".to_string()));
        assert!(!err.to_string().is_empty());
    }

    // --- Preprocess tests (existing functionality, kept) ---

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

        let output = result.unwrap();
        let decoded = image::load_from_memory(&output).unwrap();
        assert_eq!(decoded.width(), 2);
        assert_eq!(decoded.height(), 2);
    }

    #[test]
    fn test_preprocess_contrast_enhancement() {
        // Formula: (pixel - 128) * 1.5 + 128, clamped to [0, 255]
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

        assert_eq!(decoded.get_pixel(0, 0).0[0], 128); // midpoint unchanged
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
}
