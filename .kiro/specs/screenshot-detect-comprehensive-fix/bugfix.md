# Bugfix Requirements Document

## Introduction

The Detect Screenshot system has four interconnected bugs that prevent it from functioning correctly in several scenarios. (1) The folder-based screenshot source does not detect full-game screenshots saved by Print Screen to the configured screenshots folder — only Flameshot clipboard captures work. (2) The global keybind configured in settings to trigger detect screenshot does not fire or fails silently. (3) The Detect Screenshot button in the overlay window does not produce any visible result — the overlay invokes the backend command but neither handles the response nor relays it to the main window. (4) Detection proceeds even without an active session/run, creating orphaned "Screenshot Detection" runs instead of requiring the user to have a session active.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user presses Print Screen and a full game screenshot is saved to the configured D2R screenshots folder, and the user clicks the Detect Screenshot button THEN the system does not read or process the newly saved file from the folder source — only clipboard-based detection is triggered by the sidebar button

1.2 WHEN folder monitoring is enabled in settings and the application starts THEN the system does not record the current baseline of existing screenshot files in the folder, so it cannot reliably distinguish new screenshots from pre-existing ones

1.3 WHEN a new screenshot file appears in the watched folder with a creation timestamp matching the current date/time THEN the system fails to detect and process it automatically because the folder watcher is not restarted on application launch when settings already have `folder_monitoring_enabled: true`

1.4 WHEN the user configures a detect screenshot keybind in settings and presses the configured key combination THEN the system does not execute the detection — the global shortcut registration fails silently or the shortcut is not being re-registered after app restart

1.5 WHEN the keybind registration fails (e.g., key combo already in use by another application) THEN the system logs a warning to console but provides no feedback to the user that the keybind is not active

1.6 WHEN the user clicks the Detect Screenshot button (◫) in the overlay window THEN the system invokes `detect_from_clipboard` on the backend but the overlay has no listener for `screenshot:item-detected` or `screenshot:detection-failed` events, so the user sees no result

1.7 WHEN the overlay detect button triggers a successful detection THEN the system emits `screenshot:item-detected` but the overlay does not display the confirmation dialog or relay the result to the main window for user action

1.8 WHEN the user triggers detect screenshot (via sidebar button, keybind, or overlay) with no active session/run THEN the system creates a standalone "Screenshot Detection" run automatically via `getOrCreateRunId`, adding items without the user's explicit intent to be in an active farming session

1.9 WHEN the user has an active session/run and items are added (via detection or manual search) THEN the overlay does not display the current run's item count, giving the user no visibility into detected items from the overlay

### Expected Behavior (Correct)

2.1 WHEN the application starts and `folder_monitoring_enabled` is `true` in persisted settings THEN the system SHALL record the current number and latest modification time of existing screenshot files in the configured folder as the baseline, and start the folder watcher automatically

2.2 WHEN a new screenshot file appears in the watched folder with a creation/modification timestamp after the recorded baseline and compatible with the current date/time THEN the system SHALL automatically read the file and run it through the detection pipeline without requiring the user to click any button

2.3 WHEN the user clicks the Detect Screenshot sidebar button and folder monitoring is enabled THEN the system SHALL check the folder source for any new files added since the last check (in addition to checking the clipboard), so that full-game screenshots saved by Print Screen are also processed

2.4 WHEN the user configures a detect screenshot keybind and presses the key combination THEN the system SHALL invoke the detection flow identically to clicking the sidebar Detect Screenshot button

2.5 WHEN the global shortcut registration fails for the detect screenshot keybind THEN the system SHALL display a toast notification informing the user that the keybind could not be registered and the reason (e.g., "Keybind Ctrl+Shift+D could not be registered — it may be in use by another application")

2.6 WHEN the user clicks the Detect Screenshot button in the overlay window and detection succeeds THEN the system SHALL emit an event that the main window's detection handler picks up, displaying the confirmation dialog in the main window for item confirmation

2.7 WHEN the user clicks the Detect Screenshot button in the overlay window and detection fails THEN the system SHALL relay the failure to the main window so the detection toast shows the appropriate error message

2.8 WHEN the user triggers detect screenshot (via any source: sidebar, keybind, overlay, or folder watcher) and there is no active session/run THEN the system SHALL NOT execute the detection pipeline and SHALL display a toast notification with the message "Start a session first to detect items"

2.9 WHEN the user triggers detect screenshot and there is an active session/run THEN the system SHALL proceed with detection normally and add confirmed items to the active run

2.10 WHEN the user has an active session/run THEN the overlay SHALL display the item count for the current run, including items added via detect screenshot and items added manually via the item search

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user captures an item tooltip with Flameshot to the clipboard and clicks Detect Screenshot THEN the system SHALL CONTINUE TO read the clipboard image and run the detection pipeline successfully

3.2 WHEN clipboard monitoring is enabled and the clipboard content changes to a new image THEN the system SHALL CONTINUE TO automatically process the image through the detection pipeline

3.3 WHEN the detection pipeline successfully identifies an item above the confidence threshold THEN the system SHALL CONTINUE TO emit `screenshot:item-detected` and display the ConfirmationDialog with match candidates

3.4 WHEN the detection pipeline fails (no text, no match, OCR error) THEN the system SHALL CONTINUE TO emit `screenshot:detection-failed` with the appropriate reason code and display the detection toast

3.5 WHEN no profile is selected and the user clicks Detect Screenshot THEN the system SHALL CONTINUE TO display the "Select a profile first to log items" toast

3.6 WHEN the nextRun, pause, and endSession keybinds are configured THEN the system SHALL CONTINUE TO register and fire those shortcuts correctly, unaffected by changes to the detectScreenshot keybind logic

3.7 WHEN the overlay displays session stats (session time, run time, run count, area) THEN the system SHALL CONTINUE TO update those values in real-time via the `overlay-state-update` event

---

### Bug Condition (Structured Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type DetectionTriggerInput
  OUTPUT: boolean

  // Bug 1: Folder source not checked on manual trigger and not auto-started
  folderBug ← (X.triggerSource = "sidebar_button" OR X.triggerSource = "keybind")
              AND X.folderMonitoringEnabled = TRUE
              AND X.newFilesInFolder = TRUE

  // Bug 2: Folder watcher not started on app launch with baseline recording
  startupBug ← X.triggerSource = "app_startup"
               AND X.folderMonitoringEnabled = TRUE
               AND (X.folderWatcherRunning = FALSE OR X.baselineNotRecorded = TRUE)

  // Bug 3: Keybind not registered or silently failing
  keybindBug ← X.triggerSource = "keybind"
               AND X.keybindConfigured = TRUE
               AND X.shortcutRegistrationFailed = TRUE

  // Bug 4: Overlay button result not visible
  overlayBug ← X.triggerSource = "overlay_button"
               AND X.detectionCompleted = TRUE
               AND X.mainWindowNotified = FALSE

  // Bug 5: Detection without active session
  sessionBug ← X.hasActiveSession = FALSE
               AND X.hasProfile = TRUE
               AND X.detectionTriggered = TRUE

  RETURN folderBug OR startupBug OR keybindBug OR overlayBug OR sessionBug
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — All detection trigger paths produce visible results
FOR ALL X WHERE isBugCondition(X) DO
  result ← detectScreenshot'(X)

  // Bug 1 fix: folder source checked on manual trigger
  IF X.folderMonitoringEnabled AND X.newFilesInFolder THEN
    ASSERT folder_files_processed(result) = TRUE
  END IF

  // Bug 2 fix: folder watcher starts on app launch
  IF X.triggerSource = "app_startup" AND X.folderMonitoringEnabled THEN
    ASSERT folder_watcher_started(result) = TRUE
  END IF

  // Bug 3 fix: keybind failure notifies user
  IF X.shortcutRegistrationFailed THEN
    ASSERT toast_displayed(result, "keybind registration failed")
  END IF

  // Bug 4 fix: overlay detection relays to main window
  IF X.triggerSource = "overlay_button" AND X.detectionCompleted THEN
    ASSERT main_window_notified(result) = TRUE
  END IF

  // Bug 5 fix: no-session blocks detection
  IF X.hasActiveSession = FALSE THEN
    ASSERT detection_blocked(result) = TRUE
    ASSERT toast_displayed(result, "Start a session first to detect items")
  END IF
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking — Existing working paths remain unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT detectScreenshot(X) = detectScreenshot'(X)
END FOR
```

**Key Definitions:**
- **F** (`detectScreenshot`): The original system where folder source is not checked on manual trigger, keybinds fail silently, overlay results are invisible, and detection creates orphaned runs
- **F'** (`detectScreenshot'`): The fixed system where all trigger paths produce visible feedback, folder source is properly integrated, and detection requires an active session
