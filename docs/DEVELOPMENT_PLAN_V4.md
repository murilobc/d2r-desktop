# D2R Tracker — Development Plan v5.1+

Continuation of the roadmap. All features from v1.0–v5.0 are implemented and released.
This document covers the next wave of features based on community research, competitive analysis, and D2R v3.2 Season 14 meta.

**Last updated:** July 2026
**Sources:** maxroll.gg, icy-veins.com, diablo2.io, dropcalc.silospen.com, d2rdecoded.com, d2runes.io, reddit r/diablo2, d2jsp, Blizzard patch notes, competing tools (oskros MF_counter, d2r-arcane-tracker, horadricvault.com, D2R-AI-Item-Tracker)

---

## Executive Summary

The app already covers core farming tracking comprehensively. The next phase focuses on:
1. **Smarter data** — probability-based insights, not just raw logging
2. **Automation** — reduce manual input friction
3. **Community integration** — connect with external data sources
4. **Content depth** — serve the endgame grinder with advanced analytics

---

## Feature Roadmap

### Phase 1: v5.0 — Intelligence Layer ✅ RELEASED

Features that make the app *smarter* than just a stopwatch.

---

#### 1. Advanced Drop Calculator with Probability Engine ✅

Transform the existing qualitative drop calculator into a real probability engine (like Silospen, but integrated with your farming data).

**Why:** Silospen and d2rdecoded.com are the go-to tools but require alt-tabbing. Having probabilities integrated with actual farming stats enables "expected vs actual" analysis.

**Implementation:**
- Import treasure class data from D2R game files (TreasureClassEx equivalent)
- Calculate actual per-kill probability for specific items given: monster, area level, player count, MF%, quest bonus
- Show "runs until likely drop" estimation based on your average run speed
- Compare your actual drop rate vs expected probability ("You've found Shako 2x but expected ~1.3x in 500 Meph runs — you're running hot")
- Visualization: probability curve overlaid on your actual drop history
- Support RotW-specific TC changes (Terror Zone level scaling, Herald drops)

**Data sources:** d2rdecoded.com methodology, Silospen TC tables, Patch 3.2 item data

---

#### 2. Runeword Planner & Rune Inventory ✅

Track runes in your stash and show which runewords you can make or are close to completing.

**Why:** d2runewizard.com and d2runes.io are popular but disconnected from your farming data. Integrating rune tracking means the app can tell you "3 more Lo runes from Fortitude" or "you found a Ber — here's what you can make now."

**Implementation:**
- Rune inventory panel: grid of 33 runes with count per rune
- Auto-increment when a rune is logged as a found item (link to existing item system)
- Runeword eligibility engine: given your current rune stock, show which runewords are available
- "Progress toward" view: selected target runewords show % completion with missing runes highlighted
- Cube upgrade calculator: show how many lower runes needed to cube up to target
- Include all 5 RotW runewords (Authority, Coven, Void, Vigilance, Ritual)
- Separate from items page — dedicated "Runes" tab in sidebar

---

#### 3. Farming Efficiency Advisor ✅

AI-free rule-based system that suggests what you should farm next based on your data.

**Why:** Maxroll tier lists are static. This would give personalized recommendations based on *your* actual performance data.

**Implementation:**
- Analyze items/hour, value/hour, and XP/hour across all areas you've farmed
- "Best for you" ranking: sort areas by your personal efficiency (not generic tier lists)
- Terror Zone recommendations: when a TZ becomes active, show if it's historically good for you
- Build-specific suggestions: based on logged character class, suggest optimal farming targets
- "Diminishing returns" alert: detect when you're overfarming an area (no drops in X runs, suggest switching)
- Weekly summary email-style digest (shown on app open): "This week: 340 runs, 12.3 items/hour average, best area was Pit (+18% vs your average)"

---

#### 4. Session Achievements & Milestones ✅ (Released in v4.1.0)

Gamification layer that makes farming more rewarding.

**Why:** Gamification increases engagement. The D2R community loves tracking accomplishments (Holy Grail culture, level 99 races, etc.)

**Implementation:**
- Achievement system: unlock badges for milestones (100 runs, first GG drop, 10-hour session, etc.)
- Streak achievements: "5 consecutive sessions with items", "Marathon" (3+ hours)
- Per-class achievements: "Sorceress Master" (1000 runs with Sorceress)
- Per-area achievements: "Pit Lord" (500 Pit runs)
- Lifetime statistics dashboard: total hours, total items, career summary
- Pop-up notification when achievement unlocked
- Viewable achievement gallery page
- No external sharing — purely personal motivation

---

### Phase 2: v5.1 — Automation & QoL ✅ RELEASED

Reduce clicks and manual input.

---

#### 5. Screenshot Item Detection (OCR/Vision) ✅

Detect items from game screenshots to auto-log them.

**Why:** Manual item logging is the biggest friction point. Tools like D2R-AI-Item-Tracker and horadricapp already do this via Vision LLMs or OCR. Integrating it removes the need to type item names.

**Implementation:**
- Clipboard monitoring: detect when user takes a screenshot (PrintScreen)
- OCR pipeline using Tesseract (Rust crate: `leptess` or `tesseract-rs`) — no external dependencies
- Item tooltip parsing: extract item name and rarity from D2R tooltip format
- Confidence threshold: if >80% match with item DB, auto-suggest; otherwise show dropdown pre-filled
- Fallback: always allow manual correction before saving
- Settings: enable/disable auto-detection, clipboard monitoring toggle
- Privacy: all processing local, no network calls

**Complexity:** High — OCR accuracy varies with resolution. Start with Unique/Set item names (distinctive gold/green text) and rune names.

---

#### 6. Quick-Start Templates ✅

Pre-configured session templates for common farming patterns.

**Why:** Experienced farmers repeat the same setup daily. "Meph runs, P3, with goal 50 runs" shouldn't require 4 clicks every time.

**Implementation:**
- Template manager: save current session configuration as a named template
- Fields saved: area, player count, route (if applicable), session goal, tags
- "Start from template" button on Run Tracker (above regular start)
- Recent templates shown first (last 3 used)
- Per-profile templates (different characters farm differently)
- One-click start: select template → session begins immediately

---

#### 7. Customizable Overlay Layouts ✅

Let users configure what the overlay shows and how it's arranged.

**Why:** Current overlay is fixed layout. Streamers want different info than solo players. Some want XP/hour, others want item count emphasis.

**Implementation:**
- Overlay editor in Settings: drag-and-drop stat blocks onto a preview canvas
- Available widgets: timer, run count, items found, last item, dry streak, goal progress, XP/hour, route step
- Resize individual widgets (small/medium/large text)
- Save multiple overlay profiles (compact, streamer, detailed)
- Opacity slider per widget group
- Custom background color/opacity

---

### Phase 3: v5.2 — Community & Social (Est. ~12h)

---

#### 8. Leaderboards (Local + Export)

Compare your stats against your own history or export for community comparison.

**Why:** The D2R ladder is all about competition. Even local leaderboards (personal bests) add motivation. Export enables community challenges.

**Implementation:**
- Personal bests board: fastest run per area, highest items/hour session, longest session, most items in one run
- Historical trends: "This month vs last month" comparison
- Export stats as shareable card (PNG image generation) for Discord/Reddit
- Seasonal reset option: archive stats for a ladder season and start fresh
- Optional: JSON export format compatible with community leaderboard sites (if any emerge)

---

#### 9. DClone API Integration (Live Data)

Pull live Diablo Clone progress from diablo2.io API instead of manual entry.

**Why:** diablo2.io provides the community standard DClone tracker with API access. Auto-updating removes the need for manual progress entry.

**Implementation:**
- Poll diablo2.io DClone API every 5 minutes (configurable)
- Auto-update progress bars per region/mode
- Push notifications when progress reaches threshold
- CSP update needed: add `https://diablo2.io` to connect-src
- Fallback: if API unavailable, show last known state with "stale" indicator
- Respect rate limits (max 1 request per 5 min)
- Optional: user can still manually override (for when API lags behind reports)

---

#### 10. Terror Zone API Integration

Pull current Terror Zone data from community APIs for online play.

**Why:** terrorzonetracker.com and d2emu.com provide TZ data. Auto-updating means the app always shows the correct active zone.

**Implementation:**
- Online mode: poll community TZ API for current rotation
- Single Player mode: use deterministic calendar calculation (already partially implemented)
- Show "best route for this TZ" based on user's historical data in that zone
- TZ calendar: show upcoming rotations (next 3-5 zones)
- Integration with Run Tracker: auto-suggest TZ area when a preferred zone is active

---

#### 11. Trade Value Estimation

Show approximate trade value for items using community price data.

**Why:** diablo2.io has the most comprehensive D2R price database. Showing estimated value alongside item tier helps users understand what's worth keeping.

**Implementation:**
- Static value ranges embedded in app (updated with releases, not live API)
- Categories: "HR+" (worth high runes), "Mid" (worth Ist-Vex), "Low" (worth Pul-Gul), "Self-use" (good but not tradeable)
- Values separate from the existing tier system (tier = farming value, trade = market value)
- Source attribution: "Values based on diablo2.io price data as of [date]"
- Update frequency: refresh values with each app release
- Settings toggle: show/hide trade values (some players don't trade)

---

### Phase 4: v6.0 — Platform & Polish (Est. ~15h)

---

#### 12. Linux Native Packaging

Provide proper Linux distribution packages beyond raw binaries.

**Why:** The app already works on Linux but requires manual install. AppImage/Flatpak/deb packages make it accessible to the Linux gaming community.

**Implementation:**
- AppImage: self-contained, works everywhere
- .deb package: for Debian/Ubuntu users
- Flatpak: for sandboxed installs
- AUR package: for Arch Linux (community maintained or PKGBUILD in repo)
- CI/CD: add Linux build targets to GitHub Actions workflow
- Update README with Linux install instructions per distro

---

#### 13. Data Visualization Overhaul

Upgrade charts and add new visualization types.

**Why:** Current Recharts implementation is functional but basic. Power users with months of data want deeper visual analysis.

**Implementation:**
- Heatmap: farming activity by day/hour (GitHub contribution graph style)
- Calendar view: items found per day on a year calendar
- Cumulative progress charts: total items/runs/value over time
- Area efficiency scatter plot: time per run vs items/run per area (identify sweet spots)
- Drop luck analysis: rolling average of items/hour with trend line
- Exportable chart images for sharing
- Dark/Light theme for all chart variants

---

#### 14. Plugin/Extension System (Foundation)

Lay groundwork for community-contributed features without bloating core app.

**Why:** Feature requests are endless. A plugin system lets the community build niche features (specific build trackers, custom analytics, etc.) without core app changes.

**Implementation:**
- Define plugin API: read-only access to run/item/stats data via JSON
- Plugin manifest format (name, version, author, permissions)
- Plugin directory: `~/.config/d2r-desktop/plugins/`
- Sandboxed execution: plugins run in isolated webview or as WASM modules
- Initial plugins: custom stat widgets, export formatters
- v6.0 ships the foundation; community builds on it

**Complexity:** Very high. This is a long-term architectural investment. v6.0 would only ship the API spec and 1-2 example plugins.

---

#### 15. Mobile Companion (Read-Only)

A lightweight web view of your stats accessible from phone.

**Why:** Checking farming progress away from the PC (at work, on break, etc.) is a common request.

**Implementation:**
- Local web server mode: Tauri app serves read-only stats on LAN
- Access via phone browser: `http://192.168.x.x:PORT/`
- Shows: recent sessions, lifetime stats, current session (if running)
- No login required (LAN-only security)
- Optional: export stats to a static HTML file that can be opened anywhere
- Settings: enable/disable companion server, configure port

---

## Quality of Life Improvements (Any Version)

These are smaller improvements that can be sprinkled into any release:

| # | Improvement | Effort |
|---|-------------|--------|
| Q1 | **Keyboard shortcuts in UI** — navigate pages with Ctrl+1-9, start session with Enter | ~1h |
| Q2 | **Run timer sound** — audible tick every N minutes (configurable) to prevent AFK timeout | ~30min |
| Q3 | **Multi-select delete in History** — batch delete runs with checkboxes | ~2h |
| Q4 | **Item notes** — add free-text notes to individual items (e.g., "eth perf roll") | ~1h |
| Q5 | **Import from oskros MF_counter** — parse .json export format from competing tool | ~2h |
| Q6 | **Session pause reminder** — notification if session is paused for >5 minutes | ~30min |
| Q7 | **Fastest run alert** — sound + visual when you beat your personal best run time | ~1h |
| Q8 | **Area favorites** — pin frequently used areas to top of selector | ~1h |
| Q9 | **Export to CSV** — export run history as CSV for spreadsheet analysis | ~1h |
| Q10 | **Tray icon** — minimize to system tray instead of taskbar | ~2h |
| Q11 | **Run timer in window title** — show current timer in window title bar for taskbar visibility | ~30min |
| Q12 | **Seasonal data separation** — tag data with ladder season for historical comparison | ~3h |
| Q13 | **Auto-backup to cloud sync folder** — combine backup scheduler with cloud sync path | ~1h |
| Q14 | **Item search in Statistics** — "show me all sessions where I found Ber Rune" | ~2h |
| Q15 | **Overlay hotkey toggle** — hotkey to show/hide overlay without clicking sidebar | ~30min |

---

## Competitive Differentiation (Updated July 2026)

| Feature | D2R Tracker (v5.1) | oskros MF_counter | diablo2.io | Silospen | maxroll.gg | d2r-arcane-tracker |
|---------|-------------------|-------------------|------------|----------|------------|-------------------|
| Run timer + splits | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Item logging (searchable) | ✅ | ✅ (manual) | ❌ | ❌ | ❌ | ✅ (auto-OCR) |
| Global hotkeys | ✅ | ✅ | N/A | N/A | N/A | ❌ |
| In-game overlay | ✅ (customizable) | ✅ | N/A | N/A | N/A | ❌ |
| Probability calculator | ✅ (exact + integrated) | ❌ | ❌ | ✅ (exact) | ✅ (basic) | ❌ |
| Runeword planner | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Farming advisor | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Auto item detection | ✅ (local OCR) | ❌ | ❌ | ❌ | ❌ | ✅ (Vision LLM) |
| Quick-start templates | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Route tracking | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Terror Zone tracking | ✅ | ❌ | ✅ (web) | ❌ | ✅ (web) | ❌ |
| DClone tracking | ✅ (manual) | ❌ | ✅ (live) | ❌ | ❌ | ❌ |
| Herald/Ancients tracking | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cloud sync | ✅ | ❌ | N/A (web) | N/A | N/A | ❌ |
| Co-op tracking | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PDF reports | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Offline-first | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Trade values | 🔲 Planned | ❌ | ✅ (live) | ❌ | ✅ (guide) | ❌ |
| Multi-language | ✅ (3) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Achievements | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Key differentiators (v5.1 shipped):**
- Only desktop tool with integrated probability engine + personal farming data
- Only tool combining runeword planning with rune drop tracking
- Only tool offering farming efficiency advisor based on personal data
- Achievement system with gamification for farming motivation
- Local OCR item detection without requiring external API keys or cloud services
- Customizable overlay editor with multiple profiles (Compact, Streamer, Detailed)
- Quick-start templates for one-click farming sessions

**Next differentiators (v5.2+):**
- DClone and Terror Zone live API integration
- Trade value estimation from community data

---

## Version Planning

| Version | Theme | Features | Status |
|---------|-------|----------|--------|
| v5.0.0 | Intelligence | Advanced Drop Calc + Runeword Planner + Efficiency Advisor + Achievements | ✅ Released |
| v5.1.0 | Automation | Screenshot OCR + Quick-Start Templates + Custom Overlay | ✅ Released |
| v5.2.0 | Community | Leaderboards + DClone API + TZ API + Trade Values | 🔲 Next |
| v6.0.0 | Platform | Linux Packaging + Viz Overhaul + Plugin System + Mobile Companion | 🔲 Planned |

---

## Priority Ranking

Based on: community demand, competitive gap, implementation feasibility, and engagement impact.

| Priority | Feature | Status |
|----------|---------|--------|
| ✅ | Runeword Planner & Rune Inventory | Shipped v5.0.0 |
| ✅ | Advanced Drop Calculator with Probability Engine | Shipped v5.0.0 |
| ✅ | Session Achievements | Shipped v4.1.0 |
| ✅ | Farming Efficiency Advisor | Shipped v5.0.0 |
| ✅ | Quick-Start Templates | Shipped v5.1.0 |
| ✅ | Screenshot OCR | Shipped v5.1.0 |
| ✅ | Customizable Overlay | Shipped v5.1.0 |
| 🥇 1 | DClone API Integration | Easy win, removes manual input, diablo2.io provides data |
| 🥇 2 | Terror Zone API Integration | Same as DClone — easy external data pull |
| 🥈 3 | Trade Value Estimation | Nice-to-have, static data update with each release |
| 🥈 4 | Leaderboards & Export | Community-facing, moderate effort |
| ⬜ 5 | Data Visualization Overhaul | Polish, not new capability |
| ⬜ 6 | Linux Packaging | Infrastructure, serves Linux gaming niche |
| ⬜ 7 | Plugin System | Long-term investment, defer until community demands it |
| ⬜ 8 | Mobile Companion | Nice-to-have, low priority |

---

## Technical Debt to Address

Before adding major features:

1. **Fix overlay window process lifecycle** — ensure overlay doesn't prevent app close ✅ Fixed v4.0.4
2. **Reduce bundle size** — Statistics page is 450KB, consider code-splitting Recharts further
3. **Add E2E tests** — currently only unit tests, no integration tests for Tauri commands
4. **Rust error handling** — some commands use `.expect()`, should return `Result` for graceful UI error handling
5. **CSP hardening** — connect-src needs expansion for API integrations (plan ahead)
6. **Database migrations** — add a proper migration system (numbered migrations) instead of ALTER TABLE in `init_db`

---

## Anti-Cheat / TOS Compliance Policy

**Principle:** D2R Tracker MUST NEVER interact with the D2R game process in any way.

**Discarded features:**
- ❌ **Auto-Split Detection** — Would require monitoring the D2R process (window title polling, ReadProcessMemory, or pixel detection). Any form of process interaction can be flagged by Warden (Blizzard's anti-cheat). Players using such tools risk permanent account bans. Discarded entirely.
- ❌ **Game memory reading** — No item detection, map reveal, or state reading from game memory. Ever.
- ❌ **Input injection** — No automated clicks, keypresses, or macros sent to the game window.

**Safe patterns (what we DO):**
- ✅ User manually logs items via our UI (no game interaction)
- ✅ Global hotkeys registered via OS APIs (not injected into game)
- ✅ Overlay window floats on top (standard OS window, not injected into game rendering)
- ✅ OCR of user-initiated screenshots from clipboard (passive, user-triggered)
- ✅ External API calls to community websites (diablo2.io, etc.)
- ✅ All data entry is manual or clipboard-based — never scraped from the game

**Rule:** If a feature requires any of the following, it MUST be rejected:
1. Opening a handle to the D2R process
2. Reading or writing game memory
3. Hooking into game DLLs or rendering pipeline
4. Sending synthetic input to the game window
5. Scanning game files at runtime for state information

---

*Document created: July 2026*
*Covers: v5.2.0 through v6.0.0 (v5.1.0 released July 2026)*
*Previous plans: DEVELOPMENT_PLAN.md (v1.0–v2.0), DEVELOPMENT_PLAN_V3.md (v2.1–v4.0)*
