# D2R Tracker

A desktop application for tracking Magic Find runs in **Diablo II: Resurrected** (v3.2 — Reign of the Warlock). Built with Tauri, React, and Rust with a local SQLite database.

## Download

![Downloads](https://img.shields.io/github/downloads/murilobc/d2r-desktop/total?style=flat-square&color=4ecdc4)

| Platform | Installer |
|----------|-----------|
| Windows (.exe) | [d2r-desktop_1.0.0_x64-setup.exe](https://github.com/murilobc/d2r-desktop/releases/latest/download/d2r-desktop_1.0.0_x64-setup.exe) |
| Windows (.msi) | [d2r-desktop_1.0.0_x64_en-US.msi](https://github.com/murilobc/d2r-desktop/releases/latest/download/d2r-desktop_1.0.0_x64_en-US.msi) |

> [All releases](https://github.com/murilobc/d2r-desktop/releases/latest)

---

## User Manual

> Note: The images below are SVG mockups representing the application layout. Actual appearance may vary slightly.

---

### Profiles

![Profiles](docs/mockups/profiles.svg)

The Profiles screen is your starting point. Here you manage your characters.

**Functions:**
- **+ New Profile** — Opens the creation form
- **Name** — Your character name (e.g. "MFSorc", "HammerPally")
- **Class** — Select from all 8 D2R classes (Amazon, Necromancer, Barbarian, Sorceress, Paladin, Druid, Assassin, Warlock)
- **Mode** — Ladder, Non-Ladder, or Single Player
- **Create Profile** — Saves the new profile
- **Select** — Activates the profile and navigates to Run Tracker
- **Delete** — Permanently removes the profile and all associated runs/items (asks for confirmation)

Each profile has independent run history, items, and statistics.

---

### Run Tracker

![Run Tracker](docs/mockups/run-tracker.svg)

The Run Tracker is the core of the application. It manages your farming sessions.

**Functions:**
- **Area selector** — Choose which area you're farming (remembers your last selection)
- **▶ Start Session** — Begins a new farming session with timer and first run

**During an active session:**
- **Session timer** (top, small) — Total time since session started, with recording indicator
- **Run timer** (center, large) — Current run elapsed time in HH:MM:SS.T format
- **Run count** — Current session runs + total all-time runs in parentheses
- **Fastest time** — Best run time in this session
- **Average time** — Average run duration in this session
- **⏭ Next Run** — Finishes the current run (saves duration) and immediately starts the next one
- **⏸ Pause / ▶ Resume** — Pauses both session and run timers
- **⏹ End Session** — Finishes the last run and stops the session
- **Area selector** (during session) — Change area mid-session if needed
- **+ Item** — Opens the item search to log a drop found during the current run
- **Item search** — Searchable combobox with the full D2R v3.2 item database (500+ items), filterable by category (Rune, Runeword, Unique, Set, Base, Charm, Jewel, Rare/Magic)
- **✕** — Remove an item from the current run

---

### In-Game Overlay

![Overlay](docs/mockups/overlay.svg)

A compact, always-on-top window that floats over D2R while you play. Toggle it from the sidebar with the **🖥️ Overlay** button.

**Functions:**
- **Session timer** (top left) — Shows session elapsed time with recording dot
- **Area** (top right) — Current farming area
- **Run timer** (center, large) — Current run time, identical to main window
- **Run count** — Session runs + total
- **⏭** — Next Run (split)
- **⏸** — Pause / Resume
- **⏹** — End Session
- **+** — Add item (opens the same searchable combobox as the main window)
- **×** — Hide the overlay
- **Drag anywhere** — Reposition the overlay on screen

**Requirements:** D2R must be in Windowed or Windowed Fullscreen mode (Fullscreen Exclusive blocks all overlays).

---

### History

![History](docs/mockups/history.svg)

The History screen shows all completed runs with full details.

**Functions:**
- **Run list** — All completed runs sorted newest first, showing area + run number (e.g. "Mephisto #47"), duration, and date/time
- **Auto-expand** — Runs that have items found are automatically expanded for quick viewing
- **Click to expand/collapse** — Toggle run details manually
- **Area: [name] ✎** — Click to change the run's area retroactively
- **Items list** — Shows all items found in that run with color-coded rarity
- **+ Add Item** — Add items to a past run (uses the full searchable item database)
- **✕** — Remove an item from the run
- **Delete** — Permanently remove a run and its items

---

### Statistics

![Statistics](docs/mockups/statistics.svg)

The Statistics screen provides analytics and reporting on your farming data.

**Functions:**
- **Area filter** — Filter all stats and charts by a specific area, or view all areas combined
- **Summary cards** — Total Runs, Total Items, Total Time, Average Time, Fastest, Slowest, Items/Run, Items/Hour
- **Duration per Run chart** — Line chart showing run time over time (efficiency trend)
- **Items per Run chart** — Bar chart showing drops per run
- **Rarity Distribution** — Pie chart of items by rarity type
- **Runs by Area** — Horizontal bar chart showing farming distribution
- **Top 10 Most Found Items** — Table ranking your most common drops
- **📊 Detailed Report** — Expandable table with every run listed (date, area, duration, items found)
- **📄 Export PDF** — Generates a full PDF report with all stats, charts data, and run-by-run details (opens native Save dialog)

---

### Sidebar

The sidebar is always visible and provides navigation and utilities.

**Navigation:**
- 👤 **Profiles** — Manage characters
- 🎮 **Run Tracker** — Active farming session
- 📜 **History** — Past runs
- 📊 **Statistics** — Analytics and reports

**Utilities:**
- 🖥️ **Overlay** — Toggle the in-game overlay window
- 💾 **Export Data** — Save all profiles, runs, and items as JSON backup (native Save dialog)
- 📂 **Import Data** — Load a JSON backup file (native Open dialog, skips duplicates)

**Active profile indicator** — Shows the currently selected profile name and class at the bottom.

---

## Data Safety

- All data is stored locally in SQLite at `%APPDATA%/com.muh.d2r-desktop/`
- Updates only replace the application executable — your database is never touched
- Export/Import allows full portability between machines
- The auto-updater checks GitHub Releases and installs updates without data loss

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Recharts, jsPDF |
| Backend | Rust, Tauri 2, SQLite (rusqlite) |
| Desktop | Tauri (native webview, no Electron) |
| Build | Vite, Cargo |
| CI/CD | GitHub Actions, automated tests |

---

## Getting Started (Development)

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- Tauri prerequisites for your OS ([see docs](https://v2.tauri.app/start/prerequisites/))

### Development

```bash
npm install
npm run tauri dev
```

### Testing

```bash
npm test
```

### Build

```bash
npm run tauri build
```

Installers are output to `src-tauri/target/release/bundle/`.

---

## Project Structure

```
d2r-desktop/
├── src/                       # React frontend
│   ├── api.ts                 # Tauri command bindings
│   ├── types.ts               # TypeScript interfaces and constants
│   ├── data/items.ts          # D2R v3.2 item database (500+ items)
│   ├── components/            # Reusable components
│   │   └── ItemSearch.tsx     # Searchable combobox
│   ├── overlay/               # In-game overlay window
│   │   ├── Overlay.tsx
│   │   ├── overlay.css
│   │   └── main.tsx
│   ├── pages/                 # App pages
│   │   ├── Profiles.tsx
│   │   ├── RunTracker.tsx
│   │   ├── History.tsx
│   │   └── Statistics.tsx
│   └── test/                  # Test setup and mocks
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── lib.rs             # App setup & plugin registration
│       ├── db.rs              # SQLite connection & migrations
│       ├── models.rs          # Data structs
│       └── commands.rs        # Tauri commands (CRUD, stats, overlay)
├── .github/workflows/         # CI/CD
│   ├── ci.yml                 # PR checks (tests, tsc, cargo, vite)
│   └── build-windows.yml     # Release builds (signed, with updater)
└── docs/mockups/              # SVG mockups for README
```

---

## License

MIT
