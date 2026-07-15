import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import CloudSyncSettings from "./CloudSyncSettings";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("CloudSyncSettings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_sync_token") return null;
      return undefined;
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders backend selector with Off, GitHub Gist, and Local Folder options", () => {
    render(<CloudSyncSettings />);

    const select = screen.getByDisplayValue("Off");
    expect(select).toBeInTheDocument();

    // Check options exist
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(3);
  });

  it("shows masked token input with show/hide toggle when GitHub Gist is selected", () => {
    localStorage.setItem(
      "d2r_sync_config",
      JSON.stringify({
        backend: "github_gist",
        gistId: null,
        localFolderPath: null,
        autoSyncOnClose: false,
        lastSyncTimestamp: null,
      }),
    );

    render(<CloudSyncSettings />);

    // Find the token input - it should be a password field by default
    const tokenInput = screen.getByPlaceholderText("ghp_...");
    expect(tokenInput).toBeInTheDocument();
    expect(tokenInput).toHaveAttribute("type", "password");

    // Click show toggle
    const showBtn = screen.getByText("Show");
    fireEvent.click(showBtn);

    // Token input should now be visible text
    expect(tokenInput).toHaveAttribute("type", "text");

    // Click hide toggle
    const hideBtn = screen.getByText("Hide");
    fireEvent.click(hideBtn);

    // Token input should be masked again
    expect(tokenInput).toHaveAttribute("type", "password");
  });

  it("validation prevents empty token save", async () => {
    localStorage.setItem(
      "d2r_sync_config",
      JSON.stringify({
        backend: "github_gist",
        gistId: null,
        localFolderPath: null,
        autoSyncOnClose: false,
        lastSyncTimestamp: null,
      }),
    );

    render(<CloudSyncSettings />);

    // Find the token input and leave it empty
    const tokenInput = screen.getByPlaceholderText("ghp_...");
    expect(tokenInput).toBeInTheDocument();

    // Click Save with empty token
    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);

    // Should show error about token being required
    // The invoke for save_sync_token should NOT have been called
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "save_sync_token",
      expect.any(Object),
    );
  });
});
