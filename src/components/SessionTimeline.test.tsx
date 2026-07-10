import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionTimeline from "./SessionTimeline";
import type { Run, Item } from "../types";

// Mock html2canvas
vi.mock("html2canvas", () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => "data:image/png;base64,mock",
  }),
}));

const mockRuns: Run[] = [
  {
    id: "run-1",
    profile_id: "p1",
    area: "Mephisto",
    duration_secs: 120,
    started_at: "2026-06-15T14:00:00Z",
    finished_at: "2026-06-15T14:02:00Z",
    status: "completed",
    notes: null,
    player_count: 1,
    route_id: null,
    route_step_index: null,
    tags: null,
  },
  {
    id: "run-2",
    profile_id: "p1",
    area: "Mephisto",
    duration_secs: 95,
    started_at: "2026-06-15T14:02:30Z",
    finished_at: "2026-06-15T14:04:05Z",
    status: "completed",
    notes: null,
    player_count: 1,
    route_id: null,
    route_step_index: null,
    tags: null,
  },
  {
    id: "run-3",
    profile_id: "p1",
    area: "Mephisto",
    duration_secs: 110,
    started_at: "2026-06-15T14:04:30Z",
    finished_at: "2026-06-15T14:06:20Z",
    status: "completed",
    notes: null,
    player_count: 1,
    route_id: null,
    route_step_index: null,
    tags: null,
  },
];

const mockItems: Item[] = [
  {
    id: "item-1",
    run_id: "run-1",
    profile_id: "p1",
    name: "Harlequin Crest",
    item_type: "Armor",
    rarity: "Unique",
    found_at: "2026-06-15T14:01:30Z",
    notes: null,
  },
  {
    id: "item-2",
    run_id: "run-2",
    profile_id: "p1",
    name: "Ist Rune",
    item_type: "Rune",
    rarity: "Rune",
    found_at: "2026-06-15T14:03:00Z",
    notes: null,
  },
];

describe("SessionTimeline", () => {
  it("renders timeline with zoom controls", () => {
    render(
      <SessionTimeline
        runs={mockRuns}
        items={mockItems}
        sessionStartTime="2026-06-15T14:00:00Z"
        sessionEndTime="2026-06-15T14:06:20Z"
      />
    );

    expect(screen.getByText("1x")).toBeInTheDocument();
    expect(screen.getByText("−")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("renders export PNG button", () => {
    render(
      <SessionTimeline
        runs={mockRuns}
        items={mockItems}
        sessionStartTime="2026-06-15T14:00:00Z"
        sessionEndTime="2026-06-15T14:06:20Z"
      />
    );

    expect(screen.getByText("📷 Export PNG")).toBeInTheDocument();
  });

  it("renders item events as dots", () => {
    render(
      <SessionTimeline
        runs={mockRuns}
        items={mockItems}
        sessionStartTime="2026-06-15T14:00:00Z"
        sessionEndTime="2026-06-15T14:06:20Z"
      />
    );

    // Items should render as dots with title attributes
    expect(screen.getByTitle("Harlequin Crest")).toBeInTheDocument();
    expect(screen.getByTitle("Ist Rune")).toBeInTheDocument();
  });

  it("renders split markers", () => {
    render(
      <SessionTimeline
        runs={mockRuns}
        items={mockItems}
        sessionStartTime="2026-06-15T14:00:00Z"
        sessionEndTime="2026-06-15T14:06:20Z"
      />
    );

    // Splits for runs 2 and 3
    expect(screen.getByTitle("Split #1")).toBeInTheDocument();
    expect(screen.getByTitle("Split #2")).toBeInTheDocument();
  });

  it("shows invalid duration message for bad times", () => {
    render(
      <SessionTimeline
        runs={[]}
        items={[]}
        sessionStartTime="2026-06-15T14:06:20Z"
        sessionEndTime="2026-06-15T14:00:00Z"
      />
    );

    expect(screen.getByText("Invalid session duration.")).toBeInTheDocument();
  });

  it("renders time markers for sessions longer than 5 minutes", () => {
    render(
      <SessionTimeline
        runs={mockRuns}
        items={mockItems}
        sessionStartTime="2026-06-15T14:00:00Z"
        sessionEndTime="2026-06-15T14:06:20Z"
      />
    );

    // 5 minute mark should exist
    expect(screen.getByText("5m")).toBeInTheDocument();
  });
});
