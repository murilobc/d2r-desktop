import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import Settings from "./Settings";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("Database Maintenance - VACUUM Settings UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_keybind_profiles") return [];
      if (cmd === "get_obs_file_path") return "/mock/path/obs.txt";
      if (cmd === "get_screenshot_settings") return { monitoring_enabled: false, auto_detection_enabled: true, confidence_threshold: 80 };
      return undefined;
    });
  });

  it("renders Compact Database button", () => {
    render(<Settings />);
    expect(screen.getByText("Compact Database")).toBeInTheDocument();
  });

  it("disables button during compaction operation", async () => {
    // Mock a slow vacuum response
    let resolveVacuum: (value: unknown) => void;
    const slowVacuum = new Promise((resolve) => {
      resolveVacuum = resolve;
    });

    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "vacuum_database") return slowVacuum;
      if (cmd === "get_keybind_profiles") return [];
      if (cmd === "get_obs_file_path") return "/mock/path/obs.txt";
      if (cmd === "get_screenshot_settings") return { monitoring_enabled: false, auto_detection_enabled: true, confidence_threshold: 80 };
      return undefined;
    });

    render(<Settings />);

    const button = screen.getByText("Compact Database");
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    // Button should now be disabled and show "Compacting..." text
    await waitFor(() => {
      expect(screen.getByText("Compacting...")).toBeInTheDocument();
    });
    expect(screen.getByText("Compacting...")).toBeDisabled();

    // Resolve the vacuum
    resolveVacuum!({
      size_before_bytes: 1048576,
      size_after_bytes: 524288,
      success: true,
    });

    // After resolve, button should re-enable
    await waitFor(() => {
      expect(screen.getByText("Compact Database")).not.toBeDisabled();
    });
  });

  it("shows success message with file sizes after vacuum", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "vacuum_database") {
        return {
          size_before_bytes: 2097152, // 2 MB
          size_after_bytes: 1048576,  // 1 MB
          success: true,
        };
      }
      if (cmd === "get_keybind_profiles") return [];
      if (cmd === "get_obs_file_path") return "/mock/path/obs.txt";
      if (cmd === "get_screenshot_settings") return { monitoring_enabled: false, auto_detection_enabled: true, confidence_threshold: 80 };
      return undefined;
    });

    render(<Settings />);

    const button = screen.getByText("Compact Database");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Compacted:.*2\.00 MB.*→.*1\.00 MB/)).toBeInTheDocument();
    });
  });

  it("shows error message on vacuum failure", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "vacuum_database") {
        throw new Error("Database is locked");
      }
      if (cmd === "get_keybind_profiles") return [];
      if (cmd === "get_obs_file_path") return "/mock/path/obs.txt";
      if (cmd === "get_screenshot_settings") return { monitoring_enabled: false, auto_detection_enabled: true, confidence_threshold: 80 };
      return undefined;
    });

    render(<Settings />);

    const button = screen.getByText("Compact Database");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Compact failed:.*Database is locked/)).toBeInTheDocument();
    });
  });
});
