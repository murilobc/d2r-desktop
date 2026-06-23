import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import RunTracker from "./RunTracker";
import { mockProfile } from "../test/mocks";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("RunTracker Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_runs") return [];
      if (cmd === "get_custom_areas") return [];
      if (cmd === "create_run") return {
        id: "run-new",
        profile_id: mockProfile.id,
        area: "Mephisto",
        duration_secs: 0,
        started_at: new Date().toISOString(),
        finished_at: null,
        status: "in_progress",
        notes: null,
      };
      if (cmd === "get_items") return [];
      if (cmd === "finish_run") return {};
      return undefined;
    });
  });

  it("renders run tracker title", () => {
    render(<RunTracker profile={mockProfile} />);
    expect(screen.getByText("Run Tracker")).toBeInTheDocument();
  });

  it("shows start session UI initially", () => {
    render(<RunTracker profile={mockProfile} />);
    expect(screen.getByText("Start Session")).toBeInTheDocument();
    expect(screen.getByText("▶ Start Session")).toBeInTheDocument();
  });

  it("shows area selector", () => {
    render(<RunTracker profile={mockProfile} />);
    expect(screen.getByText("Area")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ancient Tunnels")).toBeInTheDocument();
  });

  it("remembers last selected area from localStorage", () => {
    localStorage.setItem(`d2r_last_area_${mockProfile.id}`, "Mephisto");
    render(<RunTracker profile={mockProfile} />);
    expect(screen.getByDisplayValue("Mephisto")).toBeInTheDocument();
  });

  it("starts session when button is clicked", async () => {
    render(<RunTracker profile={mockProfile} />);
    fireEvent.click(screen.getByText("▶ Start Session"));

    await waitFor(() => {
      expect(screen.getByText("⏹ End Session")).toBeInTheDocument();
      expect(screen.getByText("⏭ Next Run")).toBeInTheDocument();
    });
  });

  it("shows timer display after starting session", async () => {
    render(<RunTracker profile={mockProfile} />);
    fireEvent.click(screen.getByText("▶ Start Session"));

    await waitFor(() => {
      expect(screen.getByText(/Session time:/)).toBeInTheDocument();
      expect(screen.getByText(/Run count:/)).toBeInTheDocument();
    });
  });

  it("shows pause button during active session", async () => {
    render(<RunTracker profile={mockProfile} />);
    fireEvent.click(screen.getByText("▶ Start Session"));

    await waitFor(() => {
      expect(screen.getByText("⏸ Pause")).toBeInTheDocument();
    });
  });

  it("toggles pause/resume", async () => {
    render(<RunTracker profile={mockProfile} />);
    fireEvent.click(screen.getByText("▶ Start Session"));

    await waitFor(() => {
      expect(screen.getByText("⏸ Pause")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("⏸ Pause"));
    expect(screen.getByText("▶ Resume")).toBeInTheDocument();

    fireEvent.click(screen.getByText("▶ Resume"));
    expect(screen.getByText("⏸ Pause")).toBeInTheDocument();
  });

  it("shows profile name in badge", () => {
    render(<RunTracker profile={mockProfile} />);
    expect(screen.getByText("TestSorc - Sorceress")).toBeInTheDocument();
  });
});
