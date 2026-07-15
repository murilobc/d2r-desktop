import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import HeraldTracker from "./HeraldTracker";
import { mockProfile } from "../test/mocks";
import type { HeraldStats } from "../types";

vi.mock("../api", () => ({
  getHeraldEncounters: vi.fn().mockResolvedValue([]),
  getHeraldStats: vi.fn().mockResolvedValue({
    total_encounters: 5,
    success_count: 3,
    fail_count: 2,
    encounters_by_tier: [
      { tier: 1, count: 3, successes: 2 },
      { tier: 2, count: 2, successes: 1 },
    ],
    sunder_charms_found: ["Cold Rupture"],
  } satisfies HeraldStats),
  createHeraldEncounter: vi.fn(),
  deleteHeraldEncounter: vi.fn(),
}));

describe("HeraldTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", async () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText("⚔️ Herald Tracker")).toBeInTheDocument();
  });

  it("renders the profile badge", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText(`${mockProfile.name} - ${mockProfile.class}`)).toBeInTheDocument();
  });

  it("renders the encounter log form", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByLabelText("Tier")).toBeInTheDocument();
    expect(screen.getByLabelText("Area")).toBeInTheDocument();
    expect(screen.getByLabelText("Sunder Charm")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Encounter" })).toBeInTheDocument();
  });

  it("renders tier progression section", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText("Tier Progression")).toBeInTheDocument();
    expect(screen.getByText("T1")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();
    expect(screen.getByText("T4")).toBeInTheDocument();
    expect(screen.getByText("T5")).toBeInTheDocument();
  });

  it("renders sunder charm collection section", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText("Sunder Charm Collection")).toBeInTheDocument();
    // Sunder charm names appear in both the collection grid and the dropdown
    expect(screen.getAllByText("Cold Rupture").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Flame Rift").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Crack of the Heavens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Bone Break").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Rotting Fissure").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Black Cleft").length).toBeGreaterThanOrEqual(1);
  });

  it("renders encounter history section", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText("Encounters")).toBeInTheDocument();
  });

  it("shows empty state when no encounters", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText("No encounters logged yet.")).toBeInTheDocument();
  });

  it("renders success/fail toggle buttons", () => {
    render(<HeraldTracker profile={mockProfile} />);
    expect(screen.getByText("✓ Success")).toBeInTheDocument();
    expect(screen.getByText("✕ Fail")).toBeInTheDocument();
  });
});
