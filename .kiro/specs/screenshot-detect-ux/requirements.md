# Requirements Document

## Introduction

This feature improves the user experience of the existing screenshot detection system in the D2R Desktop tracker application. Currently, the manual "Detect Screenshot" button in the sidebar silently fails when no clipboard image is present or when no item can be recognized. This feature addresses three UX gaps: (1) providing visual feedback (toast notifications) when detection fails, (2) adding a screenshot detection trigger button to the always-on-top overlay window, and (3) allowing users to configure a global keyboard shortcut that triggers the same clipboard detection pipeline from anywhere.

## Glossary

- **Detection_Pipeline**: The existing sequence of operations: read clipboard image → OCR extraction → tooltip parsing → item matching → event emission, triggered by the `detect_from_clipboard` Tauri command
- **Toast_Notification**: A brief, non-modal message that appears temporarily in the application UI to inform the user of a status or error
- **Overlay_Window**: The separate Tauri WebviewWindow (label "overlay") that renders always-on-top, transparent, and draggable over the D2R game
- **Detection_Hotkey**: A user-configurable global keyboard shortcut that triggers the Detection_Pipeline when pressed, regardless of which window has focus
- **Hotkey_Settings**: The existing localStorage-based hotkey configuration system used in the Settings page (stores keybindings and registers them via `@tauri-apps/plugin-global-shortcut`)
- **Sidebar_Button**: The existing "Detect Screenshot" button rendered in the main window sidebar when a Profile is selected
- **Profile**: An existing application entity representing a single D2R character; required for item logging

## Requirements

### Requirement 1: Visual Feedback on Detection Failure

**User Story:** As a player, I want to see a clear message when screenshot detection fails so that I know what went wrong instead of wondering if the button worked.

#### Acceptance Criteria

1. WHEN the user triggers item detection (via the "Detect from Screenshot" button or automatic clipboard detection) and the system clipboard contains no image data, THE Toast_Notification SHALL display the message "No image found in clipboard" within 500 milliseconds of the trigger
2. WHEN the user triggers item detection and the OCR_Engine extracts no readable text from the clipboard image, THE Toast_Notification SHALL display the message "No text detected in screenshot" within 500 milliseconds of the OCR_Engine returning an empty result
3. WHEN the user triggers item detection and the Item_Matcher produces no candidates with a Confidence_Score above 30, THE Toast_Notification SHALL display the message "No item detected in screenshot" within 500 milliseconds of the Item_Matcher returning results
4. THE Toast_Notification SHALL auto-dismiss after 4 seconds without requiring user interaction
5. THE Toast_Notification SHALL render in a fixed position (bottom-right of the main window) without an overlay, allowing pointer and keyboard interaction with all other UI elements while the notification is visible
6. WHEN a new Toast_Notification is triggered while a previous one is still visible, THE system SHALL replace the previous notification with the new one and reset the 4-second dismiss timer
7. THE Toast_Notification SHALL be dismissible by the user before the 4-second auto-dismiss period via a visible close button that is keyboard-focusable and activatable with Enter or Space

### Requirement 2: Visual Feedback on Detection Success (No Profile)

**User Story:** As a player, I want to understand why detection appears to do nothing when no profile is selected so that I can fix the issue.

#### Acceptance Criteria

1. WHEN the Detection_Pipeline is triggered via the Overlay_Window button or Detection_Hotkey and no Profile is currently selected in the main window, THE Toast_Notification SHALL display the message "Select a profile first to log items" within 500 milliseconds of the trigger
2. WHEN the Detection_Pipeline is triggered via automatic clipboard monitoring and no Profile is currently selected in the main window, THE Toast_Notification SHALL display the message "Select a profile first to log items" within 500 milliseconds of the trigger, and the Detection_Pipeline SHALL not proceed to OCR processing
3. IF no Profile is currently selected, THEN THE Sidebar_Button SHALL remain hidden, preserving the existing behavior

### Requirement 3: Overlay Detection Button

**User Story:** As a player, I want a button in the game overlay to trigger screenshot detection so that I can detect items without alt-tabbing to the main window.

#### Acceptance Criteria

1. THE Overlay_Window SHALL display a screenshot detection button with a camera icon (◫) that is always visible regardless of whether a farming session is active, rendered within the overlay header area when no session is active and within the overlay controls bar when a session is active
2. WHEN the user clicks the overlay detection button and a Profile is currently selected, THE Overlay_Window SHALL invoke the same `detect_from_clipboard` Tauri command used by the Sidebar_Button
3. THE overlay detection button SHALL use the same CSS class pattern (`ov-btn`), dimensions, and spacing as the existing overlay control buttons (split/pause/stop/item buttons)
4. WHEN the overlay detection button is clicked and detection fails, THE Toast_Notification SHALL appear in the main window following the same feedback rules defined in Requirement 1
5. WHEN the overlay detection button is clicked and detection succeeds, THE Confirmation_Dialog SHALL appear in the main window following the existing detection confirmation flow
6. THE overlay detection button SHALL be keyboard-accessible, activatable via Enter or Space key press, and SHALL display a visible focus indicator with at least 3:1 contrast ratio against adjacent colors when focused
7. IF the user clicks the overlay detection button and no Profile is currently selected in the main window, THEN THE Toast_Notification SHALL display the message "Select a profile first to log items" following the same feedback rules defined in Requirement 1

### Requirement 4: Configurable Global Hotkey for Detection

**User Story:** As a player, I want to configure a keyboard shortcut that triggers screenshot detection from anywhere so that I can detect items without clicking any button.

#### Acceptance Criteria

1. THE Hotkey_Settings section in the Settings page SHALL include a "Detect Screenshot" hotkey entry alongside the existing Next Run, Pause, and End Session hotkeys
2. THE Detection_Hotkey SHALL default to no binding (empty/unset) and SHALL display the text "Not set" when no key combination is assigned, so that it does not conflict with any existing game or system shortcuts
3. WHEN the user records a new Detection_Hotkey binding in Settings, THE system SHALL register the shortcut as a global shortcut using the `@tauri-apps/plugin-global-shortcut` API within 1 second of the key combination being captured
4. WHEN the Detection_Hotkey is pressed and a Profile is selected, THE system SHALL invoke the `detect_from_clipboard` Tauri command
5. WHEN the Detection_Hotkey is pressed and no Profile is selected, THE system SHALL display a Toast_Notification with the message "Select a profile first to log items"
6. THE Detection_Hotkey configuration SHALL persist across application restarts using the same localStorage mechanism as existing hotkeys, and SHALL be re-registered as a global shortcut on application startup if a binding is set
7. WHEN the user clears the Detection_Hotkey binding (sets it to empty), THE system SHALL unregister the global shortcut so that the key combination is released back to the OS
8. THE Detection_Hotkey SHALL follow the same recording UX pattern as existing hotkeys: click the button to enter recording mode, press the desired key combination, and the shortcut is saved
9. IF the user attempts to bind the Detection_Hotkey to a key combination already assigned to another hotkey (Next Run, Pause, or End Session), THEN THE system SHALL reject the binding, retain the previous value, and display a status message indicating the key combination is already in use
10. IF global shortcut registration fails when recording or re-registering the Detection_Hotkey, THEN THE system SHALL display a status message indicating that the shortcut could not be registered, and SHALL retain the previous valid binding

### Requirement 5: Backend Error Reporting for Manual Detection

**User Story:** As a player, I want the backend to report specific failure reasons so that the frontend can show me the right error message.

#### Acceptance Criteria

1. WHEN the `detect_from_clipboard` command fails because no image is on the clipboard, THE command SHALL return an error string containing "no_image" as a distinguishable error code
2. WHEN the `detect_from_clipboard` command completes OCR but extracts no text, THE system SHALL emit a `screenshot:detection-failed` event with a reason field set to "no_text"
3. WHEN the `detect_from_clipboard` command completes matching but produces no viable candidates (all scores at or below 30), THE system SHALL emit a `screenshot:detection-failed` event with a reason field set to "no_match"
4. WHEN the frontend receives a `screenshot:detection-failed` event, THE system SHALL display a Toast_Notification with the message mapped from the reason field: "no_image" → "No image found in clipboard", "no_text" → "No text detected in screenshot", "no_match" → "No item detected in screenshot"
5. THE `screenshot:detection-failed` event payload SHALL contain a `reason` field (one of "no_image", "no_text", "no_match") and a `message` field with a human-readable description
6. WHEN the `detect_from_clipboard` command returns an error containing "no_image", THE frontend SHALL display the Toast_Notification with the message "No image found in clipboard" without waiting for a `screenshot:detection-failed` event

