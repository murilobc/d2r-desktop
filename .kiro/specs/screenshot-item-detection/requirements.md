# Requirements Document

## Introduction

The Screenshot Item Detection feature adds OCR-based item recognition to the D2R Desktop application. When a user takes a screenshot of an item tooltip in Diablo 2 Resurrected and copies it to the clipboard, the application detects the clipboard image, runs local OCR processing to extract the item name, matches it against the existing item database, and presents the result for confirmation before logging. All image processing happens locally on the user's machine with no network calls. The feature targets Unique items (gold text), Set items (green text), and Runes (orange text) as the initial scope due to their distinctive tooltip formatting and high relevance to farming tracking.

## Glossary

- **Clipboard_Monitor**: The Rust backend module that watches the system clipboard for new image content and emits events when a screenshot is detected
- **OCR_Engine**: The Rust module that accepts image data and produces extracted text using the Tesseract OCR library
- **Item_Matcher**: The module that compares OCR-extracted text against the existing item database (ALL_ITEMS from src/data/items.ts) and produces match candidates with confidence scores
- **Confidence_Score**: A numeric value from 0 to 100 representing how closely OCR-extracted text matches an item name in the database
- **Detection_Result**: A data structure containing the matched item name, category, confidence score, and the original extracted text
- **Confirmation_Dialog**: The frontend UI element that presents a detected item to the user for review before logging
- **Item_Database**: The existing collection of all D2R game items stored in src/data/items.ts (exported as ALL_ITEMS)
- **Tooltip_Region**: The area within a screenshot image that contains the item name text, typically at the top of the D2R item tooltip
- **Screenshot_Settings**: The user-configurable settings controlling clipboard monitoring and auto-detection behavior
- **Profile**: An existing application entity representing a single D2R character with its own farming data

## Requirements

### Requirement 1: Clipboard Image Detection

**User Story:** As a player, I want the app to detect when I copy a screenshot to my clipboard so that I can quickly log items without typing.

#### Acceptance Criteria

1. WHILE clipboard monitoring is enabled in Screenshot_Settings, THE Clipboard_Monitor SHALL poll the system clipboard at an interval of 1 second for new image content
2. WHEN the Clipboard_Monitor detects image content on the clipboard whose hash differs from the last processed image hash, THE Clipboard_Monitor SHALL extract the image data and forward it to the OCR_Engine for processing
3. THE Clipboard_Monitor SHALL ignore non-image clipboard content such as text, files, or empty clipboard states
4. THE Clipboard_Monitor SHALL compute a hash of each detected clipboard image and compare it against the last processed image hash to avoid processing the same screenshot multiple times
5. WHILE clipboard monitoring is disabled in Screenshot_Settings, THE Clipboard_Monitor SHALL not poll the clipboard or process images
6. IF the Clipboard_Monitor encounters an error reading the clipboard, THEN THE Clipboard_Monitor SHALL log the error and continue polling on the next polling interval without crashing
7. IF the Clipboard_Monitor fails to forward image data to the OCR_Engine, THEN THE Clipboard_Monitor SHALL discard the image, log the error, and retry processing on the next clipboard poll that detects the same or new image
8. THE Clipboard_Monitor SHALL accept clipboard image data in any raster image format supported by the operating system clipboard (such as PNG or BMP)

### Requirement 2: OCR Text Extraction

**User Story:** As a player, I want the app to read the item name from my screenshot so that I do not have to type it manually.

#### Acceptance Criteria

1. WHEN the OCR_Engine receives image data in a supported raster format (PNG, BMP, TIFF, or JPEG), THE OCR_Engine SHALL extract all readable text from the image using the Tesseract OCR library
2. WHEN the OCR_Engine receives image data, THE OCR_Engine SHALL preprocess the image before OCR by converting to grayscale and applying contrast enhancement to improve text recognition on D2R tooltip backgrounds
3. THE OCR_Engine SHALL process images entirely on the local machine with no network requests
4. THE OCR_Engine SHALL return the extracted text to the Item_Matcher within 3 seconds for images up to 4K resolution (3840x2160)
5. IF the OCR_Engine fails to extract any text from an image, THEN THE OCR_Engine SHALL return an empty result and emit no detection event
6. IF the OCR_Engine receives image data in an unsupported format or a corrupt/unreadable image, THEN THE OCR_Engine SHALL return an error result and emit no detection event

### Requirement 3: Item Name Matching

**User Story:** As a player, I want the extracted text matched against the item database so that the app suggests the correct item.

#### Acceptance Criteria

1. WHEN the Item_Matcher receives extracted text, THE Item_Matcher SHALL compare it against all entries in the Item_Database using fuzzy string matching (Levenshtein distance or equivalent algorithm)
2. THE Item_Matcher SHALL produce a ranked list of candidate matches ordered by Confidence_Score (integer, 0–100) from highest to lowest
3. THE Item_Matcher SHALL assign a Confidence_Score between 0 and 100 for each candidate based on the normalized edit distance between extracted text and the item name
4. THE Item_Matcher SHALL return a maximum of 5 candidate matches per detection
5. WHEN multiple candidates have Confidence_Scores within 5 points of each other, THE Item_Matcher SHALL rank Unique items, Set items, and Runes above other item categories as a tiebreaker
6. THE Item_Matcher SHALL normalize both the extracted text and database item names before comparison by replacing commonly confused OCR characters (O↔0, l↔1, I↔l) with a canonical form
7. IF the Item_Matcher receives empty or whitespace-only extracted text, THEN THE Item_Matcher SHALL return an empty candidate list without performing matching

### Requirement 4: Confidence-Based Auto-Suggestion

**User Story:** As a player, I want the app to auto-suggest an item when it is confident about the match, and show me options when it is not, so that logging is fast but accurate.

#### Acceptance Criteria

1. WHEN the top candidate has a Confidence_Score above the configured threshold (default 80), THE Detection_Result SHALL mark the item as "auto-suggested" with a visible label indicating automatic detection and present it in the Confirmation_Dialog pre-selected as the default choice
2. WHEN the top candidate has a Confidence_Score at or below the configured threshold but at least one candidate has a Confidence_Score above 30, THE Detection_Result SHALL present all returned candidates (up to 5) in a dropdown within the Confirmation_Dialog ordered by Confidence_Score descending for manual selection
3. THE Screenshot_Settings SHALL allow the user to configure the confidence threshold as an integer between 50 and 100 with a default value of 80
4. WHEN no candidate achieves a Confidence_Score above 30, THE Detection_Result SHALL open the existing ItemSearch component pre-filled with the raw extracted text instead of the Confirmation_Dialog
5. IF the Item_Matcher returns zero candidates for a detection, THEN THE Detection_Result SHALL open the existing ItemSearch component pre-filled with the raw extracted text instead of the Confirmation_Dialog

### Requirement 5: User Confirmation Before Logging

**User Story:** As a player, I want to confirm or correct the detected item before it is logged so that my item history remains accurate.

#### Acceptance Criteria

1. WHEN a Detection_Result is produced, THE Confirmation_Dialog SHALL display the suggested item name, category, and confidence score as an integer from 0 to 100
2. WHEN the user activates the "Confirm" action, THE Confirmation_Dialog SHALL log the displayed item using the existing item logging system and close the dialog
3. WHEN the user activates the "Change" action, THE Confirmation_Dialog SHALL close and open the full ItemSearch dropdown pre-filled with the detected text for manual correction
4. WHEN the user activates the "Dismiss" action, THE Confirmation_Dialog SHALL close and discard the detection without logging any item
5. IF the user does not click or press a key within the Confirmation_Dialog within 30 seconds of it appearing, THEN THE Confirmation_Dialog SHALL auto-dismiss without logging
6. THE Confirmation_Dialog SHALL be non-modal, rendering without an overlay so that the user can interact with other application elements while it is displayed
7. IF a new Detection_Result is produced while a Confirmation_Dialog is already visible, THEN THE Confirmation_Dialog SHALL replace its content with the new Detection_Result and reset the 30-second auto-dismiss timer

### Requirement 6: Manual Correction Fallback

**User Story:** As a player, I want to always be able to correct or override the detection result so that OCR errors never result in wrong item logs.

#### Acceptance Criteria

1. WHEN the user selects "Change" in the Confirmation_Dialog, THE system SHALL replace the Confirmation_Dialog content with the existing ItemSearch component, with the search field pre-filled with the extracted text and the item list filtered accordingly
2. WHEN the user selects an item from the ItemSearch component during the correction flow, THE system SHALL log that manually-selected item instead of the auto-detected one, associating it with the same active profile and session context as an auto-confirmed detection
3. IF the user dismisses the ItemSearch component during the correction flow without selecting an item, THEN THE system SHALL return to the Confirmation_Dialog in its previous state without logging any item
4. THE existing manual item logging flow via ItemSearch SHALL remain fully functional and unaffected by the screenshot detection feature
5. IF auto-detection is disabled in Screenshot_Settings, THEN THE system SHALL display a "Detect from Screenshot" button that allows the user to paste a screenshot and trigger the same OCR, matching, and confirmation pipeline used by automatic detection
6. WHEN an item is logged through the correction flow, THE system SHALL close the Confirmation_Dialog and display the same confirmation feedback shown for auto-confirmed items

### Requirement 7: Screenshot Detection Settings

**User Story:** As a player, I want to control how the screenshot detection feature behaves so that it fits my workflow without being intrusive.

#### Acceptance Criteria

1. THE Screenshot_Settings SHALL provide a toggle to enable or disable clipboard monitoring (default: disabled)
2. THE Screenshot_Settings SHALL provide a toggle to enable or disable the auto-detection feature independently of clipboard monitoring (default: enabled when monitoring is active); the auto-detection toggle SHALL be configurable regardless of the clipboard monitoring state
3. THE Screenshot_Settings SHALL provide a numeric input to configure the confidence threshold as an integer value (default: 80, range: 50–100, step: 1)
4. IF the user enters a confidence threshold value outside the range 50–100, THEN THE Screenshot_Settings SHALL reject the input and retain the previous valid value
5. THE Screenshot_Settings SHALL persist all settings in the SQLite database so that preferences survive application restarts
6. THE Screenshot_Settings SHALL be accessible from the existing application Settings page under a "Screenshot Detection" section
7. WHEN the user changes clipboard monitoring from disabled to enabled, THE Clipboard_Monitor SHALL begin polling the clipboard at an interval no longer than 2 seconds, within 1 second of the toggle change, without requiring an application restart
8. WHEN the user changes clipboard monitoring from enabled to disabled, THE Clipboard_Monitor SHALL stop polling the clipboard within 1 second of the toggle change
9. IF the Screenshot_Settings fails to persist a setting to the SQLite database, THEN THE Screenshot_Settings SHALL display an error message indicating the save failed and retain the previous persisted values

### Requirement 8: Anti-Cheat Compliance

**User Story:** As a player, I want assurance that the screenshot detection feature will not get my Battle.net account banned by Blizzard's anti-cheat system.

#### Acceptance Criteria

1. THE Clipboard_Monitor SHALL read only from the system clipboard using standard OS clipboard APIs (e.g., Win32 `GetClipboardData`, `OpenClipboard`) and SHALL NOT open handles to any game process including D2R.exe
2. THE OCR_Engine SHALL process only image data provided via the clipboard and SHALL NOT read from the D2R game process memory or game installation files at runtime
3. THE system SHALL NOT inject synthetic input events (keyboard, mouse, or controller) into the D2R game window or any other application window
4. THE system SHALL NOT hook into D2R DLLs, rendering pipelines, or game networking via techniques such as DLL injection, function detouring, or import table patching
5. THE system SHALL NOT use screen capture APIs that reference a specific window handle or process identifier; only the system clipboard content placed there by user-initiated actions (e.g., PrintScreen) SHALL be processed
6. THE system SHALL NOT initiate any interaction with the D2R game process; all detection activity SHALL be triggered exclusively by new image content appearing on the system clipboard as a result of user action
7. THE system SHALL NOT enumerate, query, or monitor running game processes for the purpose of detecting game state or triggering clipboard processing

### Requirement 9: Privacy and Local Processing

**User Story:** As a player, I want all screenshot processing to happen locally on my machine so that my gameplay images are never sent elsewhere.

#### Acceptance Criteria

1. THE OCR_Engine SHALL perform all text extraction locally using a bundled OCR library with no external service dependencies
2. THE system SHALL NOT transmit screenshot image data or extracted text over any network connection, including cloud sync, telemetry, or any other outbound communication
3. WHEN OCR processing of an image is complete, THE system SHALL immediately release the image data from memory and SHALL NOT write it to disk at any point during or after processing
4. THE system SHALL store only the Detection_Result (item name, confidence score, timestamp) in the database, not the source image or raw extracted text
5. IF cloud sync is enabled, THEN THE system SHALL sync only Detection_Result fields (item name, confidence score, timestamp) and SHALL NOT include source image data or raw OCR-extracted text in any sync payload

### Requirement 10: Integration with Existing Item Logging

**User Story:** As a player, I want detected items to be logged through the same system as manually-entered items so that all my item history is unified.

#### Acceptance Criteria

1. WHEN the user confirms a detected item, THE system SHALL invoke the `create_item` Tauri command with a `CreateItemInput` containing the detected item's name, item_type, rarity, profile_id, run_id, and optional notes, storing the result in the same `items` database table used by manual item logging
2. THE logged item SHALL include all fields present in a manually-logged item: id (auto-generated UUID), run_id, profile_id, name, item_type, rarity, found_at (RFC 3339 timestamp generated at insertion time), and notes
3. WHEN an active farming session exists (a run with no `finished_at` timestamp for the active profile), THE system SHALL set the detected item's `run_id` to the current active run's id
4. WHEN no active farming session exists, THE system SHALL create a standalone run entry for the active profile before logging the item, associating the detected item with that run's id
5. WHEN a confirmed detected item has item_type "Rune" and rarity "Rune", THE system SHALL call `syncRuneOnCreate` with the active profile's id, item name, item_type, and rarity so that the Rune Inventory count increments by 1
6. IF the `create_item` command fails when logging a confirmed detection, THEN THE system SHALL display an error message indicating the item could not be saved and SHALL NOT update rune inventory counts

### Requirement 11: Performance and Resource Usage

**User Story:** As a player, I want the screenshot detection feature to run without noticeably impacting my system performance while I am playing D2R.

#### Acceptance Criteria

1. THE Clipboard_Monitor SHALL consume less than 1% CPU averaged over any 10-second window while polling in its idle state (no new image detected)
2. THE OCR_Engine SHALL process a single screenshot in a background thread without blocking the application UI thread for more than 16 milliseconds
3. THE OCR_Engine SHALL limit concurrent processing to one image at a time, queuing at most 1 pending image and discarding any older queued image when a newer clipboard entry arrives during processing
4. THE system SHALL add no more than 50 MB to the application memory footprint from the bundled OCR library and its language data at rest, and no more than 200 MB peak memory above the application baseline during active OCR processing
5. IF OCR processing exceeds 5 seconds for a single image, THEN THE OCR_Engine SHALL abort processing, emit no detection event, and display a transient notification indicating that detection timed out
6. IF the OCR_Engine discards a queued image due to a newer clipboard entry arriving, THEN THE OCR_Engine SHALL process only the most recent image and emit no detection event for the discarded image

### Requirement 12: OCR Text Parser for D2R Tooltip Format

**User Story:** As a player, I want the system to correctly identify the item name from D2R's specific tooltip layout so that detection is accurate even when other text is present in the screenshot.

#### Acceptance Criteria

1. WHEN the OCR_Engine extracts tooltip text, THE OCR_Engine SHALL treat the first line of extracted text as the item name candidate, or the first two lines concatenated if the first line alone does not produce a match against the known item database
2. WHEN the extracted text contains a rarity label ("Unique", "Set", "Rare", "Magic", "Crafted") or an item type label (base type name such as "Shako", "Diadem", "Monarch") on a separate line adjacent to the item name, THE OCR_Engine SHALL strip that label before performing the item name match
3. THE OCR_Engine SHALL handle multi-word item names containing spaces as a single match unit against the item database (e.g., "Harlequin Crest", "Chains of Honor", "Bul-Kathos' Wedding Band")
4. WHEN normalizing extracted text, THE OCR_Engine SHALL remove leading and trailing whitespace, collapse multiple consecutive spaces into one, remove line breaks within a candidate name, and remove characters that are not letters (A-Z, a-z), digits (0-9), spaces, hyphens (-), or apostrophes (')
5. IF the extracted text contains multiple item name candidates (e.g., a screenshot showing inventory), THEN THE OCR_Engine SHALL select the candidate whose bounding box has the largest vertical position closest to the top-center of the captured region
6. IF the OCR_Engine cannot match any extracted text candidate to a known item in the item database, THEN THE OCR_Engine SHALL return a no-match result without producing a false-positive identification
