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
      if (cmd === "get_items") {
        const { runId } = args as { runId: string };
        if (runId === "run-1") return mockItems;
        return [];
      }
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
      expect(screen.getByText("TestSorc - 3 runs")).toBeInTheDocument();
    });
  });

  it("shows empty state when no runs", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_runs") return [];
      return undefined;
    });

    render(<History profile={mockProfile} />);
    await waitFor(() => {
      expect(screen.getByText("No completed runs yet.")).toBeInTheDocument();
    });
  });
});
