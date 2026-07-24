# Implementation Plan

## Overview

Fix the application crash when enabling Clipboard Monitoring by converting `update_screenshot_settings` from a synchronous to an async Tauri command. The fix is a single-file change to `src-tauri/src/screenshot/mod.rs` — adding `async` and lifetime annotations. Testing follows the bug condition methodology: first confirm the bug exists, then verify non-buggy behavior is preserved, then apply the minimal fix.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Tokio Spawn Panics Outside Runtime Context
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `tokio::spawn` panics without a Tokio runtime
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — calling `ClipboardMonitor::start()` from a plain thread (no Tokio runtime context) with `monitoring_enabled=true` and any valid settings
  - Create a test in `src-tauri/src/screenshot/mod.rs` (or a dedicated test file)
  - Spawn a plain `std::thread` (no `#[tokio::test]`, no runtime) and call `ClipboardMonitor::start()` inside it
  - Assert that the call panics with a message containing "no reactor running" or "must be called from the context of a Tokio"
  - Use `std::panic::catch_unwind` to capture the panic without crashing the test runner
  - The test confirms the bug condition: `isBugCondition(input)` where `new_settings.monitoring_enabled = true AND old_settings.monitoring_enabled = false`
  - Run test on UNFIXED code with `cargo test` in `src-tauri/`
  - **EXPECTED OUTCOME**: Test FAILS (panic is caught, confirming the bug exists — `tokio::spawn` cannot run outside a runtime)
  - Document counterexample: "`ClipboardMonitor::start(app_handle, settings)` panics on a thread without Tokio runtime context"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Toggle Operations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Context**: All inputs where `isBugCondition` returns false must produce unchanged behavior
  - Observe on UNFIXED code:
    - `monitor.stop()` sets `running` to false and returns without panic
    - `get_screenshot_settings` returns persisted settings from DB
    - Settings updates that don't toggle monitoring persist correctly without affecting monitor state
    - `detect_from_clipboard` performs one-shot detection correctly
  - Write property-based tests (using `proptest` crate) covering:
    - **Toggle OFF preservation**: For any running monitor, calling `stop()` sets `is_running()` to false
    - **Settings persistence preservation**: For any valid `ScreenshotSettings` where `monitoring_enabled` does not change from false to true, `update_settings` persists and returns the same settings
    - **Read settings preservation**: `get_screenshot_settings` returns whatever was last persisted
  - Use `#[tokio::test]` for async context (preservation tests should pass on unfixed code since they don't trigger the bug condition)
  - Run tests on UNFIXED code with `cargo test` in `src-tauri/`
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for update_screenshot_settings crash when enabling clipboard monitoring

  - [x] 3.1 Implement the fix
    - In `src-tauri/src/screenshot/mod.rs`, change `pub fn update_screenshot_settings` to `pub async fn update_screenshot_settings`
    - Change `state: State<DbState>` to `state: State<'_, DbState>`
    - Change `monitor_state: State<MonitorState>` to `monitor_state: State<'_, MonitorState>`
    - No changes to the function body (no `.await` points needed; `std::sync::Mutex` locks are safe)
    - No changes to `get_screenshot_settings` (it doesn't call `tokio::spawn`)
    - No changes to command registration in `main.rs` (Tauri 2 handles async commands transparently)
    - Verify with `cargo check` in `src-tauri/` that the fix compiles cleanly
    - _Bug_Condition: isBugCondition(input) where new_settings.monitoring_enabled = true AND old_settings.monitoring_enabled = false_
    - _Expected_Behavior: update_screenshot_settings returns Ok(settings) without panic, MonitorState contains running ClipboardMonitor_
    - _Preservation: Non-toggle operations (stop, settings persistence, read, one-shot detection) unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Monitor Starts Without Panic in Async Context
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no panic when `tokio::spawn` has a runtime context)
    - After the fix, the command runs inside the Tokio runtime, so `ClipboardMonitor::start()` can call `tokio::spawn` without panicking
    - Run bug condition exploration test from step 1 with `cargo test` in `src-tauri/`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — async context provides the Tokio runtime)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Toggle Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 with `cargo test` in `src-tauri/`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions introduced)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full Rust test suite: `cd src-tauri && cargo test`
  - Run frontend tests: `npm test`
  - Run Rust compilation check: `cd src-tauri && cargo check`
  - Run TypeScript compilation: `npx tsc --noEmit`
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```

## Notes

- The fix is a 3-line change: add `async`, add `'_` lifetime to both `State` params
- File to modify: `src-tauri/src/screenshot/mod.rs`
- No function body changes, no frontend changes, no command registration changes
- The Rust test environment uses `#[tokio::test]` which provides a runtime — testing the panic requires spawning a plain thread without runtime context
- `cargo check` is sufficient to verify the fix compiles; `cargo test` runs the full suite
- Property-based tests use `proptest` for generating random valid settings combinations
