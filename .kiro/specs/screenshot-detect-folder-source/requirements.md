# Requirements Document

## Introduction

This document specifies requirements for fixing the broken Screenshot Detection OCR engine and adding folder-based screenshot monitoring as a second image source. The current OCR implementation fails because it depends on Tesseract (`leptess`) which requires external system dependencies never bundled with the application. The fix replaces Tesseract with a layered OCR strategy (Windows native OCR as primary, embedded `ocrs` as fallback) that works out-of-the-box on any Windows 10+ system. Additionally, folder monitoring enables the application to watch the D2R screenshots folder for new files, providing a more convenient detection path alongside the existing clipboard flow.

These requirements are specific to the OCR engine replacement and folder source addition. Requirements for the existing detection pipeline (clipboard monitor, tooltip parser, fuzzy matcher, confidence-based suggestion, confirmation dialog, item logging) are defined in the original `screenshot-item-detection` spec and are not duplicated here.

## Glossary

- **OCR_Engine**: The Rust module that accepts image data and produces extracted text, using a layered strategy of Windows native OCR with embedded fallback
- **Windows_OCR_Backend**: The primary OCR implementation using the `Windows.Media.Ocr` API via the `windows` crate, available on all Windows 10+ desktop systems
- **Embedded_OCR_Backend**: The fallback OCR implementation using the `ocrs` crate with ONNX models bundled in the application binary
- **Color_Detector**: The preprocessing module that identifies D2R item name text regions by scanning for known fixed text colors and producing a binarized crop for OCR
- **Folder_Watcher**: The Rust module that monitors the D2R screenshots folder for new image files and feeds them into the detection pipeline
- **Detection_Pipeline**: The sequence of processing steps (color detection → OCR → tooltip parse → fuzzy match → event emission) that transforms a screenshot image into a Detection_Result
- **D2R_Screenshots_Folder**: The directory where Diablo II Resurrected saves screenshots when the user presses Print Screen, typically `%USERPROFILE%\Documents\Diablo II Resurrected\Screenshots\`
- **ColorRange**: A data structure defining a target RGB color center with a tolerance radius for pixel matching
- **Binarized_Image**: A grayscale image where matching text pixels are white (255) and all other pixels are black (0), optimized for OCR input
- **Screenshot_Settings**: The user-configurable settings controlling clipboard monitoring, folder monitoring, and auto-detection behavior

## Requirements

### Requirement 1: Zero-Dependency OCR Engine

**User Story:** As a player, I want screenshot text recognition to work immediately after installation without downloading or configuring any external tools, so that the feature is reliably usable out-of-the-box.

#### Acceptance Criteria

1. THE OCR_Engine SHALL initialize successfully on any Windows 10+ system without requiring Tesseract, traineddata files, or any other external dependency to be installed
2. WHEN the OCR_Engine initializes, THE OCR_Engine SHALL attempt to create the Windows_OCR_Backend first; IF the Windows_OCR_Backend initialization fails, THEN THE OCR_Engine SHALL fall back to the Embedded_OCR_Backend
3. THE Embedded_OCR_Backend SHALL bundle its ONNX detection and recognition models within the application binary so that no runtime downloads or external model files are required
4. WHEN either OCR backend receives a valid image, THE OCR_Engine SHALL extract readable text and return it as a UTF-8 string
5. THE OCR_Engine SHALL perform all text extraction locally on the user's machine with no network requests during initialization or text extraction
6. THE OCR_Engine SHALL NOT depend on the `leptess` crate, the Tesseract library, or any Tesseract feature flags in Cargo.toml

### Requirement 2: Color-Based Text Region Detection

**User Story:** As a player, I want the detection system to locate the item name within my screenshot using D2R's known text colors, so that OCR accuracy is maximized and processing is fast.

#### Acceptance Criteria

1. WHEN the Detection_Pipeline receives an image, THE Color_Detector SHALL scan the top 50% of the image for pixels matching any known D2R item name color within a defined tolerance
2. THE Color_Detector SHALL recognize the following D2R item name colors with a tolerance of ±30 RGB units: Unique gold (199, 179, 119), Set green (0, 255, 0), Rune orange (255, 168, 0), Rare yellow (255, 255, 119), Magic blue (107, 107, 255), and Normal white (255, 255, 255) with ±15 tolerance
3. WHEN the Color_Detector finds pixels matching a known item color, THE Color_Detector SHALL cluster adjacent matching pixels into regions and select the largest horizontal region as the item name text
4. WHEN a text region is identified, THE Color_Detector SHALL expand the bounding box by 10 pixels of padding, binarize the region (matching pixels become white, all others become black), and return the cropped binarized image for OCR processing
5. WHEN the Color_Detector identifies a text region, THE Color_Detector SHALL return the detected item category (Unique, Set, Rune, Rare, Magic, or Normal) as a hint for downstream matching
6. IF the Color_Detector finds no pixels matching any known D2R item color, THEN THE Color_Detector SHALL return the full original image unmodified for OCR processing as a fallback
7. THE Color_Detector SHALL produce a Binarized_Image where every pixel value is exactly 0 or 255 with no intermediate grayscale values

### Requirement 3: Folder Monitoring

**User Story:** As a player, I want the app to automatically detect new screenshots saved by D2R to the screenshots folder, so that I can log items by simply pressing Print Screen in-game without needing to manually copy to clipboard.

#### Acceptance Criteria

1. WHILE folder monitoring is enabled in Screenshot_Settings, THE Folder_Watcher SHALL poll the configured screenshots folder every 2 seconds for new image files with `.jpg` or `.png` extensions
2. WHEN the Folder_Watcher detects a new file whose modification time is strictly after the last processed file time, THE Folder_Watcher SHALL read the file and forward the image data to the Detection_Pipeline for processing
3. WHEN the Folder_Watcher starts, THE Folder_Watcher SHALL record the current time as its baseline and only process files with modification times after that baseline, ignoring pre-existing files
4. THE Folder_Watcher SHALL attempt to auto-detect the D2R screenshots folder by checking `%USERPROFILE%\Documents\Diablo II Resurrected\Screenshots\` first, then `%USERPROFILE%\Saved Games\Diablo II Resurrected\Screenshots\` as a secondary location
5. IF the user has configured a custom folder path in Screenshot_Settings, THEN THE Folder_Watcher SHALL use that path instead of auto-detection
6. IF the configured screenshots folder does not exist on disk, THEN THE Folder_Watcher SHALL report a validation error in the settings UI and SHALL NOT start polling
7. WHILE folder monitoring is disabled in Screenshot_Settings, THE Folder_Watcher SHALL not poll any directory or process any files
8. IF the Folder_Watcher encounters an error reading a file (permission denied, file locked, corrupt data), THEN THE Folder_Watcher SHALL log the error, skip that file, and continue polling for new files on the next interval

### Requirement 4: Folder Monitoring Settings

**User Story:** As a player, I want to configure folder monitoring behavior including enabling/disabling it and specifying a custom folder path, so that the feature adapts to my system setup.

#### Acceptance Criteria

1. THE Screenshot_Settings SHALL provide a toggle to enable or disable folder monitoring (default: disabled)
2. THE Screenshot_Settings SHALL display the resolved screenshots folder path with an "Auto-detect" button to re-resolve the default D2R path and a "Browse" button to select a custom folder
3. WHEN the user enables folder monitoring, THE Folder_Watcher SHALL begin polling within 2 seconds without requiring an application restart
4. WHEN the user disables folder monitoring, THE Folder_Watcher SHALL stop polling within 2 seconds
5. THE Screenshot_Settings SHALL persist `folder_monitoring_enabled` and `screenshot_folder_path` fields in the SQLite database so that preferences survive application restarts
6. THE Screenshot_Settings SHALL display a status indicator showing whether the configured folder exists and the number of screenshot files present
7. IF the user sets a `screenshot_folder_path` to a directory that does not exist, THEN THE Screenshot_Settings SHALL display a validation warning and prevent enabling folder monitoring for that path

### Requirement 5: Backwards Compatibility

**User Story:** As a player who uses the clipboard workflow, I want the existing clipboard detection flow to continue working identically after the OCR fix, so that my workflow is not disrupted.

#### Acceptance Criteria

1. THE Clipboard_Monitor SHALL continue to poll the system clipboard at its configured interval and forward detected images to the Detection_Pipeline, using the new OCR_Engine instead of Tesseract
2. THE Detection_Pipeline SHALL accept images from both the Clipboard_Monitor and the Folder_Watcher through the same processing path (color detection → OCR → parse → match → emit)
3. WHEN both clipboard monitoring and folder monitoring are enabled simultaneously, THE system SHALL process images from both sources independently without interference
4. THE system SHALL emit the same `screenshot:item-detected` and `screenshot:detection-failed` events with the same payload structure regardless of whether the image originated from the clipboard or the folder watcher
5. THE existing Screenshot_Settings toggles for clipboard monitoring, auto-detection, and confidence threshold SHALL continue to function identically after the changes
6. THE existing frontend components (DetectionToast, ScreenshotSettings, confirmation flow) SHALL remain fully functional with no breaking changes to their event contracts or API interfaces

### Requirement 6: Anti-Cheat Compliance for Folder Monitoring

**User Story:** As a player, I want assurance that folder monitoring will not trigger Blizzard's anti-cheat system, so that my Battle.net account remains safe.

#### Acceptance Criteria

1. THE Folder_Watcher SHALL only read files from the configured screenshots directory using standard file system APIs (e.g., `std::fs::read`, `std::fs::read_dir`) and SHALL NOT open handles to any game process
2. THE Folder_Watcher SHALL NOT use file system watch APIs that hook into kernel-level file change notifications targeting the D2R game process or its working directory
3. THE Folder_Watcher SHALL NOT inject any code, hooks, or DLLs into the D2R game process or any other process
4. THE Folder_Watcher SHALL NOT enumerate, query, or monitor running game processes for the purpose of detecting game state or triggering file processing
5. THE Folder_Watcher SHALL operate exclusively on files already written to disk by the game's own screenshot mechanism, triggered by the user pressing Print Screen
6. THE system SHALL NOT use screen capture APIs, window handle references, or process identifiers to acquire screenshots; all image data SHALL come from either the system clipboard or files on disk

### Requirement 7: Database Migration for Folder Settings

**User Story:** As a player upgrading the application, I want my existing settings preserved and new folder monitoring settings added seamlessly, so that the upgrade does not break my configuration.

#### Acceptance Criteria

1. WHEN the application starts after an upgrade, THE system SHALL run a database migration adding `folder_monitoring_enabled` (integer, default 0) and `screenshot_folder_path` (text, default NULL) columns to the `screenshot_settings` table
2. THE migration SHALL use `ALTER TABLE ... ADD COLUMN` statements that do not modify or lose existing setting values (monitoring_enabled, auto_detection_enabled, confidence_threshold)
3. IF the migration has already been applied (columns already exist), THEN THE system SHALL skip the migration without error
4. WHEN loading settings from the database, THE system SHALL treat NULL `screenshot_folder_path` as "use auto-detection" and 0 for `folder_monitoring_enabled` as disabled

### Requirement 8: OCR Performance

**User Story:** As a player, I want screenshot detection to complete quickly so that items are recognized within seconds of taking a screenshot.

#### Acceptance Criteria

1. THE Color_Detector SHALL complete text region detection and binarization within 100 milliseconds for images up to 4K resolution (3840x2160)
2. THE OCR_Engine SHALL extract text from a binarized cropped region (typically under 500x100 pixels) within 500 milliseconds using the Windows_OCR_Backend
3. THE OCR_Engine SHALL extract text from a binarized cropped region within 2 seconds using the Embedded_OCR_Backend as fallback
4. THE Detection_Pipeline SHALL process an image in a background thread without blocking the application UI thread for more than 16 milliseconds
5. IF the total Detection_Pipeline processing exceeds 5 seconds for a single image, THEN THE system SHALL abort processing, emit a `detection-failed` event with reason `timeout`, and display a transient notification

### Requirement 9: Tauri Command Registration

**User Story:** As a developer, I want the new folder monitoring functionality exposed as Tauri commands, so that the frontend can interact with the folder watcher and trigger file-based detection.

#### Acceptance Criteria

1. THE system SHALL expose a `get_default_screenshot_folder` Tauri command that returns the auto-detected D2R screenshots folder path as `Option<String>`, or `None` if no valid path is found
2. THE system SHALL expose a `detect_from_file` Tauri command that accepts a file path string and triggers the Detection_Pipeline for that specific image file
3. WHEN `detect_from_file` is called with a path that does not exist or is not a readable image file, THE command SHALL return an error result without crashing or emitting a detection event
4. THE system SHALL register the Folder_Watcher as managed Tauri state (`FolderWatcherState`) so that it persists across command invocations and can be started/stopped from settings changes
