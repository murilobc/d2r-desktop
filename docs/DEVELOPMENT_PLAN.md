# D2R Tracker — Development Plan

Task breakdown for each feature suggestion. Each feature = one branch + one PR.

---

## 1. Global Hotkeys ✅ IMPLEMENTED (PR #21)

**Branch:** `feat/global-hotkeys`
**Effort:** ~2-3 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Install `@tauri-apps/plugin-global-shortcut` (npm + Cargo)
2. Add plugin to `lib.rs` and capabilities
3. Create `src/pages/Settings.tsx` page with hotkey configuration UI
4. Add Settings nav item to sidebar
5. Store hotkey config in localStorage (or SQLite user_preferences table)
6. Register global shortcuts on app start that emit events to RunTracker
7. Listen for shortcut events in RunTracker (reuse existing overlay-action events)
8. Default keys: `F9` = Next Run, `F10` = Pause, `F11` = End Session
9. Add tests for Settings page
10. Update README with hotkey documentation

### Acceptance Criteria:
- [x] User can split/pause/end session without alt-tabbing
- [x] Hotkeys work even when app is not focused
- [x] Hotkeys are configurable via Settings page
- [x] Hotkeys don't conflict with D2R default bindings

---

## 2. ~~Holy Grail Tracker~~ ❌ CANCELLED

**Reason:** Will not be implemented. Removed from roadmap.

---

## 3. MF Effective Calculator ✅ IMPLEMENTED (PR #25)

**Branch:** `feat/mf-calculator-session-goals`
**Effort:** ~1-2 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Add `magic_find` optional field to Profile model (Rust + TypeScript)
2. DB migration: `ALTER TABLE profiles ADD COLUMN magic_find INTEGER DEFAULT NULL`
3. Add MF input field to Profile creation/edit form
4. Create `src/components/MFCalculator.tsx` widget
5. Formula implementation: `effective = (mf * factor) / (mf + factor)`
6. Display: table showing Effective MF for Unique (250), Set (500), Rare (600)
7. Show widget in Run Tracker page (below area selector) when profile has MF set
8. Add tests for the calculation logic
9. Update README

### Acceptance Criteria:
- [x] User inputs total MF in profile
- [x] Widget shows effective MF for each rarity type
- [x] Calculations match known D2R formulas
- [x] Optional — doesn't block usage if not set

---

## 4. Database Indexes ✅ IMPLEMENTED (PR #22)

**Branch:** `refactor/db-indexes`
**Effort:** ~30 minutes
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Add index creation to `init_db()` in `db.rs`:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_runs_profile_status ON runs(profile_id, status);
   CREATE INDEX IF NOT EXISTS idx_runs_profile_area ON runs(profile_id, area);
   CREATE INDEX IF NOT EXISTS idx_items_run ON items(run_id);
   CREATE INDEX IF NOT EXISTS idx_items_profile ON items(profile_id);
   ```
2. Verify no breaking changes with existing data
3. Run tests
4. No frontend changes needed

### Acceptance Criteria:
- [x] Indexes created on app startup (idempotent)
- [x] History and Statistics load faster with 1000+ runs
- [x] No migration issues with existing databases

---

## 5. Player Count Tracking ✅ IMPLEMENTED (PR #23)

**Branch:** `feat/player-count`
**Effort:** ~2-3 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Add `player_count` column to runs table (nullable INTEGER)
2. DB migration in `db.rs`
3. Update Run model (Rust + TypeScript) to include `player_count: Option<i64>` / `number | null`
4. Update `create_run` command to accept `player_count`
5. Add player count selector (1-8) in Run Tracker session start UI
6. Add player count selector in overlay
7. Show player count in History run details
8. Filter statistics by player count (optional dropdown)
9. Add tests
10. Update README

### Acceptance Criteria:
- [x] User can set /players X for each session
- [x] Player count stored per run
- [x] Statistics can be filtered by player count
- [x] Backward compatible (old runs have null)

---

## 6. Session Goals ✅ IMPLEMENTED (PR #25)

**Branch:** `feat/mf-calculator-session-goals`
**Effort:** ~3-4 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Add goal configuration UI to session start screen (before clicking "Start Session")
2. Goal types: run count target, time duration target, or no goal
3. Store goal in component state (not persisted — per session only)
4. Show progress toward goal in timer panel (e.g., "23/50 runs" or "45:00/60:00")
5. Visual indicator when goal reached (color change, message)
6. Optional: sound notification on goal reached (requires audio API)
7. Overlay shows goal progress
8. Add tests
9. Update README

### Acceptance Criteria:
- [x] User can set "50 runs" or "2 hours" goal before starting
- [x] Progress visible during session
- [x] Clear visual feedback when goal is reached
- [x] Session continues after goal (not auto-stopped)

---

## 7. Sound Notifications ✅ IMPLEMENTED (PR #26)

**Branch:** `feat/sound-notifications-streak-tracking`
**Effort:** ~2-3 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Add audio files to `public/sounds/` (milestone.mp3, alert.mp3, item-found.mp3)
2. Create `src/utils/audio.ts` helper with `playSound(name)` function
3. Settings page: toggle sounds on/off, volume slider
4. Trigger points:
   - Run exceeds 2x average time → alert sound
   - Every 10 runs milestone → milestone sound
   - Item added → subtle confirmation sound
   - Goal reached → celebration sound
5. Store sound preferences in localStorage
6. Add tests (mock Audio)
7. Update README

### Acceptance Criteria:
- [x] Sounds play at correct trigger points
- [x] Sounds can be disabled globally
- [x] Volume is configurable
- [x] Doesn't interfere with game audio

---

## 8. Pagination in History

**Branch:** `refactor/history-pagination`
**Effort:** ~2-3 hours
**Dependencies:** Database Indexes (recommended first)

### Tasks:
1. Add `get_runs_paginated` Rust command with `offset` and `limit` params
2. History page: load first 50 runs initially
3. "Load More" button at bottom loads next 50
4. Only load items for expanded runs (lazy — on expand click)
5. Remove the Promise.all that loads ALL items on page load
6. Keep auto-expand behavior but only for the loaded batch
7. Update run count badge to show "showing X of Y"
8. Add tests for pagination behavior
9. Update README if needed

### Acceptance Criteria:
- [ ] History loads in < 500ms even with 5000+ runs
- [ ] "Load More" adds next batch seamlessly
- [ ] Items only fetched when run is expanded
- [ ] Run numbers still calculated correctly across pages

---

## 9. Drop Rate Calculator

**Branch:** `feat/drop-calculator`
**Effort:** ~6-8 hours (complex)
**Dependencies:** None

### Tasks:
1. Research: compile area level data for all D2R areas (TC85, TC87, etc.)
2. Create `src/data/areas.ts` with area metadata (alvl, monster types, TC)
3. Create `src/data/treasure-classes.ts` with basic TC → item mappings
4. Create `src/pages/DropCalculator.tsx` page (or tab in Statistics)
5. UI: select area → show droppable item categories and notable drops
6. Basic probability display (qualitative: Common/Uncommon/Rare/Ultra Rare)
7. MF impact: show how current MF affects chances
8. Add to sidebar navigation
9. Add tests for TC logic
10. Update README

### Acceptance Criteria:
- [ ] User selects an area and sees what can drop there
- [ ] Shows relative rarity of items in that area
- [ ] Accounts for area level restrictions
- [ ] Informative, not necessarily exact (that's Silospen's job)

---

## 10. Streamer Mode / OBS Integration

**Branch:** `feat/obs-integration`
**Effort:** ~2-3 hours
**Dependencies:** None

### Tasks:
1. Add Rust command: `write_obs_stats` that writes current state to a text file
2. File location: `%APPDATA%/com.muh.d2r-desktop/obs_stats.txt`
3. Auto-write every 1 second when session is active
4. File format: configurable (plain text or JSON)
5. Content: run count, session time, last 3 items found, current area
6. Settings toggle: enable/disable OBS mode
7. Show file path in Settings page for easy copy
8. Add tests
9. Update README with OBS setup guide

### Acceptance Criteria:
- [ ] Text file updates live during session
- [ ] OBS can read it as a Text source
- [ ] File is clean and readable
- [ ] No performance impact (async writes)

---

## 11. Multi-Area Route Tracking

**Branch:** `feat/route-tracking`
**Effort:** ~4-5 hours
**Dependencies:** None

### Tasks:
1. Create `routes` table: `id, profile_id, name, areas (JSON array), created_at`
2. Add Rust CRUD commands for routes
3. Create route editor UI (drag to reorder areas in sequence)
4. Run Tracker: "Route Mode" toggle — shows current route step
5. Auto-advance to next area in route on split
6. Route-level statistics (total route time, items per full route cycle)
7. History shows route grouping
8. Add tests
9. Update README

### Acceptance Criteria:
- [ ] User can define a route (e.g., Meph → Pindle → Andy)
- [ ] Run Tracker advances through route steps
- [ ] Statistics show efficiency per complete route cycle
- [ ] Can still use single-area mode

---

## 12. Item Value Estimation

**Branch:** `feat/item-values`
**Effort:** ~3-4 hours
**Dependencies:** None

### Tasks:
1. Create `src/data/item-values.ts` with tier mapping (Worthless/Low/Mid/High/GG)
2. Assign tiers to items in the database (manual curation based on community knowledge)
3. Show tier badge next to items in History and Run Tracker
4. Color code: gray/green/blue/purple/gold
5. Statistics: show total "value" of session (sum of tier points)
6. Filter history by item tier
7. Add tests
8. Update README

### Acceptance Criteria:
- [ ] Each logged item shows a value tier
- [ ] Statistics include value-based metrics
- [ ] Tiers are reasonable for current D2R economy

---

## 13. Dark/Light Theme Toggle

**Branch:** `feat/theme-toggle`
**Effort:** ~1-2 hours
**Dependencies:** None

### Tasks:
1. Refactor CSS variables to support light theme variant
2. Create `src/hooks/useTheme.ts` with localStorage persistence
3. Add theme toggle button in sidebar (🌙/☀️)
4. Define light theme colors (swap backgrounds, text colors)
5. Overlay respects current theme
6. Add tests
7. Update README

### Acceptance Criteria:
- [ ] Toggle switches between dark and light
- [ ] Preference persists across restarts
- [ ] All pages look correct in both themes
- [ ] Overlay adapts to theme

---

## 14. Custom Area List

**Branch:** `feat/custom-areas`
**Effort:** ~2 hours
**Dependencies:** None

### Tasks:
1. Create `custom_areas` table: `id, profile_id, name, created_at`
2. Add Rust CRUD commands
3. Merge custom areas with default AREAS list in frontend
4. "Add custom area" input at bottom of area selector
5. Delete custom areas from Settings or inline
6. Persist per profile
7. Add tests
8. Update README

### Acceptance Criteria:
- [ ] User can add any area name
- [ ] Custom areas appear in all area selectors
- [ ] Can be deleted
- [ ] Don't interfere with default areas

---

## 15. Run Streak Tracking ✅ IMPLEMENTED (PR #26)

**Branch:** `feat/sound-notifications-streak-tracking`
**Effort:** ~2-3 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Compute streaks from existing data (runs without items = dry streak)
2. Add streak display to Run Tracker timer panel
3. Show in Statistics: longest drought, best streak, current streak
4. Per-area streak tracking
5. Optional: notification when breaking personal record
6. Add tests for streak calculation logic
7. Update README

### Acceptance Criteria:
- [x] Shows current dry streak during session
- [x] Statistics page shows all-time streak records
- [x] Streaks calculated from existing run/item data
- [x] Per-area breakdown available

---

## Sprint Planning Template

Each feature should follow this workflow:

```
1. git checkout main && git pull origin main
2. git checkout -b feat/feature-name
3. Implement backend changes (models, commands, migrations)
4. Implement frontend changes (pages, components)
5. Write tests
6. npm test && npx tsc --noEmit && cargo check && npx vite build
7. git add -A && git commit -m "feat: description"
8. git push -u origin feat/feature-name
9. gh pr create --title "feat: description" --body "..." --base main
10. git checkout main
11. After merge: update README download links if releasing
```

---

## Version Planning

| Version | Features | Status |
|---------|----------|--------|
| v1.0.0 | Global Hotkeys + DB Indexes + Player Count | ✅ Released |
| v1.1.0 | MF Calculator + Session Goals | ✅ Released |
| v1.2.0 | Sound Notifications + Streak Tracking | ✅ Released |
| v1.3.0 | History Pagination + Custom Areas | Planned |
| v1.4.0 | Drop Calculator | Planned |
| v2.0.0 | Route Tracking + OBS Integration + Comparison Mode | Planned |

---

*Document created: June 2026*
