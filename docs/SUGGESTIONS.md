# D2R Tracker — Feature Suggestions & Improvement Ideas

Based on analysis of the D2R community, existing tools (Silospen Drop Calculator, oskros MF_run_counter, diablo2.io Holy Grail Tracker, d2rdecoded.com, maxroll.gg farming guides), game mechanics, and current application state.

---

## High Priority — Most Requested by Community

### 1. Holy Grail Tracker
Track progress toward finding every Unique, Set item, and Rune in the game.

**Why:** This is the #1 endgame goal for MF farmers. diablo2.io has a web version with 500k+ users. No good desktop offline tracker exists for RotW.

**Implementation:**
- Checklist of all Uniques (~400), Sets (~130 pieces), Runes (33)
- Mark items as found (auto-mark when adding to a run)
- Progress bar and completion percentage
- Filter by category: missing items, found items, by area where they can drop
- The item database already exists in the app — just needs a "found/not found" state per profile

---

### 2. Global Hotkeys
Allow controlling the tracker without alt-tabbing or using the overlay mouse.

**Why:** Every competing run tracker (oskros, D2 Reconsidered) has hotkeys. Reduces friction during fast runs.

**Implementation:**
- `F1` or configurable: Next Run (split)
- `F2` or configurable: Pause/Resume
- `F3` or configurable: End Session
- Use `tauri-plugin-global-shortcut` (already available for Tauri 2)
- Configurable in a Settings page

---

### 3. MF Effective Calculator
Show the effective Magic Find value accounting for diminishing returns.

**Why:** Players constantly ask "is 400 MF better than 250 MF?" The answer depends on the diminishing returns formula which is different for each rarity.

**Implementation:**
- Input: total MF from gear
- Output: Effective MF for Unique (factor 250), Set (factor 500), Rare (factor 600)
- Formula: `Effective MF = (MF * Factor) / (MF + Factor)`
- Show as a small widget or in the profile/session config
- Optionally input current MF per profile

---

### 4. Drop Rate Calculator (Per Area)
Show the probability of finding specific items in the selected area.

**Why:** Silospen's drop calculator is the most-used D2 tool but it's a website. Having it integrated means the player doesn't need to alt-tab.

**Implementation:**
- Select an area → show items that can drop there (based on area level/TC)
- Show probability per kill for high-value items
- Data source: Treasure Class tables from game files (publicly available)
- Could start simple: just show which TC85 areas can drop all items, which are TC87 restricted, etc.

---

## Medium Priority — Quality of Life

### 5. Sound Notifications
Play a sound when:
- A run exceeds average time (you might be AFK/distracted)
- Session milestone reached (every 10 runs, every 50 runs)
- Configurable timer alarms

**Why:** holygrail.link and oskros both have sound features. Farmers often zone out.

---

### 6. Player Count Tracking
Track what `/players X` setting was used for each run (or online player count).

**Why:** Player count dramatically affects drop rates. Comparing runs at /players 1 vs /players 7 without this context is misleading.

**Implementation:**
- Add optional `player_count` field to Run model (default: null/unknown)
- Selectable in the session start or overlay (1-8)
- Statistics filtered by player count

---

### 7. Session Goals
Set a target before starting a session (e.g., "50 runs" or "2 hours" or "until I find a Ber rune").

**Why:** Gives structure to farming sessions. Popular feature in run counters for streamers.

**Implementation:**
- Goal types: run count, time duration, specific item found
- Progress indicator in the timer panel
- Alert/sound when goal is reached
- Option to continue or stop

---

### 8. Run Notes / Tags
Add quick notes or tags to individual runs (e.g., "good density", "map seed worth keeping", "crashed").

**Why:** Context helps when reviewing history. Current notes field exists but isn't easily accessible during a run.

**Implementation:**
- Quick-tag buttons in overlay: "GG", "Bad Map", "Crash", custom tags
- Filter history by tags
- Tags visible in statistics

---

## Lower Priority — Nice to Have

### 9. Streamer Mode / OBS Integration
Export live stats as a text file or web source for OBS overlays.

**Why:** Many MF streamers want to show run count, session time, and last found items on stream.

**Implementation:**
- Write a text file periodically with current stats (run count, timer, last items)
- OBS reads text file as a source
- Or: local web server endpoint that OBS browser source can consume

---

### 10. Multi-Area Route Tracking
Track runs that visit multiple areas in sequence (e.g., "Mephisto → Pindle → Andy" route).

**Why:** Many farmers run fixed routes. Tracking each area separately loses the route context.

**Implementation:**
- "Route" mode: define a sequence of areas
- Auto-split when all areas in route are done
- Route-level statistics (total route time, items per route)

---

### 11. Item Value Estimation
Show approximate trade value of found items (based on community pricing data).

**Why:** Helps players understand if a drop is valuable or just stash filler.

**Implementation:**
- Basic tier system: Worthless / Low / Mid / High / GG
- Could pull from d2jsp forum gold values or community-maintained tier list
- Manual override per item

---

### 12. Comparison Mode
Compare efficiency between different areas, different sessions, or different time periods.

**Why:** "Is Ancient Tunnels better than Mephisto for my character?" is a question every farmer asks.

**Implementation:**
- Side-by-side stats: Area A vs Area B
- Metrics: items/hour, uniques/hour, time per run
- Requires enough data points for statistical significance

---

### 13. Dark/Light Theme Toggle
Currently only dark theme. Some users prefer light themes.

**Why:** Accessibility and preference. Low effort, high polish.

---

### 14. Custom Area List
Allow users to add custom areas not in the default list.

**Why:** Terror Zones can be any area in the game. RotW added new areas. Users may want to track non-standard locations.

**Implementation:**
- "Add custom area" button in area selector
- Persisted in SQLite (separate `custom_areas` table or user preferences)

---

### 15. Run Streak Tracking
Track consecutive runs without finding items (dry streaks) and best streaks.

**Why:** Community loves tracking "drought" vs "hot streaks". Creates engagement and storytelling.

**Implementation:**
- Current streak counter (runs since last item)
- Longest drought per area
- Best streak (most items in consecutive runs)

---

## Data & Technical Improvements

### 16. Database Indexes
Add indexes to frequently queried columns for better performance with large datasets.

```sql
CREATE INDEX IF NOT EXISTS idx_runs_profile_status ON runs(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_items_run ON items(run_id);
CREATE INDEX IF NOT EXISTS idx_items_profile ON items(profile_id);
```

**Why:** Users with 1000+ runs will notice slower History and Statistics loading without indexes.

---

### 17. Pagination in History
Currently loads ALL runs at once. With 1000+ runs this becomes slow.

**Why:** Performance. The Promise.all loading all items for all runs is O(n) API calls.

**Implementation:**
- Load 50 runs at a time with "Load More" button
- Only load items for expanded runs (lazy load)

---

### 18. Data Sync (Optional Cloud)
Optional sync to a cloud service for multi-device access.

**Why:** Some players use multiple PCs. Current export/import works but is manual.

**Implementation:**
- Optional GitHub Gist sync (user provides token)
- Or simple file sync to Dropbox/OneDrive folder
- Low priority since export/import covers the use case

---

## Competitive Analysis Summary

| Feature | D2R Tracker (ours) | oskros MF_counter | diablo2.io | Silospen |
|---------|-------------------|-------------------|------------|----------|
| Run timer | ✅ | ✅ | ❌ | ❌ |
| Session tracking | ✅ | ✅ | ❌ | ❌ |
| Item logging | ✅ (searchable DB) | ✅ (manual) | ❌ | ❌ |
| Holy Grail | ❌ | ✅ | ✅ | ❌ |
| Drop calculator | ❌ | ❌ | ❌ | ✅ |
| Global hotkeys | ❌ | ✅ | N/A | N/A |
| In-game overlay | ✅ | ✅ | N/A | N/A |
| Statistics/Charts | ✅ | Basic | Basic | ❌ |
| PDF export | ✅ | ❌ | ❌ | ❌ |
| Auto-update | ✅ | ❌ | N/A | N/A |
| Offline | ✅ | ✅ | ❌ | ❌ |
| MF calculator | ❌ | ❌ | ❌ | Partial |
| Player count | ❌ | ❌ | ❌ | ✅ |
| Sound alerts | ❌ | ✅ | ❌ | ❌ |

---

## Recommended Implementation Order

1. **Global Hotkeys** — Low effort, huge UX win
2. **Holy Grail Tracker** — Differentiator, uses existing item DB
3. **MF Calculator widget** — Simple math, high value
4. **Database Indexes** — Performance safety net
5. **Player Count** — Small model change, big data value
6. **Session Goals** — Engagement feature
7. **Sound Notifications** — Polish
8. **Pagination** — Scale readiness
9. **Drop Calculator** — Complex but unique selling point
10. **Everything else** — Based on community feedback

---

*Document generated: June 2026*
*Based on: D2R v3.2 (Reign of the Warlock), community tools analysis, and game mechanics research*
