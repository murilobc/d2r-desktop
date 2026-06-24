import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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


describe("RunTracker OBS Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
      if (cmd === "write_obs_stats") return "/home/user/.local/share/d2r-desktop/obs_stats.txt";
      return undefined;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("calls write_obs_stats with correct payload shape when session is active and OBS is enabled", async () => {
    // Enable OBS mode
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "text" }));

    render(<RunTracker profile={mockProfile} />);

    // Start session
    await act(async () => {
      fireEvent.click(screen.getByText("▶ Start Session"));
    });

    // Advance timers past the 1-second OBS interval
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // Find the write_obs_stats call
    const obsCall = mockInvoke.mock.calls.find(
      (call) => call[0] === "write_obs_stats"
    );

    expect(obsCall).toBeDefined();
    const payload = (obsCall![1] as { input: Record<string, unknown> }).input;

    // Verify payload shape: correct field names and types
    expect(payload).toHaveProperty("runCount");
    expect(payload).toHaveProperty("sessionTime");
    expect(payload).toHaveProperty("currentArea");
    expect(payload).toHaveProperty("lastItems");
    expect(payload).toHaveProperty("format");

    expect(typeof payload.runCount).toBe("number");
    expect(typeof payload.sessionTime).toBe("string");
    expect(typeof payload.currentArea).toBe("string");
    expect(Array.isArray(payload.lastItems)).toBe(true);
    expect(payload.format).toBe("text");
  });

  it("does NOT call write_obs_stats when OBS mode is disabled", async () => {
    // OBS mode disabled (default)
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: false, format: "text" }));

    render(<RunTracker profile={mockProfile} />);

    // Start session
    await act(async () => {
      fireEvent.click(screen.getByText("▶ Start Session"));
    });

    // Advance timers well past 1-second interval
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Verify write_obs_stats was never called
    const obsCalls = mockInvoke.mock.calls.filter(
      (call) => call[0] === "write_obs_stats"
    );
    expect(obsCalls).toHaveLength(0);
  });

  it("plain text format payload has correct field names for labeled output", async () => {
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "text" }));

    render(<RunTracker profile={mockProfile} />);

    await act(async () => {
      fireEvent.click(screen.getByText("▶ Start Session"));
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const obsCall = mockInvoke.mock.calls.find(
      (call) => call[0] === "write_obs_stats"
    );
    expect(obsCall).toBeDefined();

    const payload = (obsCall![1] as { input: Record<string, unknown> }).input;

    // Verify the payload fields match the plain text format labels:
    // "Run Count:", "Session Time:", "Current Area:", "Last Items:"
    expect(payload.runCount).toBeDefined();
    expect(typeof payload.runCount).toBe("number");
    expect(payload.runCount).toBeGreaterThanOrEqual(0);

    // Session time should be HH:MM:SS format
    expect(payload.sessionTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    // Current area should be a non-empty string
    expect(typeof payload.currentArea).toBe("string");
    expect((payload.currentArea as string).length).toBeGreaterThan(0);

    // Last items should be an array with at most 3 items
    expect(Array.isArray(payload.lastItems)).toBe(true);
    expect((payload.lastItems as string[]).length).toBeLessThanOrEqual(3);

    // Format should be "text"
    expect(payload.format).toBe("text");
  });

  it("JSON format payload has correct field types for valid JSON output", async () => {
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "json" }));

    render(<RunTracker profile={mockProfile} />);

    await act(async () => {
      fireEvent.click(screen.getByText("▶ Start Session"));
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const obsCall = mockInvoke.mock.calls.find(
      (call) => call[0] === "write_obs_stats"
    );
    expect(obsCall).toBeDefined();

    const payload = (obsCall![1] as { input: Record<string, unknown> }).input;

    // Verify the payload has correct types that match JSON format:
    // { "runCount": number, "sessionTime": string, "currentArea": string, "lastItems": string[] }
    expect(typeof payload.runCount).toBe("number");
    expect(Number.isInteger(payload.runCount)).toBe(true);

    expect(typeof payload.sessionTime).toBe("string");
    expect(payload.sessionTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    expect(typeof payload.currentArea).toBe("string");

    expect(Array.isArray(payload.lastItems)).toBe(true);
    (payload.lastItems as string[]).forEach((item: string) => {
      expect(typeof item).toBe("string");
    });

    // Format should be "json"
    expect(payload.format).toBe("json");

    // The payload itself should be JSON-serializable (verifying it produces valid JSON)
    const jsonStr = JSON.stringify(payload);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.runCount).toBe(payload.runCount);
    expect(parsed.sessionTime).toBe(payload.sessionTime);
    expect(parsed.currentArea).toBe(payload.currentArea);
    expect(parsed.lastItems).toEqual(payload.lastItems);
  });
});
