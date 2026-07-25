use std::fs;
use std::path::Path;

const MODELS_DIR: &str = "models";
const DETECTION_MODEL: &str = "text-detection.rten";
const RECOGNITION_MODEL: &str = "text-recognition.rten";

// Actual file names on HuggingFace (robertknight/ocrs repository)
const DETECTION_MODEL_URL: &str =
    "https://huggingface.co/robertknight/ocrs/resolve/main/text-detection-ssfbcj81.rten";
const RECOGNITION_MODEL_URL: &str =
    "https://huggingface.co/robertknight/ocrs/resolve/main/text-rec-checkpoint-s52qdbqt.rten";

fn main() {
    // Download OCR models if they don't exist (non-blocking: prints instructions on failure)
    download_ocr_models_if_missing();

    tauri_build::build()
}

fn download_ocr_models_if_missing() {
    let models_dir = Path::new(MODELS_DIR);
    let detection_path = models_dir.join(DETECTION_MODEL);
    let recognition_path = models_dir.join(RECOGNITION_MODEL);

    if detection_path.exists() && recognition_path.exists() {
        return; // Models already present
    }

    fs::create_dir_all(models_dir).ok();

    if !detection_path.exists() {
        if let Err(e) = download_file(DETECTION_MODEL_URL, &detection_path) {
            println!(
                "cargo:warning=Failed to download OCR model '{}': {}. \
                 The embedded OCR fallback will not work without this model. \
                 Download it manually from {} and save as src-tauri/models/{}",
                DETECTION_MODEL, e, DETECTION_MODEL_URL, DETECTION_MODEL
            );
        }
    }

    if !recognition_path.exists() {
        if let Err(e) = download_file(RECOGNITION_MODEL_URL, &recognition_path) {
            println!(
                "cargo:warning=Failed to download OCR model '{}': {}. \
                 The embedded OCR fallback will not work without this model. \
                 Download it manually from {} and save as src-tauri/models/{}",
                RECOGNITION_MODEL, e, RECOGNITION_MODEL_URL, RECOGNITION_MODEL
            );
        }
    }
}

fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    // Use curl for downloading (available on both Windows and Linux)
    let output = std::process::Command::new("curl")
        .args(["-sSfL", "--max-time", "120", "-o"])
        .arg(dest.to_str().unwrap_or_default())
        .arg(url)
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("curl failed: {}", stderr));
    }

    Ok(())
}
