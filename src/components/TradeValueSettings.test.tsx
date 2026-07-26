import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Settings from "../pages/Settings";

// We test the TradeValueSettings panel through the full Settings page
// since the component is not exported separately.

vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../components/CloudSyncSettings", () => ({
  default: () => null,
}));

vi.mock("../components/ScreenshotSettings", () => ({
  default: () => null,
}));

vi.mock("../api", () => ({
  getObsFilePath: vi.fn().mockResolvedValue("/tmp/obs.txt"),
  getKeybindProfiles: vi.fn().mockResolvedValue([]),
  createKeybindProfile: vi.fn(),
  deleteKeybindProfile: vi.fn(),
  runAutoBackup: vi.fn(),
  cleanupOldBackups: vi.fn(),
  vacuumDatabase: vi.fn(),
}));

describe("TradeValueSettings panel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders with a toggle button", () => {
    render(<Settings />);
    const toggle = document.getElementById("trade-values-toggle");
    expect(toggle).not.toBeNull();
  });

  it("toggle button shows ON when showTradeValues is true", () => {
    localStorage.setItem("show_trade_values", "true");
    render(<Settings />);
    const toggle = document.getElementById("trade-values-toggle") as HTMLButtonElement;
    expect(toggle.textContent).toBe("ON");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("toggle button shows OFF when showTradeValues is false", () => {
    localStorage.setItem("show_trade_values", "false");
    render(<Settings />);
    const toggle = document.getElementById("trade-values-toggle") as HTMLButtonElement;
    expect(toggle.textContent).toBe("OFF");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking toggle updates localStorage", () => {
    localStorage.setItem("show_trade_values", "true");
    render(<Settings />);
    const toggle = document.getElementById("trade-values-toggle") as HTMLButtonElement;
    fireEvent.click(toggle);
    expect(localStorage.getItem("show_trade_values")).toBe("false");
    expect(toggle.textContent).toBe("OFF");
  });

  it("clicking toggle twice round-trips back to ON", () => {
    localStorage.setItem("show_trade_values", "true");
    render(<Settings />);
    const toggle = document.getElementById("trade-values-toggle") as HTMLButtonElement;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(localStorage.getItem("show_trade_values")).toBe("true");
    expect(toggle.textContent).toBe("ON");
  });

  it("defaults to ON when localStorage key is absent", () => {
    render(<Settings />);
    const toggle = document.getElementById("trade-values-toggle") as HTMLButtonElement;
    expect(toggle.textContent).toBe("ON");
  });
});
