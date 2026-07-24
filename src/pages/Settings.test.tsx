import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { unregister } from "@tauri-apps/plugin-global-shortcut";
import Settings from "./Settings";

vi.mock("@tauri-apps/api/core");
vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
  unregisterAll: vi.fn().mockResolvedValue(undefined),
  isRegistered: vi.fn().mockResolvedValue(false),
}));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn().mockReturnValue(Promise.resolve(() => {})),
}));

const mockInvoke = vi.mocked(invoke);
const mockUnregister = vi.mocked(unregister);

describe("Hotkey Settings UI - Detect Screenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_keybind_profiles") return [];
      if (cmd === "get_obs_file_path") return "/mock/path/obs.txt";
      if (cmd === "get_screenshot_settings")
        return { monitoring_enabled: false, auto_detection_enabled: true, confidence_threshold: 80 };
      return undefined;
    });
  });

  it("renders 'Detect Screenshot' row alongside existing hotkey rows", () => {
    render(<Settings />);

    expect(screen.getByText("Next Run (Split)")).toBeInTheDocument();
    expect(screen.getByText("Pause / Resume")).toBeInTheDocument();
    expect(screen.getByText("End Session")).toBeInTheDocument();
    expect(screen.getByText("Detect Screenshot")).toBeInTheDocument();
  });

  it("displays 'Not set' as default value for Detect Screenshot", () => {
    render(<Settings />);

    // The detect screenshot button should show "Not set" when unset
    const detectLabel = screen.getByText("Detect Screenshot");
    const row = detectLabel.closest(".hotkey-row")!;
    const button = row.querySelector("button.hotkey-btn")!;
    expect(button).toHaveTextContent("Not set");
  });

  it("recording mode captures key combination", async () => {
    render(<Settings />);

    // Find the Detect Screenshot row and click its button to start recording
    const detectLabel = screen.getByText("Detect Screenshot");
    const row = detectLabel.closest(".hotkey-row")!;
    const button = row.querySelector("button.hotkey-btn") as HTMLElement;

    fireEvent.click(button);

    // Button should now show "Press a key..." text
    expect(button).toHaveTextContent("Press a key...");

    // Fire a key combination (Ctrl+Shift+D) on the page container
    const page = screen.getByText("Settings").closest(".page")!;
    fireEvent.keyDown(page, { key: "D", ctrlKey: true, shiftKey: true });

    // The button should now display the captured shortcut
    await waitFor(() => {
      expect(button).toHaveTextContent("Ctrl+Shift+D");
    });
  });

  it("conflict detection rejects duplicate bindings with status message", async () => {
    // Set up initial hotkeys with nextRun = F9
    localStorage.setItem("d2r_hotkeys", JSON.stringify({
      nextRun: "F9",
      pause: "F10",
      endSession: "F11",
      detectScreenshot: "",
    }));

    render(<Settings />);

    // Start recording for detectScreenshot
    const detectLabel = screen.getByText("Detect Screenshot");
    const row = detectLabel.closest(".hotkey-row")!;
    const button = row.querySelector("button.hotkey-btn") as HTMLElement;

    fireEvent.click(button);
    expect(button).toHaveTextContent("Press a key...");

    // Try to bind F9 which is already used by nextRun
    const page = screen.getByText("Settings").closest(".page")!;
    fireEvent.keyDown(page, { key: "F9" });

    // Should show conflict message and reject the binding
    await waitFor(() => {
      expect(screen.getByText("Key combination already in use")).toBeInTheDocument();
    });

    // The button should still show "Not set" (binding rejected)
    expect(button).toHaveTextContent("Not set");
  });

  it("clearing binding calls unregister", async () => {
    // Set up with a detect screenshot binding
    localStorage.setItem("d2r_hotkeys", JSON.stringify({
      nextRun: "F9",
      pause: "F10",
      endSession: "F11",
      detectScreenshot: "Ctrl+Shift+D",
    }));

    render(<Settings />);

    // The detect screenshot row should have a Clear button
    const detectLabel = screen.getByText("Detect Screenshot");
    const row = detectLabel.closest(".hotkey-row")!;
    const clearButton = row.querySelector("button.btn.btn-sm") as HTMLElement;
    expect(clearButton).toHaveTextContent("Clear");

    fireEvent.click(clearButton);

    // unregister should be called with the old shortcut
    await waitFor(() => {
      expect(mockUnregister).toHaveBeenCalledWith("Ctrl+Shift+D");
    });

    // The button should now show "Not set"
    const hotkeyBtn = row.querySelector("button.hotkey-btn") as HTMLElement;
    expect(hotkeyBtn).toHaveTextContent("Not set");
  });
});
