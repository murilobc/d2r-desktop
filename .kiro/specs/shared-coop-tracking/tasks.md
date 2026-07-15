# Implementation Plan: Shared Co-op Tracking

## Overview

This plan implements a local network co-op session system for D2R Tracker using a host-authoritative WebSocket architecture. The Host runs an embedded WebSocket server (via `tokio-tungstenite`), and Guests connect as thin clients. All session data flows through the Host and is persisted only in the Host's SQLite database. The frontend adds a new `CoopPanel` page accessible from the sidebar.

## Tasks

- [ ] 1. Set up dependencies, data models, and database migration
  - [ ] 1.1 Add WebSocket and async dependencies to Cargo.toml
    - Add `tokio-tungstenite = "0.24"` and `futures-util = "0.3"` to `[dependencies]`
    - Add `tokio = { version = "1", features = ["full"] }` to `[dependencies]`
    - Add `rand = "0.8"` to `[dependencies]` for session code generation
    - Add `proptest = "1"` to `[dev-dependencies]` for property-based testing
    - _Requirements: 1.1, 1.2_

  - [ ] 1.2 Create data model structs in `src-tauri/src/models.rs`
    - Add `CoopServerInfo` struct (session_code, host_ip, port)
    - Add `SessionState` struct (session_code, host_player, players, run_count, elapsed_secs, paused, items)
    - Add `PlayerInfo` struct (name, profile_id, status, items_found, runs_contributed)
    - Add `CoopItemData` struct (id, name, item_type, rarity, player_name, found_at)
    - Add `CoopItemInput` struct (name, item_type, rarity)
    - All structs derive `Debug, Serialize, Deserialize, Clone`
    - _Requirements: 3.3, 4.1, 4.2, 5.1_

  - [ ] 1.3 Add database migration for `coop_player_name` column
    - Add `ALTER TABLE items ADD COLUMN coop_player_name TEXT DEFAULT NULL` to the DB init/migration logic in `src-tauri/src/db.rs`
    - Ensure backward compatibility — NULL means solo item
    - _Requirements: 7.3, 10.4_

- [ ] 2. Implement WebSocket protocol message types
  - [ ] 2.1 Define `ProtocolMessage` enum in `src-tauri/src/coop.rs`
    - Create new file `src-tauri/src/coop.rs`
    - Define `ProtocolMessage` enum with `#[serde(tag = "type")]` attribute
    - Include variants: `Auth`, `AuthOk`, `AuthFail`, `SessionSync`, `RunSplit`, `Pause`, `SessionEnd`, `ItemLog`, `ItemUpdate`, `TimerTick`, `PlayerUpdate`
    - Implement serialization/deserialization tests
    - Register `mod coop;` in `src-tauri/src/lib.rs`
    - _Requirements: 2.3, 2.5, 3.1, 3.2_

  - [ ]* 2.2 Write property test for session code format validity
    - **Property 1: Session Code Format Validity**
    - Generate random session codes using the code generation function; assert each is exactly 6 chars, all alphanumeric A-Z/0-9
    - **Validates: Requirements 1.2**

  - [ ]* 2.3 Write property test for session sync round-trip serialization
    - **Property 2: Initial State Sync Completeness**
    - Generate arbitrary `SessionState` values; serialize as `SessionSync` message; deserialize and assert equivalence
    - **Validates: Requirements 2.3**

  - [ ]* 2.4 Write property test for item message serialization with attribution
    - **Property 5: Item Message Serialization with Attribution**
    - Generate arbitrary item fields and player names; serialize `ItemLog`; deserialize and assert all fields preserved
    - **Validates: Requirements 3.3, 5.1, 7.2**

- [ ] 3. Implement CoopServer (Host WebSocket server)
  - [ ] 3.1 Implement `CoopServer` struct and server lifecycle
    - Create `CoopServer` struct with fields: `session_code`, `port`, `host_ip`, shutdown channel
    - Implement `start()` — bind to port 9876, increment up to 10 attempts on failure
    - Implement `stop()` — send shutdown signal, close all connections
    - Spawn WebSocket accept loop on a tokio task
    - Generate 6-char alphanumeric session code (A-Z, 0-9) using `rand`
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [ ] 3.2 Implement connection authentication and session sync
    - On new connection, wait for `Auth` message with session_code and player_name
    - If code matches, send `AuthOk` then `SessionSync` with full current state
    - If code doesn't match, send `AuthFail` with reason and close connection
    - Add player to `SessionState.players` with status "connected"
    - Emit `coop-state-update` Tauri event after player joins
    - _Requirements: 2.1, 2.3, 2.5_

  - [ ] 3.3 Implement broadcast and message routing
    - Implement broadcast function that sends a message to all connected guests
    - Handle incoming `ItemLog` from guests: store in DB with `coop_player_name`, broadcast `ItemUpdate`
    - Handle timer tick: broadcast `TimerTick` every second with elapsed_secs
    - Handle disconnection detection: mark player as "disconnected" in state, broadcast `PlayerUpdate`
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 8.4_

  - [ ]* 3.4 Write property test for session code authentication
    - **Property 3: Session Code Authentication**
    - Generate pairs of session codes where provided ≠ host code; assert authentication check returns rejection
    - **Validates: Requirements 2.5**

  - [ ]* 3.5 Write property test for broadcast delivery completeness
    - **Property 4: Broadcast Delivery Completeness**
    - Generate arbitrary guest ID sets and host actions; assert broadcast produces one message per connected guest
    - **Validates: Requirements 3.2, 6.2**

  - [ ]* 3.6 Write property test for host-only session control permission
    - **Property 8: Host-Only Session Control Permission**
    - Enumerate all session control actions × roles; assert permission granted iff role is "host"
    - **Validates: Requirements 6.1, 6.3**

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement CoopClient (Guest WebSocket client)
  - [ ] 5.1 Implement `CoopClient` struct and connection lifecycle
    - Create `CoopClient` struct with fields: connection handle, item queue, reconnection state
    - Implement `connect()` — establish WebSocket connection to host IP:port, send `Auth` message
    - Handle `AuthOk`/`AuthFail` responses
    - Handle incoming messages: `SessionSync`, `RunSplit`, `Pause`, `SessionEnd`, `ItemUpdate`, `TimerTick`, `PlayerUpdate`
    - Update local session state mirror and emit `coop-state-update` Tauri event on each update
    - _Requirements: 2.1, 2.4, 3.1_

  - [ ] 5.2 Implement reconnection logic and item queue
    - On disconnect: attempt reconnect every 3 seconds for 30-second window
    - Queue items logged during disconnection
    - On successful reconnect: re-authenticate, flush queued items to host
    - On timeout (30s): fall back to solo mode, notify frontend
    - _Requirements: 7.4, 8.1, 8.2, 8.3, 8.5_

  - [ ]* 5.3 Write property test for item queue retry completeness
    - **Property 9: Item Queue Retry Completeness**
    - Generate arbitrary item sequences queued during disconnection; simulate reconnect; assert all items sent and queue empty
    - **Validates: Requirements 7.4**

  - [ ]* 5.4 Write property test for disconnected player contribution retention
    - **Property 10: Disconnected Player Contribution Retention**
    - Generate session states with players and items; mark a player disconnected; assert items remain and player stays with status "disconnected"
    - **Validates: Requirements 8.4**

- [ ] 6. Implement Tauri commands and managed state
  - [ ] 6.1 Add `CoopState` to Tauri managed state in `src-tauri/src/lib.rs`
    - Define `CoopState` struct: `server: Option<CoopServer>`, `client: Option<CoopClient>`, `session: Arc<Mutex<SessionState>>`
    - Wrap in `Mutex` and add to `app.manage()` in the setup closure
    - Add `mod coop;` declaration in `lib.rs`
    - _Requirements: 10.1, 10.2_

  - [ ] 6.2 Implement host Tauri commands in `src-tauri/src/coop.rs`
    - `start_coop_server` — create CoopServer, store in state, return `CoopServerInfo`
    - `stop_coop_server` — stop server, clear state, notify guests
    - `coop_split_run` — increment run count, broadcast `RunSplit` (host only)
    - `coop_pause` — toggle pause, broadcast `Pause` (host only)
    - `coop_end_session` — broadcast `SessionEnd`, stop server, clear state
    - _Requirements: 1.1, 1.2, 6.1, 6.2, 6.4_

  - [ ] 6.3 Implement guest Tauri commands in `src-tauri/src/coop.rs`
    - `join_coop_session` — create CoopClient, connect, store in state
    - `leave_coop_session` — disconnect client, clear state, return to solo
    - `coop_log_item` — send `ItemLog` to host via client connection (or queue if disconnected)
    - _Requirements: 2.1, 7.1, 7.2, 7.4_

  - [ ] 6.4 Implement state query command and register all commands
    - `get_coop_state` — return `CoopSessionView` from current state (or None if not in co-op)
    - Register all 9 coop commands in `invoke_handler` in `src-tauri/src/lib.rs`
    - _Requirements: 4.1, 4.2, 4.3, 9.3, 9.4_

  - [ ]* 6.5 Write property test for combined run count aggregation
    - **Property 6: Combined Run Count Aggregation**
    - Generate lists of players with non-negative run counts; assert combined total equals sum of individual counts
    - **Validates: Requirements 4.1**

  - [ ]* 6.6 Write property test for per-player item grouping
    - **Property 7: Per-Player Item Grouping**
    - Generate item lists with player_name attributions; group by player; assert each group count matches input and union equals original list
    - **Validates: Requirements 4.2, 5.3**

  - [ ]* 6.7 Write property test for guest database isolation
    - **Property 11: Guest Database Isolation**
    - Verify that guest item logging does not write to the guest's local DB; only the host's DB stores co-op items
    - **Validates: Requirements 10.4**

- [ ] 7. Checkpoint - Ensure all Rust tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement frontend types and API layer
  - [ ] 8.1 Add co-op TypeScript types to `src/types.ts`
    - Add `CoopSessionView` interface (role, session_code, host_ip, port, players, combined_stats, items, session_elapsed_secs, run_count, paused)
    - Add `CoopPlayer` interface (name, profile_id, status, items_found, runs_contributed)
    - Add `CoopItem` interface (id, name, item_type, rarity, player_name, found_at)
    - Add `CoopCombinedStats` interface (total_runs, total_items, session_time_secs, items_per_hour)
    - Add `CoopItemInput` interface (name, item_type, rarity)
    - Add `CoopServerInfo` interface (session_code, host_ip, port)
    - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ] 8.2 Add co-op API functions to `src/api.ts`
    - Add `startCoopServer(playerName)` → invoke `start_coop_server`
    - Add `stopCoopServer()` → invoke `stop_coop_server`
    - Add `joinCoopSession(hostIp, port, sessionCode, playerName)` → invoke `join_coop_session`
    - Add `leaveCoopSession()` → invoke `leave_coop_session`
    - Add `coopSplitRun()`, `coopPause()`, `coopEndSession()` → invoke respective commands
    - Add `coopLogItem(item)` → invoke `coop_log_item`
    - Add `getCoopState()` → invoke `get_coop_state`
    - Import new types from `./types`
    - _Requirements: 1.1, 2.1, 6.1, 7.1, 9.1, 9.2_

- [ ] 9. Implement CoopPanel UI page
  - [ ] 9.1 Create `src/pages/CoopPanel.tsx` with idle state UI
    - Create file with functional component
    - Render "Host Session" button with player name input field
    - Render "Join Session" form with IP address, port, session code, and player name fields
    - Add form validation (IP format, non-empty code, non-empty player name)
    - Wire up `startCoopServer` and `joinCoopSession` API calls
    - _Requirements: 9.1, 9.2_

  - [ ] 9.2 Implement active session monitoring view in `CoopPanel.tsx`
    - Display session code, host IP, port when hosting
    - Display connected players list with connection status indicators (connected/disconnected)
    - Display combined stats: run count, total items, session elapsed time, items per hour
    - Display unified item log with player attribution (player name next to each item)
    - Display per-player breakdown view (toggle) showing items found by each player
    - Add host controls: "Split Run", "Pause", "End Session" buttons (visible only for host role)
    - Add guest controls: item logging via existing `ItemSearch` component, "Leave Session" button
    - Listen to `coop-state-update` Tauri event via `@tauri-apps/api/event` for real-time updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 6.1, 6.3, 7.1, 9.3, 9.4_

  - [ ]* 9.3 Write unit tests for CoopPanel rendering and state management
    - Test idle state renders host/join forms
    - Test host state renders session info and controls
    - Test guest state renders item log and leave button
    - Test combined stats display with mock data
    - Test per-player breakdown rendering
    - Test form validation (empty fields, invalid inputs)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10. Integrate CoopPanel into application navigation
  - [ ] 10.1 Add "Co-op" navigation to sidebar in `src/App.tsx`
    - Add `"coop"` to the `Page` type union
    - Add sidebar button with icon (e.g. `⇌ Co-op`) — does NOT require a selected profile
    - Add `CoopPanel` import and render case in `renderPage()`
    - Ensure existing Run Tracker and solo functionality remain unchanged
    - _Requirements: 9.5, 10.1, 10.2, 10.3_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm test` for frontend tests
  - Run `cd src-tauri && cargo test` for Rust property and unit tests
  - Run `npx tsc --noEmit` for TypeScript type-checking
  - Run `npx vite build` for frontend build verification

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `proptest` (Rust)
- Unit tests validate specific examples and edge cases using Vitest (TypeScript)
- The WebSocket server runs on a separate tokio task; state shared via `Arc<Mutex<SessionState>>`
- Host emits `coop-state-update` Tauri event to frontend on every state change
- Guest auto-reconnects every 3s for 30s window on disconnect
- Port: try 9876, increment if busy (up to 10 attempts)
- Session code: 6-char random alphanumeric (A-Z, 0-9)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 4, "tasks": ["5.1", "6.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "6.2", "6.3"] },
    { "id": 6, "tasks": ["6.4", "6.5", "6.6", "6.7"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["8.2"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3"] },
    { "id": 11, "tasks": ["10.1"] }
  ]
}
```
