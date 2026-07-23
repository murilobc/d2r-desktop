import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import ScreenshotSettingsPanel from "./ScreenshotSettings";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

const defaultSettings = {
  monitoring_enabled: false,
  auto_detection_enabled: true,
  confidence_threshold: 80,
};

describe("ScreenshotSettings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === "get_screenshot_settings") return { ...defaultSettings };
      if (cmd === "update_screenshot_settings") {
        const { settings } = args as { settings: typeof defaultSettings };
        return settings;
      }
      return undefined;
    });
  });

  it("renders the Screenshot Detection section header", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Screenshot Detection")).toBeInTheDocument();
    });
  });

  it("loads settings on mount via getScreenshotSettings", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_screenshot_settings");
    });
  });

  it("displays clipboard monitoring toggle defaulting to OFF", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      const toggle = screen.getByRole("button", { name: /clipboard monitoring/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveTextContent("OFF");
      expect(toggle).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("displays auto-detection toggle defaulting to ON", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      const toggle = screen.getByRole("button", { name: /auto-detection/i });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveTextContent("ON");
      expect(toggle).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("displays confidence threshold input defaulting to 80", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      const input = screen.getByLabelText(/confidence threshold/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(80);
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "50");
      expect(input).toHaveAttribute("max", "100");
      expect(input).toHaveAttribute("step", "1");
    });
  });

  it("calls updateScreenshotSettings when monitoring toggle is clicked", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clipboard monitoring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /clipboard monitoring/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, monitoring_enabled: true },
      });
    });
  });

  it("calls updateScreenshotSettings when auto-detection toggle is clicked", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /auto-detection/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /auto-detection/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, auto_detection_enabled: false },
      });
    });
  });

  it("auto-detection toggle is configurable independently of monitoring", async () => {
    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === "get_screenshot_settings") {
        return { monitoring_enabled: false, auto_detection_enabled: true, confidence_threshold: 80 };
      }
      if (cmd === "update_screenshot_settings") {
        const { settings } = args as { settings: typeof defaultSettings };
        return settings;
      }
      return undefined;
    });

    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /auto-detection/i })).toBeInTheDocument();
    });

    // Toggle auto-detection while monitoring is OFF
    fireEvent.click(screen.getByRole("button", { name: /auto-detection/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { monitoring_enabled: false, auto_detection_enabled: false, confidence_threshold: 80 },
      });
    });
  });

  it("shows inline error for threshold value below 50", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/confidence threshold/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/confidence threshold/i);
    fireEvent.change(input, { target: { value: "49" } });

    expect(screen.getByText("Threshold must be between 50 and 100")).toBeInTheDocument();
    // Should not call update with invalid value
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "update_screenshot_settings",
      expect.objectContaining({ settings: expect.objectContaining({ confidence_threshold: 49 }) })
    );
  });

  it("shows inline error for threshold value above 100", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/confidence threshold/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/confidence threshold/i);
    fireEvent.change(input, { target: { value: "101" } });

    expect(screen.getByText("Threshold must be between 50 and 100")).toBeInTheDocument();
  });

  it("calls updateScreenshotSettings with valid threshold value", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/confidence threshold/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/confidence threshold/i);
    fireEvent.change(input, { target: { value: "75" } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, confidence_threshold: 75 },
      });
    });
  });

  it("shows error message when settings save fails", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_screenshot_settings") return { ...defaultSettings };
      if (cmd === "update_screenshot_settings") {
        throw new Error("Database write failed");
      }
      return undefined;
    });

    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clipboard monitoring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /clipboard monitoring/i }));

    await waitFor(() => {
      expect(screen.getByText("Database write failed")).toBeInTheDocument();
    });
  });

  it("retains previous threshold value when invalid value is entered", async () => {
    render(<ScreenshotSettingsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/confidence threshold/i)).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/confidence threshold/i);

    // First set a valid value
    fireEvent.change(input, { target: { value: "75" } });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, confidence_threshold: 75 },
      });
    });

    // Now enter an invalid value
    fireEvent.change(input, { target: { value: "120" } });

    // Error should appear
    expect(screen.getByText("Threshold must be between 50 and 100")).toBeInTheDocument();

    // The settings object should still have 75 as the last valid value
    // (updateScreenshotSettings should NOT have been called with 120)
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "update_screenshot_settings",
      expect.objectContaining({ settings: expect.objectContaining({ confidence_threshold: 120 }) })
    );
  });
});
