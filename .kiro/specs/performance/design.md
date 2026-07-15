# Design Document: Performance Profiling

## Overview

This design covers performance optimizations across the D2R Tracker application: virtual scrolling for the History page, batched statistics queries, SQLite VACUUM, lazy-loaded pages with skeleton placeholders, and component memoization. The goal is smooth 60fps scrolling with 10k+ runs, sub-second Statistics page loads with 50k+ runs, and faster initial app start.

## Architecture

The optimizations span three layers:

1. **Frontend rendering** — Virtual scrolling (react-window), React.lazy/Suspense, React.memo, useMemo
2. **IPC layer** — Combined stats command replacing multiple sequential calls
3. **Backend (Rust)** — Batched SQL queries, VACUUM command, query benchmarks

```
┌─────────────────────────────────────────────────┐
│  React Frontend                                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ VirtualList│  │ LazyPages│  │ Skeletons    │ │
│  │ (react-   │  │ React.   │  │ Shimmer      │ │
│  │  window)  │  │ lazy()   │  │ placeholders │ │
│  └─────┬─────┘  └────┬─────┘  └──────────────┘ │
│        │              │                          │
│  ┌─────┴──────────────┴─────────────────────┐   │
│  │  Memoized Components (React.memo/useMemo) │   │
│  └─────────────────┬────────────────────────┘   │
└────────────────────┼────────────────────────────┘
                     │ Tauri invoke (IPC)
┌────────────────────┼────────────────────────────┐
│  Rust Backend      │                             │
│  ┌─────────────────┴───────────────────────┐    │
│  │  get_stats_combined (single command)     │    │
│  │  vacuum_database                         │    │
│  │  get_runs_paginated (existing, optimized)│    │
│  └─────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────┐    │
│  │  SQLite (rusqlite) + indexes            │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

## Components

### 1. Virtual Scrolling (History Page)

**Library:** `react-window` (FixedSizeList or VariableSizeList)

The History page currently loads runs in batches of 50 with a "Load More" button. The new implementation replaces this with infinite virtual scrolling:

```typescript
import { FixedSizeList as List } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";

interface VirtualHistoryProps {
  profile: Profile;
}

// Each row is a fixed height when collapsed, variable when expanded
const ROW_HEIGHT = 56; // collapsed row height in px
const OVERSCAN_COUNT = 10;

function VirtualHistory({ profile }: VirtualHistoryProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const isItemLoaded = (index: number) => index < runs.length;

  const loadMoreItems = async (startIndex: number, stopIndex: number) => {
    const result = await getRunsPaginated(profile.id, startIndex, stopIndex - startIndex + 1);
    setTotalRuns(result.total);
    setRuns((prev) => {
      const newRuns = [...prev];
      result.runs.forEach((run, i) => {
        newRuns[startIndex + i] = run;
      });
      return newRuns;
    });
  };

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={totalRuns}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <List
          height={600}
          itemCount={totalRuns}
          itemSize={ROW_HEIGHT}
          width="100%"
          onItemsRendered={onItemsRendered}
          ref={ref}
          overscanCount={OVERSCAN_COUNT}
        >
          {HistoryRow}
        </List>
      )}
    </InfiniteLoader>
  );
}
```

**Key decisions:**
- Use `react-window` + `react-window-infinite-loader` for virtualization with auto-fetch
- Fixed row height for collapsed rows (56px), expanded rows handled via `VariableSizeList` or absolute-positioned overlay
- Overscan of 10 rows to prevent flicker during fast scrolling
- Batch size of 100 rows per fetch (increased from current 50 for fewer round-trips)

### 2. Combined Statistics Command (Rust Backend)

Replace the three sequential calls (`getStats`, `getDetailedRuns`, `getRoutes`) with a single Tauri command:

```rust
#[derive(Serialize)]
pub struct CombinedStats {
    pub summary: Stats,
    pub detailed_runs: Vec<DetailedRun>,
    pub routes: Vec<Route>,
}

#[tauri::command]
pub fn get_stats_combined(
    state: State<DbState>,
    profile_id: String,
    area_filter: Option<String>,
) -> Result<CombinedStats, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // All queries within the same connection lock — no repeated lock acquisition
    let summary = query_stats(&conn, &profile_id)?;
    let detailed_runs = query_detailed_runs(&conn, &profile_id, area_filter.as_deref())?;
    let routes = query_routes(&conn, &profile_id)?;

    Ok(CombinedStats {
        summary,
        detailed_runs,
        routes,
    })
}
```

**SQL optimization:**
- Use a single prepared query with JOINs to get runs + item counts in one pass
- Add composite index: `CREATE INDEX idx_runs_profile_started ON runs(profile_id, started_at DESC)`
- Summary stats query uses `COUNT`, `SUM`, `AVG` aggregates in one query instead of iterating in application code

### 3. VACUUM Command

```rust
#[derive(Serialize)]
pub struct VacuumResult {
    pub size_before_bytes: u64,
    pub size_after_bytes: u64,
    pub success: bool,
}

#[tauri::command]
pub fn vacuum_database(state: State<DbState>, app: AppHandle) -> Result<VacuumResult, String> {
    let db_path = get_db_path(&app);
    let size_before = std::fs::metadata(&db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("VACUUM").map_err(|e| e.to_string())?;
    drop(conn);

    let size_after = std::fs::metadata(&db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(VacuumResult {
        size_before_bytes: size_before,
        size_after_bytes: size_after,
        success: true,
    })
}
```

**Settings UI section:**
- New "Database Maintenance" section in Settings
- Shows current DB file size
- "Compact Database" button triggers VACUUM
- Displays before/after sizes on completion
- Button disabled while operation is in progress

### 4. Lazy-Loaded Pages

Replace eager imports in `App.tsx` with `React.lazy`:

```typescript
import { lazy, Suspense } from "react";
import Profiles from "./pages/Profiles"; // Keep eager — it's the default page

const RunTracker = lazy(() => import("./pages/RunTracker"));
const History = lazy(() => import("./pages/History"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Settings = lazy(() => import("./pages/Settings"));
const Comparison = lazy(() => import("./pages/Comparison"));
const DropCalculator = lazy(() => import("./pages/DropCalculator"));
const RouteEditor = lazy(() => import("./pages/RouteEditor"));
const HeraldTracker = lazy(() => import("./pages/HeraldTracker"));
const ColossalAncients = lazy(() => import("./pages/ColossalAncients"));
const DCloneTracker = lazy(() => import("./pages/DCloneTracker"));
const XPTracker = lazy(() => import("./pages/XPTracker"));
const CoopPanel = lazy(() => import("./pages/CoopPanel"));

// Wrap renderPage output:
<Suspense fallback={<PageSkeleton type={currentPage} />}>
  {renderPage()}
</Suspense>
```

**Note:** `RunTracker` is kept mounted across tab switches for session state preservation. It still uses `React.lazy` for initial load, but once loaded it stays in the DOM.

### 5. Loading Skeletons

A reusable `Skeleton` component system:

```typescript
// src/components/Skeleton.tsx
interface SkeletonProps {
  variant: "card" | "table-row" | "chart" | "text" | "page";
  count?: number;
  width?: string;
  height?: string;
}

function Skeleton({ variant, count = 1, width, height }: SkeletonProps) {
  return (
    <div className={`skeleton skeleton-${variant}`} style={{ width, height }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-shimmer" />
      ))}
    </div>
  );
}

// Page-level skeleton compositions:
function StatsSkeleton() {
  return (
    <div className="page">
      <Skeleton variant="text" width="200px" height="32px" />
      <div className="stats-grid">
        <Skeleton variant="card" count={8} />
      </div>
      <div className="charts-grid">
        <Skeleton variant="chart" count={2} />
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="page">
      <Skeleton variant="text" width="200px" height="32px" />
      <Skeleton variant="table-row" count={10} />
    </div>
  );
}
```

**CSS shimmer animation:**
```css
.skeleton-shimmer {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 6. Component Memoization

Key components to memoize:

- **History row component** — `React.memo(HistoryRow)` prevents re-render of all visible rows when one row expands
- **Statistics chart components** — each chart wrapped in `React.memo`
- **Stats grid cards** — `React.memo` on the stat card component
- **Filtered/computed data** — `useMemo` for `filteredStats`, `runTimeline`, `rarityData`, `topItems`

```typescript
const HistoryRow = React.memo(function HistoryRow({ data, index, style }: ListChildComponentProps) {
  const run = data[index];
  if (!run) return <div style={style} className="skeleton-shimmer" />;
  return (
    <div style={style} className="history-item">
      {/* row content */}
    </div>
  );
});
```

### 7. Rust Query Benchmarks

Add benchmarks using the `criterion` crate (or built-in Rust bench):

```rust
// benches/query_bench.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn setup_db(row_count: usize) -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    init_db(&conn).unwrap();
    // Seed row_count runs with random data
    for i in 0..row_count {
        // insert run + items
    }
    conn
}

fn bench_stats_combined(c: &mut Criterion) {
    let conn_10k = setup_db(10_000);
    let conn_50k = setup_db(50_000);
    let conn_100k = setup_db(100_000);

    c.bench_function("stats_combined_10k", |b| {
        b.iter(|| query_stats_combined(&conn_10k, "profile_1", None))
    });
    c.bench_function("stats_combined_50k", |b| {
        b.iter(|| query_stats_combined(&conn_50k, "profile_1", None))
    });
    c.bench_function("stats_combined_100k", |b| {
        b.iter(|| query_stats_combined(&conn_100k, "profile_1", None))
    });
}

fn bench_paginated_runs(c: &mut Criterion) {
    let conn_10k = setup_db(10_000);
    let conn_50k = setup_db(50_000);
    let conn_100k = setup_db(100_000);

    c.bench_function("paginated_10k", |b| {
        b.iter(|| query_runs_paginated(&conn_10k, "profile_1", 0, 100))
    });
    // ... 50k and 100k
}

criterion_group!(benches, bench_stats_combined, bench_paginated_runs);
criterion_main!(benches);
```

## Data Models

### CombinedStats (new Rust → Frontend)

```typescript
interface CombinedStats {
  summary: Stats;
  detailed_runs: DetailedRun[];
  routes: Route[];
}
```

### VacuumResult (new Rust → Frontend)

```typescript
interface VacuumResult {
  size_before_bytes: number;
  size_after_bytes: number;
  success: boolean;
}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| VACUUM fails (DB locked) | Show error message, re-enable button |
| Infinite scroll fetch fails | Show retry button at the end of the list, preserve loaded data |
| Combined stats query timeout | Show error with retry button, keep skeleton visible |
| Lazy chunk load fails | Suspense error boundary shows "Failed to load, click to retry" |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Virtual scroller DOM element bound

*For any* dataset size N ≥ 1 and any scroll position within the virtual list, the number of rendered run-row DOM elements SHALL be at most (visible_rows + 2 × overscan_count), and never exceed 100 elements regardless of N.

**Validates: Requirements 1.1, 1.3**

### Property 2: Combined stats response completeness

*For any* valid profile ID that has at least one completed run, calling `get_stats_combined` SHALL return a response object containing non-null `summary`, `detailed_runs`, and `routes` fields, where `summary.total_runs` equals the length of `detailed_runs`.

**Validates: Requirements 2.1**

### Property 3: Memoization referential stability

*For any* memoized computation (useMemo or React.memo), if the input dependencies have not changed between renders (referential equality), the output SHALL be the same reference (===) across consecutive renders.

**Validates: Requirements 2.3, 5.1, 5.2, 5.3**

## Performance Targets

| Metric | Target |
|--------|--------|
| History page DOM elements (10k+ runs) | < 100 row elements |
| Statistics page load (50k runs) | < 1 second |
| Initial app bundle load (lazy) | < 200ms for first paint |
| VACUUM on 100MB database | < 5 seconds |
| Virtual scroll fetch batch | 100 rows, < 50ms |

## Dependencies

**New npm packages:**
- `react-window` — Virtual list rendering
- `react-window-infinite-loader` — Infinite scroll integration with react-window

**New Rust dev-dependencies:**
- `criterion` — Benchmarking framework (dev-dependency only)
