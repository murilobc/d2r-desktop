import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DropCalculator from "./DropCalculator";
import { mockProfile } from "../test/mocks";
import type { DropProbabilityResult, AreaRunStats, LuckPercentileResult } from "../api";

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock the API module
vi.mock("../api", () => ({
  calculateDropProbability: vi.fn(),
  calculateCumulativeDistribution: vi.fn(),
  getAreaRunStats: vi.fn(),
  calculateLuckPercentile: vi.fn(),
}));

import {
  calculateDropProbability,
  getAreaRunStats,
  calculateLuckPercentile,
} from "../api";

const mockedCalculateDropProbability = vi.mocked(calculateDropProbability);
const mockedGetAreaRunStats = vi.mocked(getAreaRunStats);
const mockedCalculateLuckPercentile = vi.mocked(calculateLuckPercentile);

// ===== Mock Data =====

const mockDropResult: DropProbabilityResult = {
  probability: 0.000943,
  one_in_x: 1060.5,
  kills_for_50: 735,
  kills_for_63: 1061,
  kills_for_90: 2440,
  kills_for_99: 4885,
  effective_mf: 176.5,
  mf_applied: true,
};

const mockAreaStats: AreaRunStats = {
  area: "Worldstone Chamber",
  total_runs: 500,
  avg_duration_secs: 120,
  total_items_found: 25,
  item_counts: [
    { item_name: "Shako", count: 2 },
    { item_name: "Ber Rune", count: 1 },
  ],
};

const mockAreaStatsEmpty: AreaRunStats = {
  area: "Worldstone Chamber",
  total_runs: 0,
  avg_duration_secs: 0,
  total_items_found: 0,
  item_counts: [],
};

const mockLuckResult: LuckPercentileResult = {
  percentile: 78.5,
  expected_drops: 0.47,
  deviation: 1.53,
  deviation_sigma: 2.23,
};

// ===== Helper to render the ComparisonTab =====

function renderComparisonTab(profileId: string | null = mockProfile.id) {
  return render(
    <DropCalculator profile={profileId ? { ...mockProfile, id: profileId } : null} />
  );
}

describe("ComparisonTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCalculateDropProbability.mockResolvedValue(mockDropResult);
    mockedGetAreaRunStats.mockResolvedValue(mockAreaStats);
    mockedCalculateLuckPercentile.mockResolvedValue(mockLuckResult);
  });

  it("shows 'no profile' message when profileId is null", async () => {
    renderComparisonTab(null);

    // Click the comparison tab
    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      expect(screen.getByText(/select a profile/i)).toBeInTheDocument();
    });
  });

  it("calls APIs with correct params when profileId is set", async () => {
    renderComparisonTab("profile-1");

    // Click the comparison tab
    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      expect(mockedCalculateDropProbability).toHaveBeenCalledWith({
        monster_id: "baal",
        item_id: "harlequin_crest",
        magic_find: 300,
        player_count: 1,
        quest_bonus: false,
        terror_zone: false,
        herald_tier: null,
      });
    });

    expect(mockedGetAreaRunStats).toHaveBeenCalledWith("profile-1", "worldstone_chamber");
  });

  it("shows 'no run data' message when areaStats.total_runs is 0", async () => {
    mockedGetAreaRunStats.mockResolvedValue(mockAreaStatsEmpty);

    renderComparisonTab("profile-1");

    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      expect(screen.getByText(/no farming data/i)).toBeInTheDocument();
    });
  });

  it("renders chart and luck summary when data exists", async () => {
    renderComparisonTab("profile-1");

    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    // Luck summary should show the "above average" text since actual (2) > expected (500 * 0.000943 ≈ 0.47)
    await waitFor(() => {
      const summary = document.querySelector(".dc-luck-summary");
      expect(summary).not.toBeNull();
    });
  });

  it("renders luck summary text for above-average results", async () => {
    renderComparisonTab("profile-1");

    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    // With 2 actual drops and ~0.47 expected, the luck summary should indicate "above"
    await waitFor(() => {
      const summary = document.querySelector(".dc-luck-summary");
      expect(summary).not.toBeNull();
      expect(summary!.textContent).toBeTruthy();
    });
  });
});

describe("LuckGauge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCalculateDropProbability.mockResolvedValue(mockDropResult);
    mockedGetAreaRunStats.mockResolvedValue(mockAreaStats);
    mockedCalculateLuckPercentile.mockResolvedValue(mockLuckResult);
  });

  it("renders percentile value from API response", async () => {
    renderComparisonTab("profile-1");

    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      expect(mockedCalculateLuckPercentile).toHaveBeenCalledWith(
        2,    // actual drops (Shako count from mockAreaStats)
        500,  // total kills (total_runs from mockAreaStats)
        0.000943 // per-kill probability from mockDropResult
      );
    });

    await waitFor(() => {
      // The gauge should display 78.5% (from mockLuckResult.percentile)
      expect(screen.getByText("78.5%")).toBeInTheDocument();
    });
  });

  it("shows expected drops, deviation, and sigma values", async () => {
    renderComparisonTab("profile-1");

    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      // Expected drops from mockLuckResult
      expect(screen.getByText("0.47")).toBeInTheDocument();
    });

    // Deviation: +1.53
    expect(screen.getByText("+1.53")).toBeInTheDocument();

    // Sigma: +2.23σ
    expect(screen.getByText("+2.23σ")).toBeInTheDocument();
  });

  it("renders SVG gauge element", async () => {
    renderComparisonTab("profile-1");

    const comparisonTab = screen.getByText("Comparison");
    comparisonTab.click();

    await waitFor(() => {
      const gaugeContainer = document.querySelector(".dc-luck-gauge");
      expect(gaugeContainer).not.toBeNull();
    });

    const svg = document.querySelector(".dc-luck-gauge svg");
    expect(svg).not.toBeNull();
  });
});
