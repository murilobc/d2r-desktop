import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Advisor from "./Advisor";
import { mockProfile } from "../test/mocks";
import type { CombinedStats, DetailedRun, Run, Item } from "../types";

// Mock the API module
vi.mock("../api", () => ({
  getStatsCombined: vi.fn(),
  getXpEntries: vi.fn(),
}));

// Mock terror-zones data module
vi.mock("../data/terror-zones", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/terror-zones")>();
  return {
    ...actual,
    loadCurrentTZ: vi.fn().mockReturnValue(null),
  };
});

import { getStatsCombined, getXpEntries } from "../api";
import { loadCurrentTZ } from "../data/terror-zones";

const mockedGetStatsCombined = vi.mocked(getStatsCombined);
const mockedGetXpEntries = vi.mocked(getXpEntries);
const mockedLoadCurrentTZ = vi.mocked(loadCurrentTZ);

// Helper: create a DetailedRun with items
function makeDetailedRun(overrides: Partial<Run> & { items?: Item[] } = {}): DetailedRun {
  const { items = [], ...runOverrides } = overrides;
  const run: Run = {
    id: `run-${Math.random().toString(36).slice(2)}`,
    profile_id: "profile-1",
    area: "Mephisto",
    duration_secs: 120,
    started_at: "2026-06-15T14:00:00Z",
    finished_at: "2026-06-15T14:02:00Z",
    status: "completed",
    notes: null,
    player_count: 1,
    route_id: null,
    route_step_index: null,
    tags: null,
    ...runOverrides,
  };
  return { run, items };
}

// Helper: create empty CombinedStats
function makeEmptyCombinedStats(): CombinedStats {
  return {
    summary: {
      total_runs: 0,
      total_items: 0,
      total_time_secs: 0,
      avg_run_duration_secs: 0,
      items_per_run: 0,
      items_by_rarity: [],
      runs_by_area: [],
    },
    detailed_runs: [],
    routes: [],
  };
}

// Helper: create CombinedStats with enough data for area rankings
function makeCombinedStatsWithRuns(): CombinedStats {
  const now = new Date();
  const runs: DetailedRun[] = [];

  // Create 5 runs for "Mephisto" area (above 3-run threshold)
  for (let i = 0; i < 5; i++) {
    const startedAt = new Date(now.getTime() - (i + 1) * 3600000).toISOString();
    runs.push(
      makeDetailedRun({
        id: `run-meph-${i}`,
        area: "Mephisto",
        duration_secs: 120,
        started_at: startedAt,
        finished_at: new Date(new Date(startedAt).getTime() + 120000).toISOString(),
        items: [
          {
            id: `item-${i}`,
            run_id: `run-meph-${i}`,
            profile_id: "profile-1",
            name: "Harlequin Crest",
            item_type: "Armor",
            rarity: "Unique",
            found_at: startedAt,
            notes: null,
          },
        ],
      })
    );
  }

  // Create 4 runs for "Ancient Tunnels" (above 3-run threshold)
  for (let i = 0; i < 4; i++) {
    const startedAt = new Date(now.getTime() - (i + 6) * 3600000).toISOString();
    runs.push(
      makeDetailedRun({
        id: `run-at-${i}`,
        area: "Ancient Tunnels",
        duration_secs: 180,
        started_at: startedAt,
        finished_at: new Date(new Date(startedAt).getTime() + 180000).toISOString(),
        items: [
          {
            id: `item-at-${i}`,
            run_id: `run-at-${i}`,
            profile_id: "profile-1",
            name: "Ist Rune",
            item_type: "Rune",
            rarity: "Rune",
            found_at: startedAt,
            notes: null,
          },
        ],
      })
    );
  }

  return {
    summary: {
      total_runs: runs.length,
      total_items: runs.reduce((sum, r) => sum + r.items.length, 0),
      total_time_secs: runs.reduce((sum, r) => sum + r.run.duration_secs, 0),
      avg_run_duration_secs: 150,
      items_per_run: 1,
      items_by_rarity: [{ rarity: "Unique", count: 5 }, { rarity: "Rune", count: 4 }],
      runs_by_area: [
        { area: "Mephisto", count: 5 },
        { area: "Ancient Tunnels", count: 4 },
      ],
    },
    detailed_runs: runs,
    routes: [],
  };
}

describe("Advisor Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLoadCurrentTZ.mockReturnValue(null);
  });

  describe("Loading state", () => {
    it("shows loading skeleton while data is being fetched", () => {
      // Never resolve the promises to keep loading state
      mockedGetStatsCombined.mockReturnValue(new Promise(() => {}));
      mockedGetXpEntries.mockReturnValue(new Promise(() => {}));

      render(<Advisor profile={mockProfile} />);

      // The Skeleton component renders divs with skeleton-shimmer class
      const skeletons = document.querySelectorAll(".skeleton-shimmer");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("calls getStatsCombined and getXpEntries with the profile id", () => {
      mockedGetStatsCombined.mockReturnValue(new Promise(() => {}));
      mockedGetXpEntries.mockReturnValue(new Promise(() => {}));

      render(<Advisor profile={mockProfile} />);

      expect(mockedGetStatsCombined).toHaveBeenCalledWith("profile-1");
      expect(mockedGetXpEntries).toHaveBeenCalledWith("profile-1");
    });
  });

  describe("Empty state (zero runs)", () => {
    beforeEach(() => {
      mockedGetStatsCombined.mockResolvedValue(makeEmptyCombinedStats());
      mockedGetXpEntries.mockResolvedValue([]);
    });

    it("shows weekly summary empty message when profile has no recent runs", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Insufficient data for weekly summary.")).toBeInTheDocument();
      });
    });

    it("shows area rankings empty message when no areas have enough runs", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(
          screen.getByText("Not enough data to rank areas (minimum 3 runs per area).")
        ).toBeInTheDocument();
      });
    });

    it("shows build suggestions empty message with no data", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(
          screen.getByText("No build-specific suggestions available.")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Renders sub-components with valid data", () => {
    beforeEach(() => {
      mockedGetStatsCombined.mockResolvedValue(makeCombinedStatsWithRuns());
      mockedGetXpEntries.mockResolvedValue([]);
    });

    it("renders the page title after loading", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Farming Advisor")).toBeInTheDocument();
      });
    });

    it("renders WeeklySummaryCard with summary heading", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Weekly Summary")).toBeInTheDocument();
      });
    });

    it("renders AreaRankingTable with area data", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Area Rankings")).toBeInTheDocument();
      });

      // Areas should appear in table rows
      const table = document.querySelector(".stats-table");
      expect(table).not.toBeNull();
      expect(table!.textContent).toContain("Mephisto");
      expect(table!.textContent).toContain("Ancient Tunnels");
    });

    it("renders BuildSuggestions section", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Build Suggestions")).toBeInTheDocument();
      });
    });

    it("does not render TerrorZoneRecommendation when no active TZ", async () => {
      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("Farming Advisor")).toBeInTheDocument();
      });

      // TZ heading should not be rendered when no active TZ
      expect(screen.queryByText("Terror Zone")).not.toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("shows error toast when API call fails", async () => {
      mockedGetStatsCombined.mockRejectedValue(new Error("Network error"));
      mockedGetXpEntries.mockRejectedValue(new Error("Network error"));

      render(<Advisor profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
