import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import History from "./History";
import { mockProfile } from "../test/mocks";
import type { Run } from "../types";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

/**
 * Task 4.3: Virtual scroller DOM element bound
 * **Validates: Requirements 1.1, 1.3**
 *
 * Property 1: For any dataset size N ≥ 1 and any scroll position,
 * the number of rendered run-row DOM elements SHALL never exceed 100.
 *
 * This test verifies that with 10,000 runs, the virtual scroller
 * renders fewer than 100 row elements in the DOM.
 */
describe("History Page - Virtual Scroller DOM Bound", () => {
  const TOTAL_RUNS = 10000;

  // Generate a batch of mock runs
  function generateMockRuns(offset: number, limit: number): Run[] {
    const runs: Run[] = [];
    for (let i = 0; i < limit; i++) {
      const idx = offset + i;
      runs.push({
        id: `run-${idx}`,
        profile_id: "profile-1",
        area: "Mephisto",
        duration_secs: 120,
        started_at: `2026-06-15T14:${String(idx % 60).padStart(2, "0")}:00Z`,
        finished_at: `2026-06-15T14:${String(idx % 60).padStart(2, "0")}:02Z`,
        status: "completed",
        notes: null,
        player_count: 1,
        route_id: null,
        route_step_index: null,
        tags: null,
      });
    }
    return runs;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === "get_runs_paginated") {
        const { offset, limit } = args as { profileId: string; offset: number; limit: number };
        const runs = generateMockRuns(offset, Math.min(limit, 100));
        return { runs, total: TOTAL_RUNS };
      }
      if (cmd === "get_items") return [];
      if (cmd === "get_stats") return {
        total_runs: TOTAL_RUNS,
        total_items: 0,
        total_time_secs: TOTAL_RUNS * 120,
        avg_run_duration_secs: 120,
        items_per_run: 0,
        items_by_rarity: [],
        runs_by_area: [{ area: "Mephisto", count: TOTAL_RUNS }],
      };
      return undefined;
    });
  });

  it("renders fewer than 100 row elements for 10,000 total runs", async () => {
    const { container } = render(<History profile={mockProfile} />);

    // Wait for the initial data to load and render
    await waitFor(() => {
      const rows = container.querySelectorAll(".history-item");
      expect(rows.length).toBeGreaterThan(0);
    });

    // Count rendered row elements - should be far fewer than 10,000
    const rows = container.querySelectorAll(".history-item");
    expect(rows.length).toBeLessThan(100);

    // Also verify the total count is shown in the badge (confirming 10k total)
    expect(await waitFor(() =>
      container.querySelector(".badge")?.textContent
    )).toContain("10000");
  });
});
