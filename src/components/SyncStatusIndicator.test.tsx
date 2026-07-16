import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SyncStatusIndicator from "./SyncStatusIndicator";
import type { SyncStatus, SyncResult, TestConnectionResult } from "../services/cloud-sync.types";
import type { SyncEngine } from "../services/cloud-sync";

function createMockSyncEngine(status: SyncStatus): SyncEngine {
  return {
    getStatus: vi.fn(() => status),
    triggerSync: vi.fn(async (): Promise<SyncResult> => ({
      success: true,
      recordsMerged: 0,
      conflicts: 0,
    })),
    testConnection: vi.fn(async (): Promise<TestConnectionResult> => ({
      success: true,
    })),
    pushOnClose: vi.fn(async () => {}),
  } as unknown as SyncEngine;
}

describe("SyncStatusIndicator Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("renders 'Not configured' state", () => {
    const engine = createMockSyncEngine({
      state: "not_configured",
      lastSyncAt: null,
      errorMessage: null,
    });

    const { container } = render(<SyncStatusIndicator syncEngine={engine} />);

    // When not configured, the component renders nothing
    expect(container.innerHTML).toBe("");
  });

  it("renders sync button when configured", () => {
    const engine = createMockSyncEngine({
      state: "synced",
      lastSyncAt: "2024-01-15T10:30:00.000Z",
      errorMessage: null,
    });

    render(<SyncStatusIndicator syncEngine={engine} />);

    const syncBtn = screen.getByRole("button", { name: /sync now/i });
    expect(syncBtn).toBeInTheDocument();
  });

  it("button is disabled during syncing state", () => {
    const engine = createMockSyncEngine({
      state: "syncing",
      lastSyncAt: null,
      errorMessage: null,
    });

    render(<SyncStatusIndicator syncEngine={engine} />);

    const syncBtn = screen.getByRole("button", { name: /sync now/i });
    expect(syncBtn).toBeDisabled();
  });

  it("button is enabled when not syncing", () => {
    const engine = createMockSyncEngine({
      state: "synced",
      lastSyncAt: "2024-01-15T10:30:00.000Z",
      errorMessage: null,
    });

    render(<SyncStatusIndicator syncEngine={engine} />);

    const syncBtn = screen.getByRole("button", { name: /sync now/i });
    expect(syncBtn).not.toBeDisabled();
  });

  it("calls triggerSync when sync button is clicked", () => {
    const engine = createMockSyncEngine({
      state: "synced",
      lastSyncAt: "2024-01-15T10:30:00.000Z",
      errorMessage: null,
    });

    render(<SyncStatusIndicator syncEngine={engine} />);

    const syncBtn = screen.getByRole("button", { name: /sync now/i });
    fireEvent.click(syncBtn);

    expect(engine.triggerSync).toHaveBeenCalled();
  });
});
