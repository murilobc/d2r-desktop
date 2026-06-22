# D2R Tracker

A desktop application for tracking Magic Find runs in **Diablo II: Resurrected** (v3.2 — Reign of the Warlock). Built with Tauri, React, and Rust with a local SQLite database.

## Download

![Downloads](https://img.shields.io/github/downloads/murilobc/d2r-desktop/total?style=flat-square&color=4ecdc4)

| Platform | Installer |
|----------|-----------|
| Windows (.exe) | [d2r-desktop_0.9.1_x64-setup.exe](https://github.com/murilobc/d2r-desktop/releases/latest/download/d2r-desktop_0.9.1_x64-setup.exe) |
| Windows (.msi) | [d2r-desktop_0.9.1_x64_en-US.msi](https://github.com/murilobc/d2r-desktop/releases/latest/download/d2r-desktop_0.9.1_x64_en-US.msi) |

> [All releases](https://github.com/murilobc/d2r-desktop/releases/latest)

## Screenshots (Mockups)

> Note: These are SVG mockups representing the application layout. Actual screenshots may vary slightly.

### Profiles
![Profiles](docs/mockups/profiles.svg)

### Run Tracker
![Run Tracker](docs/mockups/run-tracker.svg)

### History
![History](docs/mockups/history.svg)

### Statistics
![Statistics](docs/mockups/statistics.svg)

## Features

### Profile Management
- Create profiles for each character (name, class, game mode)
- Supports all 8 classes including the Warlock from Reign of the Warlock
- Game modes: Ladder, Non-Ladder, Single Player

### Run Tracker
- Session-based tracking with session timer and individual run timer
- One-click split to finish current run and start the next instantly
- Pause/resume session and run timers
- Live stats: run count (session + total), fastest time, average time
- Area selection with memory (persists last used area per profile)
- Add items found during a run via searchable combobox

### Item Database
- Complete D2R v3.2 item database with searchable combobox
- All 33 runes
- ~99 runewords (including RotW: Authority, Coven, Void, Vigilance, Ritual)
- All unique items (weapons, armor, jewelry, grimoires, Colossal Ancient jewels)
- All set items (classic + expansion)
- Notable base items (normal, superior, ethereal)
- Valuable charms (small, grand, unique, sunder)
- Magic/rare jewels and facets
- Filter by category for quick lookup

### History
- Full run history with area and run number per area (e.g. "Mephisto #47")
- Runs with items found are auto-expanded for quick viewing
- Edit run area retroactively
- Add or remove items from past runs

### Statistics & Reports
- Summary cards: total runs, items, time, averages, efficiency metrics
- Filter all stats by area
- Interactive charts (Recharts):
  - Run duration over time (efficiency trend)
  - Items per run (bar chart)
  - Rarity distribution (pie chart)
  - Runs by area (horizontal bar)
- Top 10 most found items
- Detailed report table with every run listed
- **Export to PDF** with full report (jsPDF)

### Data Management
- Export all data (profiles, runs, items) to JSON backup
- Import data from JSON backup (skips duplicates)
- Fully portable between machines

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Recharts, jsPDF |
| Backend | Rust, Tauri 2, SQLite (rusqlite) |
| Desktop | Tauri (native window, no Electron) |
| Build | Vite, Cargo |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- Tauri prerequisites for your OS ([see docs](https://v2.tauri.app/start/prerequisites/))

### Development

```bash
# Install frontend dependencies
npm install

# Run in development mode (hot-reload)
npm run tauri dev
```

### Build

```bash
# Production build for current OS
npm run tauri build
```

Installers are output to `src-tauri/target/release/bundle/`.

## Windows Releases

Windows `.exe` and `.msi` installers are automatically built via GitHub Actions when a version tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Download installers from the [Releases](https://github.com/murilobc/d2r-desktop/releases) page.

## Project Structure

```
d2r-desktop/
├── src/                    # React frontend
│   ├── api.ts              # Tauri command bindings
│   ├── types.ts            # TypeScript interfaces
│   ├── data/items.ts       # D2R item database
│   ├── components/         # Reusable components (ItemSearch)
│   └── pages/              # App pages
│       ├── Profiles.tsx
│       ├── RunTracker.tsx
│       ├── History.tsx
│       └── Statistics.tsx
├── src-tauri/              # Rust backend
│   └── src/
│       ├── lib.rs          # App setup & command registration
│       ├── db.rs           # SQLite connection & migrations
│       ├── models.rs       # Data structs
│       └── commands.rs     # Tauri commands (CRUD + stats)
└── .github/workflows/      # CI/CD
    └── build-windows.yml
```

## License

MIT
