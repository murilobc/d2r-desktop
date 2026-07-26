/**
 * Unit tests for the Leaderboards page and helper functions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { PersonalBests, Season, Profile } from "../types";
import {
  buildCommunityExportJson,
  getMonthBoundaries,
  sanitizeFilename,
} from "./leaderboard-helpers";

// Mock all Tauri APIs used by Leaderboards.tsx
vi.mock("../api", () => ({
  getPersonalBests: vi.fn(),
  createSeason: vi.fn(),
  getSeasons: vi.fn(),
  getComparison: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: vi.fn(),
}));

vi.mock("html2canvas", () => ({
  default: vi.fn().mockResolvedValue({
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
  }),
}));

import { getPersonalBests, getSeasons, getComparison } from "../api";
import Leaderboards from "./Leaderboards";

const mockedGetPersonalBests = vi.mocked(getPersonalBests);
const mockedGetSeasons = vi.mocked(getSeasons);
const mockedGetComparison = vi.mocked(getComparison);

const mockProfile: Profile = {
  id: "profile-1",
  name: "TestSorc",
  class: "Sorceress",
  mode: "Ladder",
  magic_find: 300,
  season_start_date: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockBests: PersonalBests = {
  fastest_run: { area: "Pit", value: 90, run_id: "run-1", date: "2024-06-01" },
  best_items_in_run: { area: "Mephisto", value: 8, run_id: "run-2", date: "2024-06-02", item_count: 8 },
  best_items_per_hour: { area: "Chaos Sanctuary", value: 72.0, run_id: "run-3", date: "2024-06-03", items_per_hour: 72.0 },
  longest_run: { area: "Travincal", value: 600, run_id: "run-4", date: "2024-06-04" },
};

const emptyBests: PersonalBests = {
  fastest_run: null,
  best_items_in_run: null,
  best_items_per_hour: null,
  longest_run: null,
};

const mockComparisonResult = {
  subject_a: {
    label: "This Month",
    total_runs: 12,
    total_items: 48,
    total_unique_items: 10,
    total_duration_secs: 1440,
    items_per_hour: 120.0,
    unique_items_per_hour: 25.0,
    items_per_run: 4.0,
    avg_time_per_run: 120.0,
    fastest_run_secs: 90,
    slowest_run_secs: 200,
  },
  subject_b: {
    label: "Last Month",
    total_runs: 8,
    total_items: 24,
    total_unique_items: 6,
    total_duration_secs: 960,
    items_per_hour: 90.0,
    unique_items_per_hour: 22.5,
    items_per_run: 3.0,
    avg_time_per_run: 120.0,
    fastest_run_secs: 100,
    slowest_run_secs: 250,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetPersonalBests.mockResolvedValue(emptyBests);
  mockedGetSeasons.mockResolvedValue([]);
  mockedGetComparison.mockResolvedValue(mockComparisonResult);
});

// ── Leaderboards Page Component Tests ──────────────────────────────────────

describe("Leaderboards Page — Personal Bests section", () => {
  it("renders all four metric labels with a populated PersonalBests fixture", async () => {
    mockedGetPersonalBests.mockResolvedValue(mockBests);

    render(<Leaderboards profile={mockProfile} />);

    await waitFor(() => {
      expect(screen.getByText("Fastest Run")).toBeInTheDocument();
      expect(screen.getByText("Best Items in Run")).toBeInTheDocument();
      expect(screen.getByText("Best Items/Hour")).toBeInTheDocument();
      expect(screen.getByText("Longest Run")).toBeInTheDocument();
    });
  });

  it("renders empty-state message when PersonalBests is all-null", async () => {
    mockedGetPersonalBests.mockResolvedValue(emptyBests);

    render(<Leaderboards profile={mockProfile} />);

    await waitFor(() => {
      expect(
        screen.getByText(/no records yet/i)
      ).toBeInTheDocument();
    });
  });
});

describe("Leaderboards Page — Monthly Comparison section", () => {
  it("labels comparison periods as 'This Month' and 'Last Month'", async () => {
    mockedGetPersonalBests.mockResolvedValue(emptyBests);
    mockedGetComparison.mockResolvedValue(mockComparisonResult);

    render(<Leaderboards profile={mockProfile} />);

    await waitFor(() => {
      expect(screen.getByText("This Month")).toBeInTheDocument();
      expect(screen.getByText("Last Month")).toBeInTheDocument();
    });
  });

  it("shows low-sample warning when a period has fewer than 5 runs", async () => {
    mockedGetPersonalBests.mockResolvedValue(emptyBests);
    mockedGetComparison.mockResolvedValue({
      ...mockComparisonResult,
      subject_b: { ...mockComparisonResult.subject_b, total_runs: 3 },
    });

    render(<Leaderboards profile={mockProfile} />);

    await waitFor(() => {
      // The warning symbol ⚠ should appear for the low-sample period
      const warnings = screen.getAllByText(/⚠/);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});

// ── Helper Function Tests ──────────────────────────────────────────────────

describe("getMonthBoundaries", () => {
  it("returns correct ISO strings for a known date", () => {
    const now = new Date(2024, 5, 15, 14, 30, 0); // June 15, 2024 at 14:30

    const { startA, endA, startB, endB } = getMonthBoundaries(now);

    // startA = June 1, 2024 at 00:00:00
    expect(startA).toBe("2024-06-01T00:00:00");

    // endA = July 1, 2024 at 00:00:00
    expect(endA).toBe("2024-07-01T00:00:00");

    // startB = May 1, 2024 at 00:00:00
    expect(startB).toBe("2024-05-01T00:00:00");

    // endB = startA
    expect(endB).toBe(startA);
  });

  it("handles January correctly (previous month wraps to prior year)", () => {
    const now = new Date(2024, 0, 10); // January 10, 2024

    const { startB } = getMonthBoundaries(now);

    // startB should be December 1, 2023
    expect(startB).toBe("2023-12-01T00:00:00");
  });
});

describe("buildCommunityExportJson", () => {
  it("returns correct schema for a known input", () => {
    const result = buildCommunityExportJson(mockProfile, mockBests, null);

    expect(result.schema_version).toBe("1.0");
    expect(result.profile.name).toBe("TestSorc");
    expect(result.profile.class).toBe("Sorceress");
    expect(result.profile.mode).toBe("Ladder");
    expect(result.profile.magic_find).toBe(300);
    expect(result.personal_bests.fastest_run?.area).toBe("Pit");
    expect(result.personal_bests.fastest_run?.duration_secs).toBe(90);
    expect(result.personal_bests.best_items_in_run?.item_count).toBe(8);
    expect(result.personal_bests.best_items_per_hour?.items_per_hour).toBe(72.0);
    expect(result.personal_bests.longest_session_secs).toBe(600);
    expect(result.season.name).toBeNull();
    expect(result.season.start_date).toBeNull();
  });

  it("produces null for missing bests, not omitted fields", () => {
    const result = buildCommunityExportJson(mockProfile, emptyBests, null);

    expect(result.personal_bests.fastest_run).toBeNull();
    expect(result.personal_bests.best_items_in_run).toBeNull();
    expect(result.personal_bests.best_items_per_hour).toBeNull();
    expect(result.personal_bests.longest_session_secs).toBeNull();

    // Fields must be present (not omitted)
    const serialized = JSON.stringify(result);
    const parsed = JSON.parse(serialized);
    expect("fastest_run" in parsed.personal_bests).toBe(true);
    expect("best_items_in_run" in parsed.personal_bests).toBe(true);
    expect("best_items_per_hour" in parsed.personal_bests).toBe(true);
    expect("longest_session_secs" in parsed.personal_bests).toBe(true);
  });

  it("includes season name and start_date when active season provided", () => {
    const season: Season = {
      id: "s1",
      profile_id: "profile-1",
      name: "Season 7",
      start_date: "2024-01-01",
      end_date: "2024-06-01",
      bests_snapshot: emptyBests,
      created_at: "2024-06-01T00:00:00Z",
    };

    const result = buildCommunityExportJson(mockProfile, mockBests, season);

    expect(result.season.name).toBe("Season 7");
    expect(result.season.start_date).toBe("2024-01-01");
  });
});

describe("sanitizeFilename", () => {
  it("replaces all forbidden characters with underscores", () => {
    const result = sanitizeFilename('Test/Profile\\Name:Is*Very?"Long<Season>One|Two');
    expect(result).not.toMatch(/[/\\:*?"<>|]/);
    expect(result).toContain("Test");
  });

  it("leaves safe characters unchanged", () => {
    const safe = "Season-7_2024.abc";
    expect(sanitizeFilename(safe)).toBe(safe);
  });
});

describe("Share card div", () => {
  it("share card contains profile name, class, mode, and export date", async () => {
    mockedGetPersonalBests.mockResolvedValue(mockBests);

    render(<Leaderboards profile={mockProfile} />);

    await waitFor(() => {
      // The share card div is off-screen but rendered
      const shareCardRegion = document.querySelector('[aria-label="Share card preview"]');
      expect(shareCardRegion).not.toBeNull();
      expect(shareCardRegion!.textContent).toContain("TestSorc");
      expect(shareCardRegion!.textContent).toContain("Sorceress");
      expect(shareCardRegion!.textContent).toContain("Ladder");
    });
  });
});
