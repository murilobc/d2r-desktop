# Clipboard Monitor Crash Fix — Bugfix Design

## Overview

The application panics when the user enables Clipboard Monitoring because `update_screenshot_settings` is a synchronous Tauri command. In Tauri 2, synchronous commands execute on a thread-pool thread that has no Tokio runtime context, so the `tokio::spawn` call inside `ClipboardMonitor::start()` panics. The fix converts the command to an `async fn`, which Tauri 2 executes within the Tokio runtime, providing the required context for spawning tasks.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — enabling clipboard monitoring (toggling from OFF to ON) via `update_screenshot_settings`
- **Property (P)**: The desired behavior — `ClipboardMonitor::start()` succeeds without panic and the polling loop begins
- **Preservation**: Existing behaviors that must remain unchanged — stopping the monitor, persisting non-toggle settings, one-shot detection, reading settings
- **`update_screenshot_settings`**: The Tauri command in `src-tauri/src/screenshot/mod.rs` that validates, persists settings, and starts/stops the clipboard monitor
- **`ClipboardMonitor::start()`**: Method in `src-tauri/src/screenshot/monitor.rs` that calls `tokio::spawn` to begin clipboard polling
- **MonitorState**: Managed Tauri state wrapping `Arc<Mutex<Option<ClipboardMonitor>>>`
- **DbState**: Managed Tauri state wrapping the SQLite connection behind a `Mutex`

## Bug Details

### Bug Condition

The bug manifests when the user toggles Clipboard Monitoring from OFF to ON. The `update_screenshot_settings` command is declared as a synchronous `pub fn`, so Tauri 2 dispatches it on a plain thread-pool thread. Inside that thread, `ClipboardMonitor::start()` calls `tokio::spawn(...)`, which requires an active Tokio runtime context. Since no runtime exists on the thread-pool thread, the call panics.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SettingsUpdateInput { old_settings, new_settings }
  OUTPUT: boolean

  RETURN input.new_settings.monitoring_enabled = true
         AND input.old_settings.monitoring_enabled = false
END FUNCTION
```

### Examples

- **Toggle ON (crash):** User goes to Settings → Screenshot Detection, flips Clipboard Monitoring from OFF to ON. App panics with "there is no reactor running, must be called from the context of a Tokio runtime".
- **First launch after crash:** App starts, reads `monitoring_enabled=true` from DB, but no monitor is running — inconsistent state.
- **Toggle OFF (no crash):** User flips monitoring from ON to OFF. `monitor.stop()` sets an `AtomicBool` and returns — no `tokio::spawn` involved, no panic.
- **Change confidence threshold (no crash):** User adjusts OCR confidence slider without changing the monitoring toggle. No `tokio::spawn` is called.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Toggling Clipboard Monitoring from ON to OFF must continue to stop the monitor and persist the OFF state
- Updating non-toggle settings (confidence threshold, watched patterns) must continue to persist without affecting monitor state
- `get_screenshot_settings` must continue to return persisted settings from the database
- `detect_from_clipboard` (manual one-shot detection) must continue to work correctly
- The clipboard polling loop's behavior (SHA-256 deduplication, OCR dispatch) must remain identical

**Scope:**
All inputs that do NOT involve toggling monitoring from OFF to ON should be completely unaffected by this fix. This includes:
- Toggling monitoring from ON to OFF
- Updating any other screenshot setting field
- Reading settings
- Manual clipboard detection
- Any other Tauri command

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Missing Tokio Runtime Context**: `update_screenshot_settings` is declared as `pub fn` (synchronous). Tauri 2 runs synchronous commands on its internal thread pool, which does not have a Tokio runtime attached. When `ClipboardMonitor::start()` calls `tokio::spawn(...)`, Tokio panics because `Handle::current()` finds no runtime.

2. **Why async fixes it**: In Tauri 2, `async` commands are polled on the Tokio runtime that Tauri itself manages. Converting the command to `pub async fn` means `tokio::spawn` will find the runtime context via thread-local storage.

3. **No behavioral changes needed in the function body**: The function body contains no `.await` points (the `tokio::spawn` inside `start()` returns a `JoinHandle` that is not awaited). The `std::sync::Mutex` locks are acquired and released within synchronous blocks, so they are safe in an async context.

4. **Lifetime annotation required**: Tauri 2 async commands require `State<'_, T>` lifetime annotations instead of the elided `State<T>` used in sync commands.

## Correctness Properties

Property 1: Bug Condition — Monitor Starts Without Panic

_For any_ input where the bug condition holds (monitoring toggled from OFF to ON), the fixed `update_screenshot_settings` function SHALL return `Ok(settings)` without panicking, and the `MonitorState` SHALL contain a running `ClipboardMonitor` instance.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Non-Toggle Operations Unchanged

_For any_ input where the bug condition does NOT hold (monitoring not toggled from OFF to ON), the fixed `update_screenshot_settings` function SHALL produce the same result as the original function, preserving settings persistence, monitor stopping, and all non-toggle behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src-tauri/src/screenshot/mod.rs`

**Function**: `update_screenshot_settings`

**Specific Changes**:

1. **Add `async` keyword**: Change `pub fn update_screenshot_settings` to `pub async fn update_screenshot_settings`

2. **Add lifetime annotations to `State` parameters**: Change `State<DbState>` to `State<'_, DbState>` and `State<MonitorState>` to `State<'_, MonitorState>`

3. **No changes to function body**: The body has no `.await` points. The `std::sync::Mutex` locks are acquired and released in synchronous blocks (not held across await points), so they remain safe.

4. **No changes to `get_screenshot_settings`**: This command does not call `tokio::spawn` and can remain synchronous.

5. **No changes to command registration**: Tauri 2's `invoke_handler` macro handles both sync and async commands transparently.

### Final Signature

```rust
#[tauri::command]
pub async fn update_screenshot_settings(
    state: State<'_, DbState>,
    monitor_state: State<'_, MonitorState>,
    app: tauri::AppHandle,
    settings: ScreenshotSettings,
) -> Result<ScreenshotSettings, String> {
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write a test that invokes `update_screenshot_settings` with `monitoring_enabled=true` (from a state where it was `false`) in a context without a Tokio runtime. Observe the panic on unfixed code.

**Test Cases**:
1. **Sync Context Spawn Test**: Call `ClipboardMonitor::start()` from a non-Tokio thread (will panic on unfixed code)
2. **Async Context Spawn Test**: Call `ClipboardMonitor::start()` from within a Tokio runtime (should succeed even on unfixed code, confirming root cause)
3. **Toggle ON via Command**: Invoke `update_screenshot_settings` with monitoring toggled ON through Tauri's command system (will panic on unfixed code)

**Expected Counterexamples**:
- `tokio::spawn` panics with "there is no reactor running" when called from a sync Tauri command thread
- Confirming the panic does NOT occur when the same code runs inside `#[tokio::test]` validates that async context is the fix

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := update_screenshot_settings_fixed(input)
  ASSERT result.is_ok()
  ASSERT monitor_state contains Some(running_monitor)
  ASSERT no_panic_occurred()
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT update_screenshot_settings_original(input) = update_screenshot_settings_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of settings fields automatically
- It catches edge cases around boundary values (e.g., confidence=0.0, empty patterns)
- It provides strong guarantees that non-toggle behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code for non-toggle settings updates, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Toggle OFF Preservation**: Verify stopping the monitor continues to work after the fix
2. **Settings-Only Update Preservation**: Verify changing confidence/patterns without toggling monitoring produces identical results
3. **Read Settings Preservation**: Verify `get_screenshot_settings` returns identical results
4. **One-Shot Detection Preservation**: Verify `detect_from_clipboard` continues to function

### Unit Tests

- Test that `update_screenshot_settings` returns `Ok` when toggling monitoring ON (async context)
- Test that `update_screenshot_settings` returns `Ok` when toggling monitoring OFF
- Test that `update_screenshot_settings` persists non-toggle settings correctly
- Test edge cases: already-enabled toggle ON (no-op), already-disabled toggle OFF (no-op)

### Property-Based Tests

- Generate random `ScreenshotSettings` with `monitoring_enabled=true` and varying old states — verify no panic and monitor starts
- Generate random `ScreenshotSettings` with `monitoring_enabled` unchanged — verify identical behavior to original
- Generate random valid confidence thresholds and pattern lists — verify persistence is unchanged

### Integration Tests

- Full flow: open settings panel → toggle monitoring ON → verify no crash and monitor state is active
- Full flow: toggle ON → toggle OFF → verify monitor stops cleanly
- Full flow: toggle ON → change confidence → verify monitor keeps running with new settings
- Restart simulation: set monitoring ON in DB → start app → verify monitor auto-starts (future consideration)
