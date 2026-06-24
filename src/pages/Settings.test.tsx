import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import Settings from "./Settings";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("ObsSettings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_obs_file_path") return "/home/user/.local/share/d2r-desktop/obs_stats.txt";
      return undefined;
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders OBS Integration section", () => {
    render(<Settings />);
    expect(screen.getByText("OBS Integration")).toBeInTheDocument();
  });

  it("toggle persists enabled state to localStorage", () => {
    render(<Settings />);

    // Initially OFF
    const toggleBtn = screen.getByText("OFF", { selector: ".settings-section:last-child button" });
    expect(toggleBtn).toBeInTheDocument();

    // Click to enable
    fireEvent.click(toggleBtn);

    // Verify localStorage updated
    const stored = JSON.parse(localStorage.getItem("d2r_obs_prefs") || "{}");
    expect(stored.enabled).toBe(true);

    // Button should now say ON
    expect(screen.getAllByText("ON").length).toBeGreaterThanOrEqual(1);
  });

  it("toggle disables and persists state to localStorage", () => {
    // Start with enabled state
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "text" }));

    render(<Settings />);

    // Find the OBS ON button and click to disable
    const obsSection = screen.getByText("OBS Integration").closest(".settings-section")!;
    const toggleBtn = obsSection.querySelector("button")!;
    fireEvent.click(toggleBtn);

    const stored = JSON.parse(localStorage.getItem("d2r_obs_prefs") || "{}");
    expect(stored.enabled).toBe(false);
  });

  it("format dropdown updates preference in localStorage", () => {
    render(<Settings />);

    // Find the format dropdown (select element with "Plain Text" and "JSON" options)
    const formatSelect = screen.getByDisplayValue("Plain Text");
    expect(formatSelect).toBeInTheDocument();

    // Change to JSON
    fireEvent.change(formatSelect, { target: { value: "json" } });

    const stored = JSON.parse(localStorage.getItem("d2r_obs_prefs") || "{}");
    expect(stored.format).toBe("json");
  });

  it("copy button calls clipboard API with file path", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    // Enable OBS mode so file path is shown
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "text" }));

    render(<Settings />);

    // Wait for the file path to be fetched and displayed
    await waitFor(() => {
      expect(screen.getByText(/obs_stats\.txt/)).toBeInTheDocument();
    });

    // Click the Copy path button
    const copyBtn = screen.getByText("Copy path");
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("/home/user/.local/share/d2r-desktop/obs_stats.txt");
  });

  it("restores saved configuration on load", () => {
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "json" }));

    render(<Settings />);

    // JSON should be selected in the dropdown
    expect(screen.getByDisplayValue("JSON")).toBeInTheDocument();
  });

  it("displays file path when OBS mode is enabled", async () => {
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: true, format: "text" }));

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText(/obs_stats\.txt/)).toBeInTheDocument();
    });
  });

  it("does not display file path when OBS mode is disabled", () => {
    localStorage.setItem("d2r_obs_prefs", JSON.stringify({ enabled: false, format: "text" }));

    render(<Settings />);

    expect(screen.queryByText("Copy path")).not.toBeInTheDocument();
  });
});
