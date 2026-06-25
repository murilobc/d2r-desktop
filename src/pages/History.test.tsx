import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import History from "./History";
import { mockProfile, mockRuns, mockItems } from "../test/mocks";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("History Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === "get_runs") return mockRuns;
      if (cmd === "get_runs_paginated") return { runs: mockRuns, total: mockRuns.length };
      if (cmd === "get_items") {
        const { runId } = args as { runId: string };
        if (runId === "run-1") return mockItems;
        return [];
      }
      if (cmd === "get_stats") return {
        total_runs: mockRuns.length,
        total_items: mockItems.length,
        total_time_secs: 600,
        avg_run_duration_secs: 120,
        items_per_run: 1.0,
        items_by_rarity: [],
        runs_by_area: [
          { area: "Mephisto", count: 2 },
          { area: "Ancient Tunnels", count: 1 },
        ],
      };
      return undefined;
    });
  });

  it("renders history page title", async () => {
    render(<History profile={mockProfile} />);
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("displays runs with area and run number", async () => {
    render(<History profile={mockProfile} />);
    await waitFor(() => {
      const areas = screen.getAllByText(/Mephisto/);
      expect(areas.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Ancient Tunnels/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("auto-expands runs with items", async () => {
    render(<History profile={mockProfile} />);
    await waitFor(() => {
      // Items from run-1 should be visible since it has items
      expect(screen.getByText("Harlequin Crest")).toBeInTheDocument();
      expect(screen.getByText("Ist Rune")).toBeInTheDocument();
    });
  });

  it("shows run count in badge", async () => {
    render(<History profile={mockProfile} />);
    await waitFor(() => {
      expect(screen.getByText(`TestSorc - ${mockRuns.length} runs`)).toBeInTheDocument();
    });
  });

  it("shows empty state when no runs", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_runs") return [];
      if (cmd === "get_runs_paginated") return { runs: [], total: 0 };
      if (cmd === "get_stats") return {
        total_runs: 0, total_items: 0, total_time_secs: 0,
        avg_run_duration_secs: 0, items_per_run: 0,
        items_by_rarity: [], runs_by_area: [],
      };
      return undefined;
    });

    render(<History profile={mockProfile} />);
    await waitFor(() => {
      expect(screen.getByText("No completed runs yet.")).toBeInTheDocument();
    });
  });
});
