# D2R Tracker — Development Plan v2.1–v4.0

Continuation of the development roadmap. All features from v1.0–v2.0 are implemented and released.
This document covers the next 16 features across versions 2.1 through 4.0.

Task breakdown for each feature. Each feature = one branch + one PR.

---

## 1. Dark/Light Theme Toggle ✅ IMPLEMENTED (PR #47)

**Branch:** `feat/v2.1-theme-tags`
**Effort:** ~1-2 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Audit `App.css` and `overlay.css` — extract all color values into CSS custom properties (`:root` level)
2. Define two color schemes: `[data-theme="dark"]` (current look) and `[data-theme="light"]`
3. Create `src/hooks/useTheme.ts` — reads/writes `localStorage("d2r-theme")`, applies `data-theme` attribute to `<html>`
4. Add theme toggle button to sidebar footer (🌙/☀️ icon swap)
5. Ensure overlay window reads theme from `localStorage` on mount and applies the same attribute
6. Verify all pages render correctly in light mode (contrast, readability, chart colors in Recharts)
7. Add unit test for `useTheme` hook (toggle, persistence, default)
8. Update README with theme toggle mention

### Acceptance Criteria:
- [x] Toggle switches between dark and light themes instantly
- [x] Preference persists across app restarts via localStorage
- [x] All pages and components render correctly in both themes
- [x] Overlay window adapts to the selected theme

---

## 2. Run Notes / Quick Tags ✅ IMPLEMENTED (PR #47)

**Branch:** `feat/v2.1-theme-tags`
**Effort:** ~2-3 hours
**Dependencies:** None (benefits from existing `notes` field on Run model)
**Status:** Merged

### Tasks:
1. Add `tags` column to `runs` table (`TEXT`, JSON array stored as string, nullable)
2. DB migration in `db.rs`: `ALTER TABLE runs ADD COLUMN tags TEXT DEFAULT NULL`
3. Update `Run` model (Rust struct + TypeScript interface) to include `tags: string[] | null`
4. Update `create_run` and `finish_run` commands to accept/persist tags
5. Create `src/components/QuickTags.tsx` — row of predefined tag buttons (e.g., "🔥 GG Drop", "💀 Death", "⚡ Fast", "🐢 Slow", "🎯 Target Found", "📝 Custom")
6. Integrate QuickTags into RunTracker session panel and overlay action bar
7. History page: add tag filter dropdown (multi-select, filter runs by tag)
8. Statistics page: optional breakdown by tag
9. Add tests for tag persistence and filtering
10. Update README

### Acceptance Criteria:
- [x] User can tag runs with one or more quick-tag buttons during a session
- [x] Tags are stored per run and visible in History
- [x] History can be filtered by one or multiple tags
- [x] Custom tags can be typed in addition to predefined buttons
- [x] Overlay supports tagging without leaving the game

---

## 3. Terror Zone Integration ✅ IMPLEMENTED (PR #55)

**Branch:** `feat/v2.2-tz-heralds`
**Effort:** ~4-5 hours
**Dependencies:** Run Notes / Quick Tags (#2 — for TZ-aware tagging)
**Status:** Merged

### Tasks:
1. Research TZ rotation schedule data source (community API or static rotation JSON)
2. Create `src/data/terror-zones.ts` with TZ rotation data and area-to-TZ mappings
3. Create `src/components/TerrorZoneDisplay.tsx` — shows currently active TZ with countdown to next rotation
4. Add TZ display widget to RunTracker page header
5. Settings page: configure "preferred TZ" list (areas user wants notifications for)
6. Notification system: trigger sound + system notification when a preferred TZ becomes active
7. Auto-tag runs with "Terror Zone" when the selected area matches active TZ
8. Statistics: add TZ vs Normal comparison view (items/hour in TZ vs same area non-TZ)
9. Add tests for TZ rotation logic and notification triggers
10. Update README with TZ feature documentation

### Acceptance Criteria:
- [x] Active Terror Zone displayed in RunTracker with time remaining
- [x] User receives notification when a preferred TZ activates
- [x] Runs are auto-tagged as TZ when area matches active Terror Zone
- [x] Statistics compare TZ performance vs normal runs
- [x] TZ data can be updated without app rebuild (JSON config)

---

## 4. Herald Tracking ✅ IMPLEMENTED (PR #55)

**Branch:** `feat/v2.2-tz-heralds`
**Effort:** ~3-4 hours
**Dependencies:** None
**Status:** Merged

### Tasks:
1. Create `herald_encounters` table: `id, profile_id, tier (1-5), area, result (success/fail), sunder_charm TEXT NULL, notes, encountered_at`
2. Add Rust CRUD commands: `create_herald_encounter`, `get_herald_encounters`, `delete_herald_encounter`
3. Create `src/pages/HeraldTracker.tsx` page with encounter log form
4. Tier 1-5 progression display (visual progress bar or tier badges)
5. Sunder Charm collection checklist (Cold, Fire, Lightning, Physical, Poison, Magic — track which ones found)
6. Stats panel: encounters per tier, success rate, average attempts per tier
7. Add "⚔️ Heralds" nav item to sidebar
8. Add tests for herald stats calculations
9. Update README

### Acceptance Criteria:
- [x] User can log Herald encounters with tier, area, and result
- [x] Sunder Charm collection checklist tracks which charms have been found
- [x] Statistics show success rate and progression per tier
- [x] Herald data is per-profile

---

## 5. Colossal Ancients Progress Tracker

**Branch:** `feat/colossal-ancients`
**Effort:** ~2-3 hours
**Dependencies:** None

### Tasks:
1. Create `colossal_ancients` table: `id, profile_id, boss_name, attempt_number, result (success/fail), drops TEXT NULL, duration_secs, attempted_at`
2. Define the 5 boss statues as constants: `["Baal", "Diablo", "Mephisto", "Duriel", "Andariel"]`
3. Add Rust CRUD commands: `create_ancient_attempt`, `get_ancient_attempts`, `get_ancient_stats`
4. Create `src/components/ColossalAncients.tsx` — statue collection grid (5 bosses, checkmark when defeated)
5. Attempt log per boss: success/fail history, total attempts, best time
6. Drops section: notable drops from Colossal encounters
7. Integrate into Statistics page as a dedicated tab or section
8. Add tests
9. Update README

### Acceptance Criteria:
- [ ] User can log attempts against each Colossal Ancient (success/fail + drops)
- [ ] Visual grid shows which bosses have been defeated
- [ ] Per-boss statistics: attempts, success rate, best time
- [ ] Drops from Colossal encounters are tracked separately

---

## 6. Diablo Clone Progress Tracker

**Branch:** `feat/dclone-tracker`
**Effort:** ~2-3 hours
**Dependencies:** None

### Tasks:
1. Research diablo2.io DClone API endpoint (or community equivalent for progress data)
2. Create `src/services/dclone.ts` — fetch DClone progress per region (Americas, Europe, Asia) with polling interval
3. Create `src/components/DCloneTracker.tsx` — progress bars (1-6) per region with refresh button
4. Settings: configure preferred region, notification threshold (e.g., notify at progress 5+)
5. Notification: sound + system notification when preferred region reaches threshold
6. Create `anni_log` table: `id, profile_id, stats TEXT, obtained_at, notes`
7. Anni collection log: track Annihilus charms obtained with stats
8. Add tests (mock API responses)
9. Update README

### Acceptance Criteria:
- [ ] DClone progress displayed per region with auto-refresh
- [ ] User receives notification when progress reaches configured threshold
- [ ] Annihilus charm log tracks obtained charms
- [ ] Graceful handling when API is unavailable (cached last known state)
- [ ] Polling interval is configurable (default: 5 minutes)

---

## 7. Experience Rate Tracking

**Branch:** `feat/xp-tracking`
**Effort:** ~3-4 hours
**Dependencies:** None (integrates with existing Run/Stats system)

### Tasks:
1. Add `xp_gained` column to `runs` table (`BIGINT`, nullable) — user inputs XP manually per session
2. DB migration in `db.rs`
3. Update Run model (Rust + TypeScript) to include `xp_gained: number | null`
4. Create `src/data/xp-table.ts` — D2R XP requirements per level (1-99)
5. Create `src/components/XPTracker.tsx` — input current level + XP, shows XP/hour rate
6. Calculate: XP/hour based on session duration, estimated time to next level
7. Comparison integration: XP/hour by area, by player count
8. Statistics page: XP rate trends over sessions (Recharts line graph)
9. Add tests for XP calculations and time-to-level estimates
10. Update README

### Acceptance Criteria:
- [ ] User can optionally input XP gained per session
- [ ] XP/hour rate calculated and displayed during active session
- [ ] Time-to-next-level estimate shown based on current rate
- [ ] XP trends visible in Statistics over multiple sessions
- [ ] Fully optional — doesn't affect users who don't track XP

---

## 8. Session Replay / Timeline

**Branch:** `feat/session-timeline`
**Effort:** ~3-4 hours
**Dependencies:** None (reads existing run + item data)

### Tasks:
1. Create `src/components/SessionTimeline.tsx` — horizontal scrollable timeline component
2. Plot events on timeline: session start, items found (with rarity color), splits, pauses, session end
3. Timestamp markers at regular intervals (every 5 min or every run)
4. Click event on timeline to show detail popover (item name, run area, time offset)
5. Zoom controls: zoom in/out on timeline, drag to pan
6. Export as image: use `html2canvas` or SVG export to save timeline as PNG
7. Integrate into History page — "View Timeline" button per session
8. Add tests for timeline data transformation logic
9. Update README

### Acceptance Criteria:
- [ ] Horizontal timeline visualizes all session events chronologically
- [ ] Clicking an event shows details (item, area, timestamp)
- [ ] Timeline can be exported as a PNG image
- [ ] Works correctly for sessions with 100+ events
- [ ] Responsive — handles short (5 min) and long (4 hour) sessions

---

## 9. Widget Mode

**Branch:** `feat/widget-mode`
**Effort:** ~2 hours
**Dependencies:** None (independent from full overlay)

### Tasks:
1. Create `widget.html` entry point (minimal HTML shell)
2. Create `src/widget/Widget.tsx` — ultra-compact display (200x60px target)
3. Create `src/widget/main.tsx` — widget React entry point
4. Configure Tauri: register `widget` window in `tauri.conf.json` (always-on-top, frameless, transparent background, skip-taskbar)
5. Settings page: configure which stats to show in widget (run count, session time, items found — pick 2-3)
6. Widget listens to same events as overlay (run splits, items) to stay updated
7. Add "Widget" toggle button in sidebar (separate from Overlay toggle)
8. Add tests for widget stat rendering

### Acceptance Criteria:
- [ ] Widget window is ultra-compact (~200x60px), always-on-top, frameless
- [ ] User can configure which 2-3 stats are displayed
- [ ] Widget updates in real-time during active sessions
- [ ] Widget is independent from the full overlay (can use both or either)

---

## 10. Keybind Profiles

**Branch:** `feat/keybind-profiles`
**Effort:** ~1-2 hours
**Dependencies:** None (extends existing Settings/hotkey system)

### Tasks:
1. Create `keybind_profiles` table: `id, name, bindings TEXT (JSON), created_at`
2. Add Rust CRUD commands: `create_keybind_profile`, `get_keybind_profiles`, `update_keybind_profile`, `delete_keybind_profile`
3. Settings page: add "Keybind Profiles" section with list, create, rename, delete
4. Each profile stores the full hotkey mapping (start/split/pause/end keys)
5. Quick-switch dropdown in Settings to activate a keybind profile
6. Optional: associate a keybind profile with a character profile (auto-load on profile select)
7. Re-register global shortcuts when switching keybind profile
8. Add tests

### Acceptance Criteria:
- [ ] User can create multiple named keybind configurations
- [ ] Quick-switch between keybind profiles from Settings
- [ ] Optional auto-load keybind profile when selecting a character profile
- [ ] Switching profiles immediately re-registers the global shortcuts

---

## 11. Backup Scheduler

**Branch:** `feat/backup-scheduler`
**Effort:** ~2 hours
**Dependencies:** None (extends existing export functionality)

### Tasks:
1. Settings page: add "Auto Backup" section with folder picker (Tauri native dialog)
2. Configure backup schedule: daily, weekly, or every N sessions
3. Store config in `localStorage` or SQLite `user_preferences` table
4. Create Rust command `run_auto_backup` — exports full JSON to configured folder with timestamp filename
5. Implement backup rotation: keep last N backups (configurable, default 10), delete oldest
6. Trigger check on app startup and after each session end
7. Show last backup timestamp and folder path in Settings
8. Add tests for rotation logic
9. Update README

### Acceptance Criteria:
- [ ] Auto-export JSON backup to configured folder on schedule
- [ ] Old backups rotated (keeps last N, deletes oldest)
- [ ] Backup runs silently without interrupting workflow
- [ ] User can see last backup time and manually trigger a backup
- [ ] Graceful failure if folder is inaccessible (log warning, don't crash)

---

## 12. Grimoire Tracking

**Branch:** `feat/grimoire-tracking`
**Effort:** ~1 hour
**Dependencies:** None (extends existing item database)

### Tasks:
1. Audit `src/data/items.ts` — ensure all Warlock Grimoire items are present (cross-reference D2R v3.2 patch notes)
2. Add `subcategory` field to item entries where applicable (value: `"Grimoire"`)
3. Add "Grimoire" to `ITEM_TYPES` constant in `types.ts`
4. Create value tiers for Grimoire items in `src/data/item-values.ts` (Low/Mid/High/GG)
5. Drop Calculator: ensure Grimoire items appear for relevant areas
6. History/Statistics: Grimoire items filterable as a subcategory
7. Add tests verifying Grimoire items are in DB with correct tiers

### Acceptance Criteria:
- [ ] All Warlock Grimoire items present in the item database
- [ ] Grimoire items have value tiers assigned
- [ ] Grimoire appears as a filterable subcategory in History and Statistics
- [ ] Drop Calculator shows Grimoire items for applicable areas

---

## 13. Shared/Co-op Tracking

**Branch:** `feat/coop-tracking`
**Effort:** ~5-6 hours
**Dependencies:** None (but benefits from Player Count tracking already implemented)

### Tasks:
1. Design session sharing protocol: generate unique session code (6-char alphanumeric)
2. Create `src/services/sync.ts` — local network discovery using mDNS or manual IP entry
3. Implement WebSocket-based local sync: one host, N guests join by code/IP
4. Shared session state: all participants see combined run count, item log, timer
5. Per-player breakdown: track which player found which items
6. Create `src/components/CoopPanel.tsx` — host/join UI, connected players list, combined stats
7. Host controls: only host can start/split/end; guests can log items
8. Handle disconnections gracefully (reconnect, or continue solo)
9. Add tests for sync protocol and state merging
10. Update README with co-op setup guide

### Acceptance Criteria:
- [ ] Host can create a session with a shareable code
- [ ] Guests on the same local network can join and see live stats
- [ ] Combined stats view shows totals across all players
- [ ] Per-player item breakdown available
- [ ] Graceful handling of disconnections (no data loss)

---

## 14. Data Sync (Cloud)

**Branch:** `feat/cloud-sync`
**Effort:** ~4-5 hours
**Dependencies:** None

### Tasks:
1. Design sync format: versioned JSON with timestamps per record for conflict detection
2. Implement GitHub Gist sync option: create/update a private Gist with app data
3. Settings: GitHub token input (stored securely in OS keychain via Tauri), Gist ID configuration
4. Alternative: local folder sync (e.g., Dropbox/OneDrive folder — just export to a synced path)
5. Conflict resolution strategy: last-write-wins with merge for non-conflicting records
6. Create `src/services/cloud-sync.ts` — sync engine with push/pull/merge logic
7. UI: sync status indicator in sidebar footer, manual sync button, last sync timestamp
8. Auto-sync on app close (configurable)
9. Add tests for conflict resolution and merge logic
10. Update README with sync setup guide

### Acceptance Criteria:
- [ ] User can sync data to a GitHub Gist (private) or local synced folder
- [ ] Conflict resolution handles concurrent edits without data loss
- [ ] Sync status visible in UI (last synced, sync errors)
- [ ] Credentials stored securely (OS keychain, not localStorage)
- [ ] Fully optional — app works 100% offline without sync configured

---

## 15. Performance Profiling

**Branch:** `refactor/performance`
**Effort:** ~2-3 hours
**Dependencies:** None

### Tasks:
1. Implement virtual scrolling in History page for 10k+ runs (use `react-window` or custom virtualization)
2. Add `VACUUM` command option in Settings (manual trigger to compact SQLite DB)
3. Batch statistics queries: replace multiple sequential queries with combined SQL for stats page
4. Profile render performance: identify and memoize expensive components (`React.memo`, `useMemo`)
5. Add Rust-side query benchmarks for 10k, 50k, 100k row datasets
6. Lazy-load pages with `React.lazy` + `Suspense` for initial load improvement
7. Add loading skeletons for async data fetches
8. Document performance characteristics in README

### Acceptance Criteria:
- [ ] History page scrolls smoothly with 10,000+ runs (no DOM bloat)
- [ ] Statistics page loads in < 1 second with 50k+ runs
- [ ] VACUUM command available for manual DB maintenance
- [ ] No regressions in functionality after optimizations

---

## 16. Localization (i18n)

**Branch:** `feat/i18n`
**Effort:** ~3-4 hours
**Dependencies:** None (but should be done after all UI features are stable)

### Tasks:
1. Install `react-i18next` and `i18next` packages
2. Create `src/i18n/` directory with `index.ts` setup and namespace structure
3. Extract all UI strings from components into translation JSON files (`en-US.json` as base)
4. Create `pt-BR.json` translation file (Portuguese - Brazil)
5. Create `es.json` translation file (Spanish)
6. Add language selector dropdown in Settings page
7. Store language preference in localStorage, load on app init
8. Ensure date/number formatting respects selected locale
9. Add tests verifying translation key completeness across languages
10. Update README with contribution guide for translations

### Acceptance Criteria:
- [ ] All UI strings extracted and rendered via i18n system
- [ ] Language selector in Settings switches the entire UI
- [ ] PT-BR and ES translations complete and functional
- [ ] Date and number formatting adapts to locale
- [ ] Adding a new language requires only a new JSON file (no code changes)

---

## Sprint Planning Template

Each feature should follow this workflow:

```
1. git checkout main && git pull origin main
2. git checkout -b feat/feature-name
3. Implement backend changes (models, commands, migrations)
4. Implement frontend changes (pages, components)
5. Write tests
6. npm test && npx tsc --noEmit && cd src-tauri && cargo check && cd .. && npx vite build
7. git add -A && git commit -m "feat: description"
8. git push -u origin feat/feature-name
9. gh pr create --title "feat: description" --body "..." --base main
10. git checkout main
11. After merge: update README download links if releasing
```

---

## Version Planning

| Version | Features | Effort (est.) | Status |
|---------|----------|---------------|--------|
| v2.1.0 | Dark/Light Theme Toggle + Run Notes/Quick Tags | ~3-5h | ✅ Released |
| v2.2.0 | Terror Zone Integration + Herald Tracking | ~7-9h | ✅ Released |
| v3.0.0 | Colossal Ancients + Diablo Clone Tracker + XP Tracking | ~7-10h | 🔲 Planned |
| v3.1.0 | Session Timeline + Widget Mode | ~5-6h | 🔲 Planned |
| v3.2.0 | Keybind Profiles + Backup Scheduler + Grimoire Tracking | ~4-5h | 🔲 Planned |
| v3.3.0 | Shared/Co-op Tracking | ~5-6h | 🔲 Planned |
| v4.0.0 | Data Sync (Cloud) + Performance Profiling + Localization | ~9-12h | 🔲 Planned |

---

## Dependency Graph

```
(no deps)──┬── #1 Theme Toggle
            ├── #4 Herald Tracking
            ├── #5 Colossal Ancients
            ├── #6 DClone Tracker
            ├── #7 XP Tracking
            ├── #8 Session Timeline
            ├── #9 Widget Mode
            ├── #10 Keybind Profiles
            ├── #11 Backup Scheduler
            ├── #12 Grimoire Tracking
            ├── #13 Co-op Tracking
            ├── #14 Cloud Sync
            ├── #15 Performance
            └── #16 i18n

#2 Run Tags ──── #3 Terror Zones (TZ-aware tagging uses tag system)
```

Most features are independent and can be developed in parallel. The only hard dependency is that Terror Zone Integration (#3) benefits from Run Notes/Quick Tags (#2) being implemented first for TZ-aware auto-tagging.

---

## Priority Notes

- **v2.1** focuses on low-effort polish that improves daily usability
- **v2.2** adds the most-requested RotW (Reign of the Warlock) season content
- **v3.0** targets endgame tracking that hardcore players want
- **v3.1** adds visual flair and streaming utility
- **v3.2** is power-user quality of life
- **v3.3** is the first multiplayer feature (highest complexity)
- **v4.0** is technical infrastructure for long-term scale

---

*Document created: June 2025*
*Covers: v2.1.0 through v4.0.0*
*Previous plan: see DEVELOPMENT_PLAN.md (v1.0–v2.0, all implemented)*
