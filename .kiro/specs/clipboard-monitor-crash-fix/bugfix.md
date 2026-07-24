# Bugfix Requirements Document

## Introduction

The application crashes when the user toggles "Clipboard Monitoring" from OFF to ON in Settings → Screenshot Detection. The root cause is that `update_screenshot_settings` is a synchronous Tauri command that calls `ClipboardMonitor::start()`, which internally uses `tokio::spawn`. In Tauri 2, synchronous commands run on a plain thread pool (not inside the Tokio runtime), so `tokio::spawn` panics with "there is no reactor running, must be called from the context of a Tokio runtime". The settings are persisted to the database before the crash occurs, leaving the app in an inconsistent state on restart.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user toggles Clipboard Monitoring from OFF to ON THEN the system crashes with a panic: "there is no reactor running, must be called from the context of a Tokio runtime"

1.2 WHEN the crash occurs THEN the system has already persisted monitoring_enabled=true to the database, leaving inconsistent state on next launch

1.3 WHEN the user reopens the app after the crash THEN the system shows Clipboard Monitoring as ON but no monitor is actually running (the toggle was never started successfully)

### Expected Behavior (Correct)

2.1 WHEN the user toggles Clipboard Monitoring from OFF to ON THEN the system SHALL start the clipboard monitor without crashing and the toggle SHALL visually update to ON

2.2 WHEN the monitoring toggle changes from OFF to ON THEN the system SHALL start the clipboard polling loop in the background within the Tokio runtime context

2.3 WHEN the user reopens the app after enabling monitoring THEN the system SHALL show monitoring as ON with the monitor actively running

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user toggles Clipboard Monitoring from ON to OFF THEN the system SHALL CONTINUE TO stop the monitor and persist the OFF state

3.2 WHEN the user updates other screenshot settings (e.g., confidence threshold, watched patterns) without changing the monitoring toggle THEN the system SHALL CONTINUE TO persist those settings without affecting the monitor state

3.3 WHEN the user uses the manual "Detect from Screenshot" button THEN the system SHALL CONTINUE TO perform one-shot clipboard detection correctly

3.4 WHEN the user reads screenshot settings via `get_screenshot_settings` THEN the system SHALL CONTINUE TO return the persisted settings from the database

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SettingsUpdateInput
  OUTPUT: boolean
  
  // Bug triggers when monitoring is toggled from OFF to ON
  RETURN X.new_settings.monitoring_enabled = true
     AND X.old_settings.monitoring_enabled = false
END FUNCTION
```

```pascal
// Property: Fix Checking - Monitor starts without panic
FOR ALL X WHERE isBugCondition(X) DO
  result ← update_screenshot_settings'(X)
  ASSERT no_panic(result)
    AND result.is_ok()
    AND monitor_is_running(result)
END FOR
```

```pascal
// Property: Preservation Checking - Non-toggle updates unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT update_screenshot_settings(X) = update_screenshot_settings'(X)
END FOR
```
