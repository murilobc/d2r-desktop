import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import ScreenshotSettingsPanel from "./ScreenshotSettings";

vi.mock("@tauri-apps/api/core");
// folder dialog removed from component
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

const defaultSettings = {
  monitoring_enabled: false,
  auto_detection_enabled: true,
  confidence_threshold: 80,
  folder_monitoring_enabled: false,
  screenshot_folder_path: null,
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
      expect(input).toHaveValue(80);
      expect(input).toHaveAttribute("min", "50");
      expect(input).toHaveAttribute("max", "100");
    });
  });

  it("calls updateScreenshotSettings when monitoring toggle is clicked", async () => {
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByRole("button", { name: /clipboard monitoring/i }));
    fireEvent.click(screen.getByRole("button", { name: /clipboard monitoring/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, monitoring_enabled: true },
      });
    });
  });

  it("calls updateScreenshotSettings when auto-detection toggle is clicked", async () => {
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByRole("button", { name: /auto-detection/i }));
    fireEvent.click(screen.getByRole("button", { name: /auto-detection/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, auto_detection_enabled: false },
      });
    });
  });

  it("shows inline error for threshold below 50", async () => {
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByLabelText(/confidence threshold/i));
    fireEvent.change(screen.getByLabelText(/confidence threshold/i), { target: { value: "49" } });
    expect(screen.getByText("Threshold must be between 50 and 100")).toBeInTheDocument();
  });

  it("shows inline error for threshold above 100", async () => {
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByLabelText(/confidence threshold/i));
    fireEvent.change(screen.getByLabelText(/confidence threshold/i), { target: { value: "101" } });
    expect(screen.getByText("Threshold must be between 50 and 100")).toBeInTheDocument();
  });

  it("calls updateScreenshotSettings with valid threshold value", async () => {
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByLabelText(/confidence threshold/i));
    fireEvent.change(screen.getByLabelText(/confidence threshold/i), { target: { value: "75" } });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_screenshot_settings", {
        settings: { ...defaultSettings, confidence_threshold: 75 },
      });
    });
  });

  it("shows error when settings save fails", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_screenshot_settings") return { ...defaultSettings };
      if (cmd === "update_screenshot_settings") throw new Error("Database write failed");
      return undefined;
    });
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByRole("button", { name: /clipboard monitoring/i }));
    fireEvent.click(screen.getByRole("button", { name: /clipboard monitoring/i }));
    await waitFor(() => {
      expect(screen.getByText("Database write failed")).toBeInTheDocument();
    });
  });

  it("folder monitoring UI is removed from the simplified component", async () => {
    render(<ScreenshotSettingsPanel />);
    await waitFor(() => screen.getByText("Screenshot Detection"));
    // folder monitoring, browse, and folder path UI removed
    expect(screen.queryByText(/folder monitoring/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /browse for/i })).toBeNull();
    expect(screen.queryByText(/folder path/i)).toBeNull();
  });
});
