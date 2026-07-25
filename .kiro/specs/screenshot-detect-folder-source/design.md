# Design: Screenshot Detection — Folder Source & OCR Fix

## Overview

This design fixes the broken Screenshot Detection feature and adds folder-based screenshot monitoring. The current implementation fails with "Screenshot analysis failed — please try again" because the OCR engine (`leptess`/Tesseract) requires external system dependencies that are never bundled with the application. The fix replaces the Tesseract dependency with a layered OCR strategy that works out-of-the-box on any Windows 10+ system, and adds the ability to monitor the D2R screenshots folder as a second image source.

## Problem Statement

A funcionalidade de Screenshot Detection falha com "Screenshot analysis failed — please try again" porque:

1. A feature `ocr` (que habilita `leptess`/Tesseract) **não está no `default`** do Cargo.toml
2. Mesmo habilitando a feature, o Tesseract requer `eng.traineddata` instalado no sistema
3. O `OcrEngine::new()` sem a feature retorna `Err("OCR feature is not enabled")`, causando `ocr_init_failed`

Além disso, a única fonte de imagem é o clipboard. O D2R salva screenshots em disco ao pressionar Print Screen — ler diretamente dessa pasta é uma fonte mais confiável e conveniente.

## Solution Overview

### 1. OCR Strategy: Windows Native + Fallback Embutido

Substituir `leptess` por uma estratégia de camadas com fallback:

**Camada primária — Windows OCR API (`Windows.Media.Ocr`)**:
- Usa a API OCR nativa do Windows via `windows` crate (mesma API do Snipping Tool)
- Zero dependências externas — funciona em qualquer Windows 10+
- Alta acurácia, mantida pela Microsoft, suporta múltiplos idiomas
- Processamento rápido (~200ms para um screenshot típico)

**Camada fallback — `ocrs` (OCR puro Rust)**:
- Para o caso raro em que a API do Windows não esteja disponível
- Modelos ONNX embutidos no binário via `include_bytes!`
- Funciona em qualquer plataforma (futuro suporte Linux/macOS)

**Pré-processamento de cor (antes de qualquer OCR)**:
- As cores de texto do D2R são fixas e conhecidas
- Detectamos a região do nome do item pela cor
- Binarizamos (texto branco em fundo preto) para maximizar acurácia OCR
- Recortamos apenas a região relevante → processamento mais rápido

Cores de texto do D2R:
- **Unique (gold)**: RGB ~(199, 179, 119)
- **Set (green)**: RGB ~(0, 255, 0)
- **Rune (orange)**: RGB ~(255, 168, 0)
- **Rare (yellow)**: RGB ~(255, 255, 119)
- **Magic (blue)**: RGB ~(107, 107, 255)
- **Normal (white)**: RGB ~(255, 255, 255)

### 2. Folder Watcher — Monitorar pasta de screenshots do D2R

O D2R salva screenshots ao pressionar Print Screen em:
- **Windows**: `%USERPROFILE%\Documents\Diablo II Resurrected\Screenshots\`
- Formato: `.jpg` nomeados sequencialmente (`Screenshot001.jpg`, etc.)

Comportamento:
- Auto-detect do caminho padrão (com opção de configurar manualmente)
- Polling a cada 2s para novos arquivos
- Processa automaticamente novos screenshots
- Mantém compatibilidade total com o fluxo de clipboard existente

## Components and Interfaces

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Image Sources                      │
├──────────────────────┬──────────────────────────────┤
│  Clipboard Monitor   │   Folder Watcher             │
│  (existente)         │   (novo)                     │
│  arboard polling 1s  │   fs polling 2s              │
└──────────┬───────────┴──────────────┬───────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────┐
│           Detection Pipeline (refatorado)            │
├─────────────────────────────────────────────────────┤
│  1. Color Region Detector (novo)                    │
│     - Identifica pixels com cor de item name        │
│     - Extrai bounding box + binariza região         │
│  2. OCR Engine (substituição completa)              │
│     - Primário: Windows.Media.Ocr (nativo)          │
│     - Fallback: ocrs (modelos embutidos)            │
│  3. Tooltip Parser (existente, sem mudanças)        │
│  4. Fuzzy Matcher (existente, sem mudanças)         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Event Emission (sem mudanças)           │
│  screenshot:item-detected / detection-failed        │
└─────────────────────────────────────────────────────┘
```

### New: `screenshot/color_detector.rs`

```rust
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
    pub cropped_image: Vec<u8>,       // PNG bytes of the binarized text region
    pub detected_category: String,    // "Unique", "Set", etc.
    pub confidence_boost: u8,         // Extra confidence from color match
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
pub fn detect_item_text_region(image_data: &[u8]) -> Result<ColorDetectionResult, String>;

/// Binarizes a region: pixels matching the target color become white, rest black.
pub fn binarize_region(image: &image::RgbaImage, color: &ColorRange) -> image::GrayImage;
```

### Modified: `screenshot/ocr.rs` — Complete Rewrite

```rust
/// OCR engine with layered strategy: Windows native → ocrs fallback.
pub struct OcrEngine {
    backend: OcrBackend,
}

enum OcrBackend {
    /// Windows.Media.Ocr — native, zero dependencies
    WindowsNative(WindowsOcrEngine),
    /// ocrs — pure Rust with embedded models
    Embedded(EmbeddedOcrEngine),
}

impl OcrEngine {
    /// Creates the OCR engine, preferring Windows native API.
    /// Falls back to embedded ocrs if native is unavailable.
    /// NEVER returns Err on a supported platform (Windows 10+).
    pub fn new() -> Result<Self, OcrError> {
        // Try Windows native first
        match WindowsOcrEngine::new() {
            Ok(engine) => Ok(Self { backend: OcrBackend::WindowsNative(engine) }),
            Err(_) => {
                // Fallback to embedded
                let engine = EmbeddedOcrEngine::new()?;
                Ok(Self { backend: OcrBackend::Embedded(engine) })
            }
        }
    }

    /// Extracts text from image data (PNG bytes).
    pub fn extract_text(&mut self, image_data: &[u8]) -> Result<String, OcrError>;
}

/// Windows.Media.Ocr implementation using the `windows` crate.
struct WindowsOcrEngine { /* Windows OCR handle */ }

impl WindowsOcrEngine {
    fn new() -> Result<Self, OcrError>;
    fn extract_text(&self, image_data: &[u8]) -> Result<String, OcrError>;
}

/// Embedded OCR using ocrs + rten with bundled models.
struct EmbeddedOcrEngine { /* ocrs engine */ }

impl EmbeddedOcrEngine {
    fn new() -> Result<Self, OcrError>;
    fn extract_text(&self, image_data: &[u8]) -> Result<String, OcrError>;
}
```

### New: `screenshot/folder_watcher.rs`

```rust
use std::path::PathBuf;
use std::time::SystemTime;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}, Mutex};

pub struct FolderWatcher {
    watch_path: PathBuf,
    last_modified: Arc<Mutex<Option<SystemTime>>>,
    running: Arc<AtomicBool>,
}

impl FolderWatcher {
    /// Resolves the D2R screenshots folder path.
    /// Tries in order:
    /// 1. %USERPROFILE%\Documents\Diablo II Resurrected\Screenshots
    /// 2. %USERPROFILE%\Saved Games\Diablo II Resurrected\Screenshots
    /// Returns None if neither exists.
    pub fn resolve_default_path() -> Option<PathBuf>;

    /// Starts watching the folder for new .jpg/.png files.
    /// Polls every 2 seconds. Only processes files newer than start time.
    pub fn start(app_handle: AppHandle, path: PathBuf, settings: ScreenshotSettings) -> Self;

    /// Stops the folder watcher.
    pub fn stop(&self);

    /// Whether the watcher is currently active.
    pub fn is_running(&self) -> bool;

    /// Internal: checks for new files since last poll.
    fn poll_new_files(&self) -> Vec<PathBuf>;
}
```

### Modified: `screenshot/settings.rs`

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScreenshotSettings {
    pub monitoring_enabled: bool,            // existing, default: false
    pub auto_detection_enabled: bool,        // existing, default: true
    pub confidence_threshold: u8,            // existing, default: 80
    pub folder_monitoring_enabled: bool,     // NEW, default: false
    pub screenshot_folder_path: Option<String>, // NEW, None = auto-detect
}
```

### Modified: `screenshot/mod.rs`

```rust
pub mod color_detector;
pub mod folder_watcher;

/// Managed state for the folder watcher.
pub struct FolderWatcherState(pub Arc<Mutex<Option<FolderWatcher>>>);

/// Returns the auto-detected D2R screenshots folder path, or None if not found.
#[tauri::command]
pub fn get_default_screenshot_folder() -> Result<Option<String>, String>;

/// Triggers detection from a specific image file on disk.
#[tauri::command]
pub async fn detect_from_file(
    path: String,
    app: AppHandle,
    state: State<'_, DbState>,
) -> Result<(), String>;
```

### Modified: `screenshot/monitor.rs` — `process_image`

```rust
fn process_image(app_handle: &AppHandle, image_data: &[u8], settings: &ScreenshotSettings) {
    // 1. Color-based text region detection (NEW)
    let color_result = color_detector::detect_item_text_region(image_data);
    let (ocr_input, category_hint) = match color_result {
        Ok(result) => (result.cropped_image, Some(result.detected_category)),
        Err(_) => (image_data.to_vec(), None), // Fallback: full image
    };

    // 2. OCR (CHANGED: layered Windows native → ocrs fallback)
    let mut engine = match OcrEngine::new() {
        Ok(e) => e,
        Err(e) => {
            // Emit detection-failed event
            emit_detection_failed(app_handle, "ocr_init_failed", &e.to_string());
            return;
        }
    };

    let raw_text = match engine.extract_text(&ocr_input) {
        Ok(text) => text,
        Err(e) => {
            emit_detection_failed(app_handle, "ocr_failed", &e.to_string());
            return;
        }
    };

    // 3-6: Existing pipeline (parse → match → filter → emit)
    // Unchanged from current implementation
}
```

### Frontend Changes

#### `src/api.ts` — New API functions

```typescript
export const getDefaultScreenshotFolder = () =>
  invoke<string | null>("get_default_screenshot_folder");

export const detectFromFile = (path: string) =>
  invoke<void>("detect_from_file", { path });
```

#### `src/components/ScreenshotSettings.tsx` — UI additions

Add a "Folder Monitoring" section below existing settings:
- Toggle: "Monitor D2R Screenshots Folder" 
- Path display with Browse and Auto-detect buttons
- Status indicator showing if folder exists and file count

## Data Models

### SQLite Migration

```sql
-- Add folder monitoring columns (backwards-compatible, uses defaults)
ALTER TABLE screenshot_settings 
  ADD COLUMN folder_monitoring_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE screenshot_settings 
  ADD COLUMN screenshot_folder_path TEXT DEFAULT NULL;
```

### TypeScript Types Update

```typescript
interface ScreenshotSettings {
  monitoringEnabled: boolean;
  autoDetectionEnabled: boolean;
  confidenceThreshold: number;
  folderMonitoringEnabled: boolean;      // NEW
  screenshotFolderPath: string | null;   // NEW
}
```

## Dependency Changes

### Remove from Cargo.toml
```toml
leptess = { version = "0.14", optional = true }
```

### Remove feature flag
```toml
# DELETE:
[features]
ocr = ["leptess"]
```

### Add to Cargo.toml
```toml
# Windows native OCR
windows = { version = "0.58", features = [
    "Media_Ocr",
    "Graphics_Imaging",
    "Storage_Streams",
    "Foundation",
] }

# Fallback OCR (pure Rust, embedded models)
ocrs = "0.9"
rten = "0.13"

# Directory resolution
dirs = "5"
```

### Build Script (`build.rs`)

Download `ocrs` models at build time for the fallback engine:

```rust
fn download_ocr_models() {
    let models_dir = Path::new("models");
    std::fs::create_dir_all(models_dir).ok();
    
    let detection = models_dir.join("text-detection.rten");
    let recognition = models_dir.join("text-recognition.rten");
    
    if !detection.exists() {
        // Download from HuggingFace: robertknight/ocrs
    }
    if !recognition.exists() {
        // Download from HuggingFace: robertknight/ocrs
    }
}
```

## Error Handling

| Error | Reason Code | User Message | Recovery |
|-------|------------|--------------|----------|
| Both OCR backends fail to init | `ocr_init_failed` | "Screenshot detection unavailable — please restart" | Retry on next detection |
| Color detector finds no text | (not emitted) | N/A — falls back to full image OCR | Transparent fallback |
| OCR returns empty text | `no_text` | "Could not read text from screenshot" | User can retry |
| Parser finds no candidates | `no_candidates` | "No D2R item tooltip detected" | User can retry |
| No items matched above threshold | `no_match` | "No item detected in screenshot" | Opens ItemSearch |
| Folder path doesn't exist | (settings validation) | "Screenshots folder not found" | User selects path |
| File read error in watcher | (logged, skipped) | N/A — silent skip | Next poll continues |
| Clipboard has no image | `no_image` | "No image found in clipboard" | User copies image first |

**Key guarantee**: The `OcrEngine::new()` call WILL succeed on any Windows 10+ system because the primary backend (Windows.Media.Ocr) is always available on desktop Windows, and the fallback (ocrs) has bundled models. This eliminates the current failure mode entirely.

## Migration Strategy

Implementation order (each step is independently testable):

1. **Create `color_detector.rs`** — pure image processing, no external deps
2. **Rewrite `ocr.rs`** — Windows OCR primary + ocrs fallback, remove leptess
3. **Update Cargo.toml** — remove leptess, add windows + ocrs + rten + dirs
4. **Update `process_image`** — wire color_detector into pipeline
5. **Create `folder_watcher.rs`** — independent of OCR changes
6. **Migrate settings** — add DB columns + update Rust/TS types
7. **Wire folder watcher into mod.rs** — new commands, state management
8. **Update frontend** — settings UI for folder monitoring
9. **Register new Tauri commands** in `lib.rs`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Color detection identifies known D2R item colors

*For any* pixel with RGB values within the defined tolerance (±30 for colored items, ±15 for white) of a known D2R item color center (Unique gold, Set green, Rune orange, Rare yellow, Magic blue, Normal white), `detect_item_text_region` SHALL include that pixel in the candidate text region and return the correct category label.

**Validates: Requirements 2.2, 2.5**

### Property 2: Binarization produces valid binary output

*For any* RGBA image input and any `ColorRange`, calling `binarize_region` SHALL produce a grayscale image of the same dimensions where every pixel value is either 0 or 255 (pure binary), with no intermediate grayscale values.

**Validates: Requirements 2.4, 2.7**

### Property 3: Color detection fallback on no-match images

*For any* image containing no pixels within tolerance of any known D2R item color, `detect_item_text_region` SHALL return the full original image data unmodified (byte-for-byte identical to input).

**Validates: Requirement 2.6**

### Property 4: Folder watcher detects new files by modification time

*For any* set of files with extensions `.jpg` or `.png` in the watched directory, `poll_new_files` SHALL return exactly those files whose modification time is strictly after the watcher's last processed file time, and exclude all others.

**Validates: Requirements 3.2, 3.3**

### Property 5: Settings persistence round-trip with new fields

*For any* valid `ScreenshotSettings` including `folder_monitoring_enabled` (bool) and `screenshot_folder_path` (Option<String> where the string is non-empty when present), saving to database and loading SHALL produce an identical struct with all fields preserved.

**Validates: Requirements 4.5, 7.1, 7.4**

### Property 6: Detection pipeline never panics on arbitrary image input

*For any* non-empty byte sequence passed as `image_data` to `process_image`, the function SHALL either emit a detection event or a detection-failed event, but SHALL NOT panic or crash the application.

**Validates: Requirements 1.1, 8.4, 8.5**

## Testing Strategy

### Unit Tests (Rust)

- `color_detector.rs`: pixel matching, bounding box, binarization correctness
- `ocr.rs`: engine initialization (must work without Tesseract), text extraction on synthetic image
- `folder_watcher.rs`: path resolution, file discovery, modification time filtering
- `settings.rs`: CRUD with new fields, migration from old schema

### Unit Tests (Vitest)

- Settings component renders folder monitoring section
- API functions for new commands
- Type compatibility for extended ScreenshotSettings

### Property-Based Tests

| Property | Module | Generator Strategy |
|----------|--------|-------------------|
| 1: Color detection | `color_detector.rs` | Random RGB pixels ± tolerance |
| 3: File detection | `folder_watcher.rs` | Random file names + timestamps |
| 4: Settings round-trip | `settings.rs` | (bool, bool, u8[50-100], bool, Option<String>) |
| 5: Binarization | `color_detector.rs` | Random small RGBA images |
| 6: No panics | `monitor.rs` | Random byte sequences as image_data |

### Integration Tests

- Full pipeline with real screenshot image
- Folder watcher with temp directory
- Settings DB migration from old schema
