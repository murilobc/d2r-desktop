# D2R Tracker — Feature Suggestions & Improvement Ideas

Based on analysis of the D2R community, existing tools (Silospen Drop Calculator, oskros MF_run_counter, diablo2.io Holy Grail Tracker, d2rdecoded.com, maxroll.gg farming guides, terrorzonetracker.com), game mechanics (v3.2 Reign of the Warlock), and current application state.

**Last updated:** June 2026

---

## Implementation Status

Features that have already been implemented:

| # | Feature | Status |
|---|---------|--------|
| 1 | Holy Grail Tracker | ❌ Cancelled (in-game Chronicle added in RotW) |
| 2 | Global Hotkeys | ✅ PR #21 |
| 3 | MF Effective Calculator | ✅ PR #25 |
| 4 | Drop Rate Calculator | ✅ PR #28 |
| 5 | Sound Notifications | ✅ PR #26 |
| 6 | Player Count Tracking | ✅ PR #23 |
| 7 | Session Goals | ✅ PR #25 |
| 8 | Database Indexes | ✅ PR #22 |
| 9 | Pagination in History | ✅ PR #27 |
| 10 | OBS Integration / Streamer Mode | ✅ PR #34 |
| 11 | Multi-Area Route Tracking | ✅ PR #35 |
| 12 | Item Value Estimation | ✅ PR #36 |
| 13 | Comparison Mode | ✅ PR #35 |
| 14 | Custom Area List | ✅ PR #27 |
| 15 | Run Streak Tracking | ✅ PR #26 |
| 16 | Dark/Light Theme Toggle | 🔲 Planned |

---

## Remaining Planned Feature

### 1. Dark/Light Theme Toggle
Currently only dark theme. Some users prefer light themes for daytime use.

**Why:** Accessibility and preference. Low effort, high polish.

**Implementation:**
- Refactor CSS variables to support light theme variant
- Create `src/hooks/useTheme.ts` with localStorage persistence
- Add theme toggle button in sidebar (🌙/☀️)
- Overlay respects current theme

---

## New Feature Suggestions (v3.2 RotW Era)

Based on research from maxroll.gg, diablo2.io, terrorzonetracker.com, icy-veins.com, and community feedback from d2jsp forums and Reddit.

---

### 2. Terror Zone Integration

Track which Terror Zone is active and plan farming sessions around it.

**Why:** Terror Zones rotate every hour and dramatically change optimal farming. The community uses external trackers (terrorzonetracker.com, d2emu.com/tz-sp). Having it integrated saves alt-tabbing.

**Implementation:**
- Display current Terror Zone (fetched from community API or manual selection)
- For Single Player: use the predictable TZ calendar (deterministic per game session)
- TZ-aware run tracking: auto-tag runs as "terrorized" or "normal"
- Statistics filtered by TZ vs non-TZ runs (compare efficiency)
- Notification when a preferred Terror Zone becomes active
- TZ tier list display (S/A/B/C based on community consensus for XP and items)

**Data sources:**
- [terrorzonetracker.com](https://terrorzonetracker.com/) community API
- [d2emu.com/tz-sp](https://d2emu.com/tz-sp) single player calendar
- [maxroll.gg/d2/resources/terror-zones](https://maxroll.gg/d2/resources/terror-zones) tier rankings

---

### 3. Herald Tracking (RotW Exclusive)

Track Herald encounters, tier progression, and Sunder Charm farming progress.

**Why:** Heralds of Terror are D2R v3.0+ endgame content that spawns in Terror Zones with 5 progressive difficulty tiers. They're the primary source of Latent/Renewed Sunder Charms. Tracking progress is essential for endgame farmers.

**Implementation:**
- Herald encounter log: tier defeated, time, area, drops
- Tier progression tracker: show current tier (1-5), kills needed for next tier
- Sunder Charm collection checklist (6 elements × 2 types = 12 total)
- Statistics: average time per Herald, success rate by tier, drops per encounter
- Integration with Route Tracking: mark routes as "Herald farming routes"

**References:**
- Heralds spawn in Terror Zones only, scale through 5 tiers
- After Patch 3.2: mostly blue drops with smaller chance at uniques/sets
- Latent Sunder Charms are the main chase item

---

### 4. Colossal Ancients Progress Tracker

Track statue collection and Colossal Ancients encounter attempts.

**Why:** Colossal Ancients (v3.0+) are D2R's new uber-boss encounter requiring 5 statues from act bosses in Terror Zones. The farming loop (statues → portal → fight) is complex and benefits from tracking.

**Implementation:**
- Statue collection checklist (5 act bosses: Andariel, Duriel, Mephisto, Diablo, Baal)
- Track which statues are currently held and which are needed
- Colossal Ancients encounter log: attempt time, success/fail, drops
- Per-encounter statistics: average fight duration, success rate
- Tips: best areas for each statue based on community data

**References:**
- Statues drop from terrorized act bosses only
- After Patch 3.2: 75% magic resistance on Colossals, harder fight
- Drops include unique Colossal Ancient jewels and high-tier items

---

### 5. Diablo Clone Progress Tracker

Track DClone walk progress and SoJ sales across regions.

**Why:** Diablo Clone spawning requires community coordination (selling Stones of Jordan). diablo2.io tracks this but having it integrated means knowing when to be online without alt-tabbing.

**Implementation:**
- Display current DClone progress per region/mode (from diablo2.io API)
- Notification when progress reaches threshold (e.g., 5/6 or 6/6)
- Log DClone kills: character used, Annihilus stats received
- Annihilus collection tracker (one per character)

**Data source:** [diablo2.io DClone Tracker API](https://diablo2.io/dclonetracker.php)

---

### 6. Experience Rate Tracking

Track experience per hour alongside items to optimize leveling sessions.

**Why:** Many players alternate between item farming and XP farming (especially for levels 95-99). Tracking XP/hour per area helps decide where to level. Sites like d2r-tools.com provide calculators but not session tracking.

**Implementation:**
- Optional XP input per session (manual entry: start level/XP → end level/XP)
- Calculate XP/hour, XP/run, estimated time to next level
- Compare XP rates between areas and Terror Zone states
- Integration with Comparison Mode: add XP/hour as a metric
- Level 99 progress tracker (total XP needed, % remaining)

**Reference:** [D2R Experience Calculator](https://exp-calculator.d2r-tools.com/)

---

### 7. Grimoire Tracking (Warlock Class - RotW)

Track Grimoire (off-hand) drops for the Warlock class introduced in Reign of the Warlock.

**Why:** Grimoires are a new item category in v3.0 specific to the Warlock class. The existing item database and value tiers need to properly support them for Warlock players.

**Implementation:**
- Ensure all Grimoire bases and uniques are in `src/data/items.ts`
- Add "Grimoire" as an item subcategory
- Value tiers for Grimoire items (Blasphemous Grimoire eth base = High tier, etc.)
- Drop Calculator: show Grimoire drop locations
- Filter items by Grimoire in History

---

### 8. Session Replay / Timeline

Visual timeline of a session showing key events (items found, splits, pauses) on a time axis.

**Why:** Streamers and content creators want to review sessions visually. Shows patterns like "items tend to drop in clusters" or "long droughts mid-session."

**Implementation:**
- Timeline visualization (horizontal bar with markers) for each session
- Events: run splits (tick marks), items found (colored dots by tier), pauses (gray zones)
- Zoom in/out on timeline
- Click an event to see details
- Export timeline as image for social media/stream recap
- Built with Recharts or custom SVG

---

### 9. Shared/Co-op Tracking

Allow multiple users to contribute to a shared run counter (for group farming).

**Why:** Many players farm in groups. Currently each player would need their own tracker. Shared tracking lets a party see combined stats.

**Implementation:**
- "Shared Session" mode: generate a session code
- Other D2R Tracker instances join via code (local network or WebSocket)
- Combined view: total items from all party members, combined run count
- Per-player breakdown within shared session
- Requires network plugin (could use Tauri's networking or a simple local relay)

**Complexity:** High — requires networking. Could start with simple file-based sync (shared folder) or limit to same-machine multiple instances.

---

### 10. Run Notes / Quick Tags

Add quick contextual notes or tags to runs during a session.

**Why:** Context helps when reviewing history. "Good density", "bad map", "crashed" are common annotations that help understand outlier runs.

**Implementation:**
- Quick-tag buttons in overlay and main window: "GG Map", "Bad Map", "Crash", custom tags
- Tags stored per run in database (new column or JSON)
- Filter History by tags
- Tag statistics: "What % of my Pit runs had 'good density'?"
- Custom tag management in Settings

---

### 11. Keybind Profiles

Save and switch between different hotkey configurations for different characters/activities.

**Why:** A player might want different hotkeys when running Mephisto (fast splits) vs Chaos Sanctuary (need pause for Seal pops) vs while streaming (different OBS integration toggles).

**Implementation:**
- Multiple named hotkey profiles stored in localStorage
- Quick-switch dropdown in Settings or sidebar
- Auto-load profile when selecting a character profile (optional link)
- Default profile always available

---

### 12. Backup Scheduler

Automatic periodic backup of the SQLite database to a configured location.

**Why:** Data loss from crashes, Windows updates, or accidental deletion is a real concern for users with months of farming data. Currently requires manual Export.

**Implementation:**
- Settings: configure backup folder path and frequency (daily, weekly, per-session)
- Auto-export JSON backup to configured folder on schedule
- Keep last N backups (configurable, default: 5)
- Show last backup date/time in Settings
- Use Tauri's fs plugin to write to user-chosen directory

---

### 13. Widget Mode (Minimal UI)

A compact "widget" view showing only key stats (run count, time, last item) — smaller than the full overlay but more customizable.

**Why:** Some players want persistent stats visible but the full overlay is too large. A tiny widget (like a taskbar widget) with just numbers would be ideal.

**Implementation:**
- New window mode: ultra-compact (e.g., 200×60px)
- Shows: run count, session time, last item found
- Always on top, no chrome, transparent background
- Configurable which stats to show
- Position remembered between sessions

---

## Data & Technical Improvements

### 14. Data Sync (Optional Cloud)
Optional sync to a cloud service for multi-device access.

**Why:** Some players use multiple PCs. Current export/import works but is manual.

**Implementation:**
- Optional GitHub Gist sync (user provides token)
- Or simple file sync to Dropbox/OneDrive folder
- Low priority since export/import covers the use case

---

### 15. Performance Profiling / Large Dataset Handling

Optimize for users with 10,000+ runs and 5,000+ items.

**Why:** Power users who have been farming for months accumulate massive datasets. Query performance and UI rendering need to scale.

**Implementation:**
- Add database VACUUM command (triggered from Settings or on app start)
- Lazy-render long lists with virtual scrolling (react-virtual)
- Batch statistics computation for very large datasets
- Profile SQLite queries with EXPLAIN QUERY PLAN

---

### 16. Localization (i18n)

Add support for multiple languages beyond English.

**Why:** D2R has a global player base. Portuguese (Brazil), Spanish, German, French, and Korean are the most common secondary languages in the D2R community.

**Implementation:**
- Extract all UI strings to a translation file (JSON)
- Language selector in Settings
- Start with: English, Portuguese (BR), Spanish
- Community contribution model for additional languages

---

## Competitive Analysis Summary (Updated June 2026)

| Feature | D2R Tracker (ours) | oskros MF_counter | diablo2.io | Silospen | maxroll.gg |
|---------|-------------------|-------------------|------------|----------|------------|
| Run timer | ✅ | ✅ | ❌ | ❌ | ❌ |
| Session tracking | ✅ | ✅ | ❌ | ❌ | ❌ |
| Item logging | ✅ (searchable DB) | ✅ (manual) | ❌ | ❌ | ❌ |
| Holy Grail | ❌ (in-game now) | ✅ | ✅ | ❌ | ✅ |
| Drop calculator | ✅ | ❌ | ❌ | ✅ | ✅ |
| Global hotkeys | ✅ | ✅ | N/A | N/A | N/A |
| In-game overlay | ✅ | ✅ | N/A | N/A | N/A |
| Statistics/Charts | ✅ (Recharts) | Basic | Basic | ❌ | ❌ |
| PDF export | ✅ | ❌ | ❌ | ❌ | ❌ |
| Auto-update | ✅ | ❌ | N/A | N/A | N/A |
| Offline | ✅ | ✅ | ❌ | ❌ | ❌ |
| MF calculator | ✅ | ❌ | ❌ | Partial | ✅ |
| Player count | ✅ | ❌ | ❌ | ✅ | ❌ |
| Sound alerts | ✅ | ✅ | ❌ | ❌ | ❌ |
| OBS integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Route tracking | ✅ | ❌ | ❌ | ❌ | ❌ |
| Item value tiers | ✅ | ❌ | ✅ (price check) | ❌ | ✅ (value guide) |
| Comparison mode | ✅ | ❌ | ❌ | ❌ | ❌ |
| Terror Zone tracking | ❌ | ❌ | ✅ | ❌ | ✅ |
| DClone tracking | ❌ | ❌ | ✅ | ❌ | ❌ |
| Herald tracking | ❌ | ❌ | ❌ | ❌ | ❌ |
| XP tracking | ❌ | ❌ | ❌ | ❌ | ✅ (calc) |

---

## Recommended Implementation Order (Next Phase)

1. **Dark/Light Theme Toggle** — Low effort, high polish, accessibility
2. **Terror Zone Integration** — High community demand, differentiator
3. **Herald Tracking** — Unique to RotW era, no competing tool does this
4. **Colossal Ancients Progress** — Endgame content tracking
5. **Run Notes / Quick Tags** — Low effort, QoL improvement
6. **Session Replay / Timeline** — Visual appeal for streamers
7. **DClone Progress Tracker** — Community integration
8. **Backup Scheduler** — Data safety automation
9. **Experience Rate Tracking** — Completes the leveling use case
10. **Everything else** — Based on community feedback

---

*Document updated: June 2026*
*Based on: D2R v3.2 (Reign of the Warlock, Season 14), community tools analysis, and game mechanics research*
*Sources: maxroll.gg, diablo2.io, terrorzonetracker.com, icy-veins.com, d2jsp.org, rpgstash.com*
