# Bugfix Requirements Document

## Introduction

When the user clicks the "Detect Screenshot" sidebar button and the clipboard contains no image data, the `detectFromClipboard()` promise rejects with a "no_image" error. The `triggerManual` function in `useScreenshotDetection.ts` catches this error but only logs it to `console.error`, providing no visual feedback to the user. The existing `useDetectionToast` hook handles `screenshot:detection-failed` events (covering "no_text" and "no_match" cases), but the "no_image" case returns as a rejected promise rather than an emitted event, so the toast system never receives it. This makes the button appear to do nothing, violating existing spec requirement 5.6.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user clicks the "Detect Screenshot" sidebar button and the clipboard contains no image data THEN the system silently catches the rejected promise error and only logs it to `console.error`, providing no visual indication to the user

1.2 WHEN `triggerManual` is called and `detectFromClipboard()` rejects with an error containing "no_image" THEN the system does not call `showToast()` or emit any event that the toast system can react to

### Expected Behavior (Correct)

2.1 WHEN the user clicks the "Detect Screenshot" sidebar button and the clipboard contains no image data THEN the system SHALL display a Toast_Notification with the message "No image found in clipboard" within 500 milliseconds of the trigger

2.2 WHEN `triggerManual` is called and `detectFromClipboard()` rejects with an error containing "no_image" THEN the system SHALL invoke `showToast("No image found in clipboard")` so the user receives immediate visual feedback

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the clipboard contains a valid image and detection succeeds (item detected) THEN the system SHALL CONTINUE TO emit the `screenshot:item-detected` event and display the ConfirmationDialog with match candidates

3.2 WHEN the clipboard contains a valid image but OCR extracts no text THEN the system SHALL CONTINUE TO emit the `screenshot:detection-failed` event with reason "no_text" and the toast system SHALL CONTINUE TO display "No text detected in screenshot"

3.3 WHEN the clipboard contains a valid image but the item matcher produces no viable candidates THEN the system SHALL CONTINUE TO emit the `screenshot:detection-failed` event with reason "no_match" and the toast system SHALL CONTINUE TO display "No item detected in screenshot"

3.4 WHEN no profile is selected and the user clicks the "Detect Screenshot" button THEN the system SHALL CONTINUE TO display the toast "Select a profile first to log items" via the existing no-profile button handler

---

### Bug Condition (Structured Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ManualDetectionTrigger
  OUTPUT: boolean

  // Returns true when the clipboard has no image, causing detectFromClipboard to reject with "no_image"
  RETURN X.clipboardContent = EMPTY OR X.clipboardContent.type ≠ IMAGE
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking - "no_image" error triggers toast notification
FOR ALL X WHERE isBugCondition(X) DO
  result ← triggerManual'(X)
  ASSERT showToast_was_called WITH message = "No image found in clipboard"
  ASSERT no_unhandled_silent_failure(result)
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking - non-"no_image" flows remain unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT triggerManual(X) = triggerManual'(X)
END FOR
```

**Key Definitions:**
- **F** (`triggerManual`): The original function that catches and silently logs "no_image" errors
- **F'** (`triggerManual'`): The fixed function that catches "no_image" errors and calls `showToast("No image found in clipboard")`
