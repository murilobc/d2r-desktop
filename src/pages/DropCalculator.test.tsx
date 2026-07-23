import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import DropCalculator from "./DropCalculator";
import { mockProfile } from "../test/mocks";
import type { DropProbabilityResult } from "../api";

// Mock the API module
vi.mock("../api", () => ({
  calculateDropProbability: vi.fn(),
  calculateCumulativeDistribution: vi.fn(),
  getAreaRunStats: vi.fn(),
  calculateLuckPercentile: vi.fn(),
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ReferenceLine: () => <div />,
}));

import {
  calculateDropProbability,
  calculateCumulativeDistribution,
  getAreaRunStats,
  calculateLuckPercentile,
} from "../api";

const mockedCalculateDropProbability = vi.mocked(calculateDropProbability);
const mockedCalculateCumulativeDistribution = vi.mocked(calculateCumulativeDistribution);
const mockedGetAreaRunStats = vi.mocked(getAreaRunStats);
const mockedCalculateLuckPercentile = vi.mocked(calculateLuckPercentile);

const mockDropResult: DropProbabilityResult = {
  probability: 0.000943,
  one_in_x: 1060.5,
  kills_for_50: 735,
  kills_for_63: 1061,
  kills_for_90: 2440,
  kills_for_99: 4880,
  effective_mf: 187.5,
  mf_applied: true,
};

describe("DropCalculator Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCalculateDropProbability.mockResolvedValue(mockDropResult);
    mockedCalculateCumulativeDistribution.mockResolvedValue([
      { kills: 0, cumulative_probability: 0 },
      { kills: 500, cumulative_probability: 0.38 },
      { kills: 1000, cumulative_probability: 0.61 },
    ]);
    mockedGetAreaRunStats.mockResolvedValue({
      area: "Worldstone Chamber",
      total_runs: 100,
      avg_duration_secs: 120,
      total_items_found: 5,
      item_counts: [{ item_name: "Shako", count: 2 }],
    });
    mockedCalculateLuckPercentile.mockResolvedValue({
      percentile: 65.0,
      expected_drops: 1.5,
      deviation: 0.5,
      deviation_sigma: 0.8,
    });
  });

  describe("Tab navigation", () => {
    it("renders without crashing with default areas tab", () => {
      render(<DropCalculator profile={mockProfile} />);
      // The areas tab should be active by default (has btn-primary class)
      const areasBtn = screen.getByText("Areas");
      expect(areasBtn).toHaveClass("btn-primary");
    });

    it("switches to probability tab on click", async () => {
      render(<DropCalculator profile={mockProfile} />);
      const probTab = screen.getByText("Probability");
      fireEvent.click(probTab);

      await waitFor(() => {
        expect(probTab).toHaveClass("btn-primary");
      });
    });
  });

  describe("ProbabilityTab - Input Validation", () => {
    it("shows MF validation error when MF > 9999", async () => {
      mockedCalculateDropProbability.mockResolvedValue(mockDropResult);

      render(<DropCalculator profile={mockProfile} />);
      // Switch to probability tab
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        expect(screen.getByLabelText("Magic Find")).toBeInTheDocument();
      });

      const mfInput = screen.getByLabelText("Magic Find");
      fireEvent.change(mfInput, { target: { value: "10000" } });

      await waitFor(() => {
        const errorEl = document.getElementById("dc-mf-error");
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveAttribute("role", "alert");
      });
    });

    it("does not show MF validation error for valid MF values", async () => {
      render(<DropCalculator profile={mockProfile} />);
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        expect(screen.getByLabelText("Magic Find")).toBeInTheDocument();
      });

      const mfInput = screen.getByLabelText("Magic Find");
      fireEvent.change(mfInput, { target: { value: "500" } });

      await waitFor(() => {
        expect(document.getElementById("dc-mf-error")).not.toBeInTheDocument();
      });
    });
  });

  describe("ProbabilityTab - Calculation trigger", () => {
    it("calls calculateDropProbability with correct params on config change", async () => {
      render(<DropCalculator profile={mockProfile} />);
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        expect(mockedCalculateDropProbability).toHaveBeenCalled();
      });

      // Default values: monster=baal, item=harlequin_crest, MF=300, players=1
      expect(mockedCalculateDropProbability).toHaveBeenCalledWith(
        expect.objectContaining({
          monster_id: "baal",
          item_id: "harlequin_crest",
          magic_find: 300,
          player_count: 1,
          quest_bonus: false,
          terror_zone: false,
          herald_tier: null,
        })
      );
    });

    it("recalculates when player count changes", async () => {
      render(<DropCalculator profile={mockProfile} />);
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        expect(mockedCalculateDropProbability).toHaveBeenCalled();
      });

      mockedCalculateDropProbability.mockClear();

      const playerSelect = screen.getByLabelText("Players");
      fireEvent.change(playerSelect, { target: { value: "3" } });

      await waitFor(() => {
        expect(mockedCalculateDropProbability).toHaveBeenCalledWith(
          expect.objectContaining({
            player_count: 3,
          })
        );
      });
    });
  });

  describe("ProbabilityTab - Result display", () => {
    it("displays result when API returns valid data", async () => {
      render(<DropCalculator profile={mockProfile} />);
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        // Should show the 1-in-X result
        expect(screen.getByText(/1,060.5/)).toBeInTheDocument();
      });
    });

    it("shows error message when API rejects", async () => {
      mockedCalculateDropProbability.mockRejectedValue(
        "Monster not found: unknown_monster"
      );

      render(<DropCalculator profile={mockProfile} />);
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        const alerts = screen.getAllByRole("alert");
        const errorAlert = alerts.find((el) =>
          el.textContent?.includes("Monster not found")
        );
        expect(errorAlert).toBeDefined();
      });
    });

    it('shows "item cannot drop" message when probability is 0', async () => {
      mockedCalculateDropProbability.mockResolvedValue({
        ...mockDropResult,
        probability: 0,
        one_in_x: 0,
      });

      render(<DropCalculator profile={mockProfile} />);
      fireEvent.click(screen.getByText("Probability"));

      await waitFor(() => {
        expect(
          screen.getByText("This item cannot drop from this monster")
        ).toBeInTheDocument();
      });
    });
  });
});
