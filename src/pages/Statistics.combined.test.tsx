import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import Statistics from "./Statistics";
import { mockProfile, mockRuns, mockItems, mockStats } from "../test/mocks";
import type { CombinedStats, DetailedRun } from "../types";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

const mockDetailedRuns: DetailedRun[] = mockRuns.map((run) => ({
  run,
  items: run.id === "run-1" ? mockItems : [],
}));

const mockCombinedStats: CombinedStats = {
  summary: mockStats,
  detailed_runs: mockDetailedRuns,
  routes: [],
};

describe("Statistics Page - Combined Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_stats_combined") return mockCombinedStats;
      if (cmd === "get_route_stats") return null;
      return undefined;
    });
  });

  it("calls getStatsCombined once on mount", async () => {
    render(<Statistics profile={mockProfile} />);

    await waitFor(() => {
      const calls = mockInvoke.mock.calls.filter(([cmd]) => cmd === "get_stats_combined");
      expect(calls.length).toBe(1);
    });
  });

  it("passes correct profile_id to combined stats call", async () => {
    render(<Statistics profile={mockProfile} />);

    await waitFor(() => {
      const call = mockInvoke.mock.calls.find(([cmd]) => cmd === "get_stats_combined");
      expect(call).toBeDefined();
      expect(call![1]).toEqual({ profileId: "profile-1", areaFilter: null });
    });
  });

  it("area filter triggers new combined call with filter", async () => {
    render(<Statistics profile={mockProfile} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("Statistics")).toBeInTheDocument();
    });

    // Change area filter
    const areaSelect = screen.getByDisplayValue("All areas");
    fireEvent.change(areaSelect, { target: { value: "Mephisto" } });

    await waitFor(() => {
      const calls = mockInvoke.mock.calls.filter(([cmd]) => cmd === "get_stats_combined");
      expect(calls.length).toBe(2);
      expect(calls[1][1]).toEqual({ profileId: "profile-1", areaFilter: "Mephisto" });
    });
  });

  it("shows loading state initially", () => {
    // Mock a slow response
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_stats_combined") {
        return new Promise(() => {}); // Never resolves
      }
      return undefined;
    });

    render(<Statistics profile={mockProfile} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  /**
   * Task 1.3: Combined stats property test (simple example)
   * **Validates: Requirements 2.1**
   *
   * For any profile with runs, getStatsCombined returns valid data
   * and the component displays summary statistics computed from detailed_runs.
   */
  it("displays summary data from combined stats response", async () => {
    const { container } = render(<Statistics profile={mockProfile} />);

    await waitFor(() => {
      // Find stat cards and verify they contain the expected data
      const statCards = container.querySelectorAll(".stat-card");
      expect(statCards.length).toBeGreaterThan(0);

      // First stat card should be "Total Runs" = 3
      const totalRunsCard = Array.from(statCards).find(
        (card) => card.querySelector(".stat-label")?.textContent === "Total Runs"
      );
      expect(totalRunsCard).toBeDefined();
      expect(totalRunsCard!.querySelector(".stat-value")?.textContent).toBe("3");

      // Second stat card should be "Total Items" = 2
      const totalItemsCard = Array.from(statCards).find(
        (card) => card.querySelector(".stat-label")?.textContent === "Total Items"
      );
      expect(totalItemsCard).toBeDefined();
      expect(totalItemsCard!.querySelector(".stat-value")?.textContent).toBe("2");
    });
  });

  it("displays stats cards with correct labels", async () => {
    render(<Statistics profile={mockProfile} />);

    await waitFor(() => {
      expect(screen.getByText("Total Runs")).toBeInTheDocument();
      expect(screen.getByText("Total Items")).toBeInTheDocument();
      expect(screen.getByText("Total Time")).toBeInTheDocument();
    });
  });

  /**
   * Task 7.3: Memoization referential stability (smoke test)
   * **Validates: Requirements 2.3, 5.1, 5.2, 5.3**
   *
   * Rendering the Statistics page with the same props should not cause
   * excessive re-renders. This is a basic smoke test that verifies
   * the component renders correctly without errors when rendered with same data.
   */
  it("renders consistently with same props (memoization smoke test)", async () => {
    const { container, unmount } = render(<Statistics profile={mockProfile} />);

    await waitFor(() => {
      const statCards = container.querySelectorAll(".stat-card");
      expect(statCards.length).toBeGreaterThan(0);
    });

    unmount();

    // Re-render with same profile
    const { container: container2 } = render(<Statistics profile={mockProfile} />);

    await waitFor(() => {
      const statCards = container2.querySelectorAll(".stat-card");
      expect(statCards.length).toBeGreaterThan(0);

      const totalRunsCard = Array.from(statCards).find(
        (card) => card.querySelector(".stat-label")?.textContent === "Total Runs"
      );
      expect(totalRunsCard!.querySelector(".stat-value")?.textContent).toBe("3");
    });

    // Verify that the combined stats call was made for each render (once per mount)
    const calls = mockInvoke.mock.calls.filter(([cmd]) => cmd === "get_stats_combined");
    expect(calls.length).toBe(2); // One per mount, not extra
  });
});
