import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WeeklySummaryCard from "./WeeklySummaryCard";
import AreaRankingTable from "./AreaRankingTable";
import DiminishingReturnsAlert from "./DiminishingReturnsAlert";
import TerrorZoneRecommendation from "./TerrorZoneRecommendation";
import BuildSuggestions from "./BuildSuggestions";
import type { WeeklySummary, TZRecommendation, DiminishingReturnsAlert as DRAlertType, BuildSuggestion, AreaMetrics } from "../advisor/advisor-engine";
import type { DetailedRun, XpEntry } from "../types";

// Mock the advisor-engine computeAreaRankings for AreaRankingTable tests
const mockRankings: AreaMetrics[] = [
  { area: "Pit", totalRuns: 10, totalTimeSecs: 3600, totalItems: 20, totalValuePoints: 100, totalXp: 50000, itemsPerHour: 20, valuePointsPerHour: 100, xpPerHour: 50000 },
  { area: "Chaos Sanctuary", totalRuns: 8, totalTimeSecs: 4800, totalItems: 15, totalValuePoints: 80, totalXp: 80000, itemsPerHour: 11.3, valuePointsPerHour: 60, xpPerHour: 60000 },
  { area: "Ancient Tunnels", totalRuns: 5, totalTimeSecs: 2400, totalItems: 12, totalValuePoints: 60, totalXp: 30000, itemsPerHour: 18, valuePointsPerHour: 90, xpPerHour: 45000 },
];

vi.mock("../advisor/advisor-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../advisor/advisor-engine")>();
  return {
    ...actual,
    computeAreaRankings: vi.fn(() => mockRankings),
  };
});

describe("WeeklySummaryCard", () => {
  it("shows empty state message when summary is null", () => {
    render(<WeeklySummaryCard summary={null} />);
    expect(screen.getByText("Insufficient data for weekly summary.")).toBeInTheDocument();
  });

  it("renders heading when summary is null", () => {
    render(<WeeklySummaryCard summary={null} />);
    expect(screen.getByText("Weekly Summary")).toBeInTheDocument();
  });

  it("renders totalRuns when summary is provided", () => {
    const summary: WeeklySummary = {
      totalRuns: 42,
      avgItemsPerHour: 15.3,
      totalValuePoints: 850,
      bestArea: "Pit",
      bestAreaPercentageAboveAvg: 25.5,
    };
    render(<WeeklySummaryCard summary={summary} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders avgItemsPerHour when summary is provided", () => {
    const summary: WeeklySummary = {
      totalRuns: 42,
      avgItemsPerHour: 15.3,
      totalValuePoints: 850,
      bestArea: "Pit",
      bestAreaPercentageAboveAvg: 25.5,
    };
    render(<WeeklySummaryCard summary={summary} />);
    expect(screen.getByText("15.3")).toBeInTheDocument();
  });

  it("renders totalValuePoints when summary is provided", () => {
    const summary: WeeklySummary = {
      totalRuns: 42,
      avgItemsPerHour: 15.3,
      totalValuePoints: 850,
      bestArea: "Pit",
      bestAreaPercentageAboveAvg: 25.5,
    };
    render(<WeeklySummaryCard summary={summary} />);
    expect(screen.getByText("850")).toBeInTheDocument();
  });

  it("renders bestArea when summary is provided", () => {
    const summary: WeeklySummary = {
      totalRuns: 42,
      avgItemsPerHour: 15.3,
      totalValuePoints: 850,
      bestArea: "Pit",
      bestAreaPercentageAboveAvg: 25.5,
    };
    render(<WeeklySummaryCard summary={summary} />);
    expect(screen.getByText(/Pit/)).toBeInTheDocument();
  });

  it("does not render bestArea section when bestArea is null", () => {
    const summary: WeeklySummary = {
      totalRuns: 5,
      avgItemsPerHour: 10,
      totalValuePoints: 200,
      bestArea: null,
      bestAreaPercentageAboveAvg: 0,
    };
    render(<WeeklySummaryCard summary={summary} />);
    expect(screen.queryByText("Best Area")).not.toBeInTheDocument();
  });
});

describe("AreaRankingTable", () => {
  const detailedRuns: DetailedRun[] = [];
  const xpEntries: XpEntry[] = [];

  it("renders area names in the table", () => {
    render(<AreaRankingTable detailedRuns={detailedRuns} xpEntries={xpEntries} />);
    expect(screen.getByText("Pit")).toBeInTheDocument();
    expect(screen.getByText("Chaos Sanctuary")).toBeInTheDocument();
    expect(screen.getByText("Ancient Tunnels")).toBeInTheDocument();
  });

  it("renders table heading", () => {
    render(<AreaRankingTable detailedRuns={detailedRuns} xpEntries={xpEntries} />);
    expect(screen.getByText("Area Rankings")).toBeInTheDocument();
  });

  it("default sort is valuePointsPerHour (aria-sort descending)", () => {
    render(<AreaRankingTable detailedRuns={detailedRuns} xpEntries={xpEntries} />);
    // The value/hr column should have aria-sort="descending" by default
    const valueHeader = screen.getByText("Value/hr").closest("th");
    expect(valueHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("clicking Items/hr column changes sort highlight", () => {
    render(<AreaRankingTable detailedRuns={detailedRuns} xpEntries={xpEntries} />);
    
    const itemsButton = screen.getByRole("button", { name: "Items/hr" });
    fireEvent.click(itemsButton);

    const itemsHeader = screen.getByText("Items/hr").closest("th");
    expect(itemsHeader).toHaveAttribute("aria-sort", "descending");

    // Value/hr should no longer be active
    const valueHeader = screen.getByText("Value/hr").closest("th");
    expect(valueHeader).toHaveAttribute("aria-sort", "none");
  });

  it("clicking XP/hr column changes sort highlight", () => {
    render(<AreaRankingTable detailedRuns={detailedRuns} xpEntries={xpEntries} />);
    
    const xpButton = screen.getByRole("button", { name: "XP/hr" });
    fireEvent.click(xpButton);

    const xpHeader = screen.getByText("XP/hr").closest("th");
    expect(xpHeader).toHaveAttribute("aria-sort", "descending");
  });
});

describe("DiminishingReturnsAlert", () => {
  it("renders nothing when alerts is empty", () => {
    const { container } = render(<DiminishingReturnsAlert alerts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders area name and consecutive dry run count", () => {
    const alerts: DRAlertType[] = [
      { area: "Mephisto", consecutiveDryRuns: 7, suggestedAlternative: "Pit" },
    ];
    render(<DiminishingReturnsAlert alerts={alerts} />);
    expect(screen.getByText("Mephisto has had 7 consecutive dry runs.")).toBeInTheDocument();
  });

  it("shows suggested alternative area", () => {
    const alerts: DRAlertType[] = [
      { area: "Mephisto", consecutiveDryRuns: 5, suggestedAlternative: "Chaos Sanctuary" },
    ];
    render(<DiminishingReturnsAlert alerts={alerts} />);
    expect(screen.getByText("Consider switching to Chaos Sanctuary.")).toBeInTheDocument();
  });

  it("renders multiple alerts", () => {
    const alerts: DRAlertType[] = [
      { area: "Mephisto", consecutiveDryRuns: 7, suggestedAlternative: "Pit" },
      { area: "Baal", consecutiveDryRuns: 5, suggestedAlternative: "Chaos Sanctuary" },
    ];
    render(<DiminishingReturnsAlert alerts={alerts} />);
    expect(screen.getByText("Mephisto has had 7 consecutive dry runs.")).toBeInTheDocument();
    expect(screen.getByText("Baal has had 5 consecutive dry runs.")).toBeInTheDocument();
  });

  it("does not show suggestion when suggestedAlternative is null", () => {
    const alerts: DRAlertType[] = [
      { area: "Mephisto", consecutiveDryRuns: 6, suggestedAlternative: null },
    ];
    render(<DiminishingReturnsAlert alerts={alerts} />);
    expect(screen.getByText("Mephisto has had 6 consecutive dry runs.")).toBeInTheDocument();
    expect(screen.queryByText(/Consider switching/)).not.toBeInTheDocument();
  });
});

describe("TerrorZoneRecommendation", () => {
  it("renders nothing when recommendation is null", () => {
    const { container } = render(<TerrorZoneRecommendation recommendation={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows tier-only message when hasPersonalData is false", () => {
    const recommendation: TZRecommendation = {
      zoneName: "Pit",
      tier: "A",
      hasPersonalData: false,
      valuePointsPerHour: null,
      globalAvgValuePointsPerHour: null,
      percentageAdvantage: null,
      isRecommended: false,
    };
    render(<TerrorZoneRecommendation recommendation={recommendation} />);
    expect(screen.getByText("Pit is rated A-tier. No personal data yet.")).toBeInTheDocument();
  });

  it("shows percentage when isRecommended is true", () => {
    const recommendation: TZRecommendation = {
      zoneName: "Chaos Sanctuary",
      tier: "S",
      hasPersonalData: true,
      valuePointsPerHour: 120,
      globalAvgValuePointsPerHour: 100,
      percentageAdvantage: 20,
      isRecommended: true,
    };
    render(<TerrorZoneRecommendation recommendation={recommendation} />);
    expect(screen.getByText("Chaos Sanctuary is 20% more efficient than your average — recommended!")).toBeInTheDocument();
  });

  it("renders tier badge", () => {
    const recommendation: TZRecommendation = {
      zoneName: "Pit",
      tier: "A",
      hasPersonalData: false,
      valuePointsPerHour: null,
      globalAvgValuePointsPerHour: null,
      percentageAdvantage: null,
      isRecommended: false,
    };
    render(<TerrorZoneRecommendation recommendation={recommendation} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders heading when recommendation exists", () => {
    const recommendation: TZRecommendation = {
      zoneName: "Pit",
      tier: "B",
      hasPersonalData: true,
      valuePointsPerHour: 50,
      globalAvgValuePointsPerHour: 55,
      percentageAdvantage: -9.1,
      isRecommended: false,
    };
    render(<TerrorZoneRecommendation recommendation={recommendation} />);
    expect(screen.getByText("Terror Zone")).toBeInTheDocument();
  });
});

describe("BuildSuggestions", () => {
  it("shows empty state when suggestions is empty", () => {
    render(<BuildSuggestions suggestions={[]} />);
    expect(screen.getByText("No build-specific suggestions available.")).toBeInTheDocument();
  });

  it("renders area names when suggestions exist", () => {
    const suggestions: BuildSuggestion[] = [
      { area: "Ancient Tunnels", annotation: "no cold immunes", tzNote: null },
      { area: "Pit", annotation: null, tzNote: null },
    ];
    render(<BuildSuggestions suggestions={suggestions} />);
    expect(screen.getByText("Ancient Tunnels")).toBeInTheDocument();
    expect(screen.getByText("Pit")).toBeInTheDocument();
  });

  it("shows 'no cold immunes' badge when annotation is present (Sorceress)", () => {
    const suggestions: BuildSuggestion[] = [
      { area: "Ancient Tunnels", annotation: "no cold immunes", tzNote: null },
    ];
    render(<BuildSuggestions suggestions={suggestions} />);
    expect(screen.getByText("No cold immunes")).toBeInTheDocument();
  });

  it("does not show badge when annotation is null", () => {
    const suggestions: BuildSuggestion[] = [
      { area: "Pit", annotation: null, tzNote: null },
    ];
    render(<BuildSuggestions suggestions={suggestions} />);
    expect(screen.queryByText("No cold immunes")).not.toBeInTheDocument();
  });

  it("renders heading", () => {
    render(<BuildSuggestions suggestions={[]} />);
    expect(screen.getByText("Build Suggestions")).toBeInTheDocument();
  });

  it("shows TZ notes when present", () => {
    const suggestions: BuildSuggestion[] = [
      { area: "Chaos Sanctuary", annotation: null, tzNote: "Best for XP and items" },
    ];
    render(<BuildSuggestions suggestions={suggestions} />);
    expect(screen.getByText("Best for XP and items")).toBeInTheDocument();
  });
});
