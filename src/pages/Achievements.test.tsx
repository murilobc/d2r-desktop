import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Achievements from "./Achievements";
import { mockProfile, mockProfiles } from "../test/mocks";
import type { AchievementProgress, LifetimeStats } from "../types";

const mockProgressData: AchievementProgress[] = [
  {
    definition: {
      id: "milestone_100_runs",
      category: "milestone",
      name_key: "milestone_100_runs",
      description_key: "milestone_100_runs",
      icon: "🏃",
      condition_type: "total_runs",
      condition_target: null,
      threshold: 100,
      sort_order: 1,
    },
    unlocked: true,
    unlocked_at: "2026-06-10T12:00:00Z",
    current_value: 150,
  },
  {
    definition: {
      id: "milestone_500_runs",
      category: "milestone",
      name_key: "milestone_500_runs",
      description_key: "milestone_500_runs",
      icon: "🏅",
      condition_type: "total_runs",
      condition_target: null,
      threshold: 500,
      sort_order: 2,
    },
    unlocked: false,
    unlocked_at: null,
    current_value: 342,
  },
  {
    definition: {
      id: "streak_7_days",
      category: "streak",
      name_key: "streak_7_days",
      description_key: "streak_7_days",
      icon: "🔥",
      condition_type: "streak_days",
      condition_target: null,
      threshold: 7,
      sort_order: 10,
    },
    unlocked: false,
    unlocked_at: null,
    current_value: 4,
  },
  {
    definition: {
      id: "class_sorceress_1000",
      category: "per-class",
      name_key: "class_sorceress_1000",
      description_key: "class_sorceress_1000",
      icon: "🧙",
      condition_type: "class_runs",
      condition_target: "Sorceress",
      threshold: 1000,
      sort_order: 20,
    },
    unlocked: false,
    unlocked_at: null,
    current_value: 780,
  },
  {
    definition: {
      id: "area_pit_500",
      category: "per-area",
      name_key: "area_pit_500",
      description_key: "area_pit_500",
      icon: "⛏️",
      condition_type: "area_runs",
      condition_target: "Pit",
      threshold: 500,
      sort_order: 30,
    },
    unlocked: true,
    unlocked_at: "2026-06-08T09:30:00Z",
    current_value: 520,
  },
];

const mockLifetimeStats: LifetimeStats = {
  total_time_hours: 125.5,
  total_runs: 1500,
  total_items: 320,
  runs_by_class: [
    { class: "Sorceress", count: 800 },
    { class: "Paladin", count: 700 },
  ],
  runs_by_area: [
    { area: "Pit", count: 520 },
    { area: "Chaos Sanctuary", count: 400 },
  ],
  items_by_rarity: [
    { rarity: "Unique", count: 50 },
    { rarity: "Set", count: 30 },
  ],
};

vi.mock("../api", () => ({
  getAchievementProgress: vi.fn(),
  getLifetimeStats: vi.fn(),
}));

import { getAchievementProgress, getLifetimeStats } from "../api";

const mockedGetProgress = vi.mocked(getAchievementProgress);
const mockedGetStats = vi.mocked(getLifetimeStats);

describe("Achievements Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetProgress.mockResolvedValue(mockProgressData);
    mockedGetStats.mockResolvedValue(mockLifetimeStats);
  });

  /**
   * Property 1: Category Validation
   * Verify only valid categories accepted in filter.
   * Validates: Requirements 1.2
   */
  describe("Property 1: Category Validation", () => {
    it("renders only valid category filter tabs: All, Milestone, Streak, Per-Class, Per-Area", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(5);

      expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Milestone" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Streak" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Per-Class" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Per-Area" })).toBeInTheDocument();
    });

    it("does not render invalid category tabs", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      expect(screen.queryByRole("tab", { name: "invalid" })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "other" })).not.toBeInTheDocument();
    });
  });

  /**
   * Property 9: Category Filter Correctness
   * Verify filtered view shows only matching category.
   * Validates: Requirements 8.5
   */
  describe("Property 9: Category Filter Correctness", () => {
    it("shows all achievements when 'All' filter is active", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      const cards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("achievement-card")
      );
      expect(cards).toHaveLength(5);
    });

    it("shows only milestone achievements when Milestone filter is clicked", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Milestone" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: "Milestone" }));

      const cards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("achievement-card")
      );
      // We have 2 milestone achievements in mock data
      expect(cards).toHaveLength(2);
      cards.forEach((card) => {
        // Each milestone card should contain milestone achievement data
        expect(card.textContent).toMatch(/🏃|🏅/);
      });
    });

    it("shows only streak achievements when Streak filter is clicked", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Streak" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: "Streak" }));

      const cards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("achievement-card")
      );
      // We have 1 streak achievement in mock data
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain("🔥");
    });

    it("shows only per-class achievements when Per-Class filter is clicked", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Per-Class" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: "Per-Class" }));

      const cards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("achievement-card")
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain("🧙");
    });

    it("shows only per-area achievements when Per-Area filter is clicked", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Per-Area" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: "Per-Area" }));

      const cards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("achievement-card")
      );
      expect(cards).toHaveLength(1);
      expect(cards[0].textContent).toContain("⛏️");
    });

    it("shows empty state when no achievements match the selected category", async () => {
      // Only provide milestone achievements
      mockedGetProgress.mockResolvedValue([mockProgressData[0]]);

      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "Streak" })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: "Streak" }));

      expect(screen.getByText("No achievements in this category.")).toBeInTheDocument();
    });
  });

  /**
   * Property 8: Progress Indicator Accuracy
   * Verify current_value and threshold displayed faithfully.
   * Validates: Requirements 8.4
   */
  describe("Property 8: Progress Indicator Accuracy", () => {
    it("displays current_value / threshold text for locked achievements", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      // milestone_500_runs: current_value=342, threshold=500
      expect(screen.getByText("342 / 500")).toBeInTheDocument();
      // streak_7_days: current_value=4, threshold=7
      expect(screen.getByText("4 / 7")).toBeInTheDocument();
      // class_sorceress_1000: current_value=780, threshold=1000
      expect(screen.getByText("780 / 1,000")).toBeInTheDocument();
    });

    it("renders progress bar with correct aria attributes", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      const progressBars = screen.getAllByRole("progressbar");
      // 3 locked achievements should have progress bars
      expect(progressBars).toHaveLength(3);

      // Check the first progress bar (milestone_500_runs: 342/500)
      const bar342 = progressBars.find(
        (bar) => bar.getAttribute("aria-valuenow") === "342"
      );
      expect(bar342).toBeDefined();
      expect(bar342).toHaveAttribute("aria-valuemin", "0");
      expect(bar342).toHaveAttribute("aria-valuemax", "500");
    });

    it("does not show progress bar for unlocked achievements", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      // Unlocked achievements show unlock date, not progress bar
      // milestone_100_runs is unlocked — verify it shows unlock date
      expect(screen.getByText(/6\/10\/2026/)).toBeInTheDocument();
      // area_pit_500 is unlocked
      expect(screen.getByText(/6\/8\/2026/)).toBeInTheDocument();
    });
  });

  /**
   * Test profile switching shows correct unlock state.
   * Validates: Requirements 10.3
   */
  describe("Profile switching shows correct unlock state", () => {
    it("loads achievements for the provided profile and displays profile name", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText(/TestSorc/)).toBeInTheDocument();
      });

      expect(mockedGetProgress).toHaveBeenCalledWith("profile-1");
      expect(mockedGetStats).toHaveBeenCalledWith("profile-1");
    });

    it("reloads data when profile changes", async () => {
      const profile2 = mockProfiles[1];
      const profile2Progress: AchievementProgress[] = [
        {
          definition: {
            id: "milestone_100_runs",
            category: "milestone",
            name_key: "milestone_100_runs",
            description_key: "milestone_100_runs",
            icon: "🏃",
            condition_type: "total_runs",
            condition_target: null,
            threshold: 100,
            sort_order: 1,
          },
          unlocked: false,
          unlocked_at: null,
          current_value: 25,
        },
      ];

      const profile2Stats: LifetimeStats = {
        total_time_hours: 10.0,
        total_runs: 25,
        total_items: 5,
        runs_by_class: [{ class: "Paladin", count: 25 }],
        runs_by_area: [{ area: "Chaos Sanctuary", count: 25 }],
        items_by_rarity: [{ rarity: "Unique", count: 5 }],
      };

      // Initially render with profile 1
      const { rerender } = render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText(/TestSorc/)).toBeInTheDocument();
      });

      // Now switch to profile 2
      mockedGetProgress.mockResolvedValue(profile2Progress);
      mockedGetStats.mockResolvedValue(profile2Stats);

      rerender(<Achievements profile={profile2} />);

      await waitFor(() => {
        expect(screen.getByText(/HammerPally/)).toBeInTheDocument();
      });

      expect(mockedGetProgress).toHaveBeenCalledWith("profile-2");
      expect(mockedGetStats).toHaveBeenCalledWith("profile-2");

      // Profile 2 has the achievement locked with 25/100 progress
      expect(screen.getByText("25 / 100")).toBeInTheDocument();
    });

    it("displays unlocked achievements with unlock date and locked ones with progress", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      });

      // Unlocked cards have the "unlocked" class
      const unlockedCards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("unlocked")
      );
      expect(unlockedCards).toHaveLength(2);

      // Locked cards have the "locked" class
      const lockedCards = screen.getAllByRole("listitem").filter(
        (el) => el.classList.contains("locked")
      );
      expect(lockedCards).toHaveLength(3);
    });
  });

  /**
   * Additional: Lifetime stats dashboard renders correctly.
   * Validates: Requirements 8.1
   */
  describe("Lifetime Stats Dashboard", () => {
    it("displays total hours, runs, and items", async () => {
      render(<Achievements profile={mockProfile} />);

      await waitFor(() => {
        expect(screen.getByText("125.5h")).toBeInTheDocument();
      });

      expect(screen.getByText("1,500")).toBeInTheDocument();
      expect(screen.getByText("320")).toBeInTheDocument();
    });
  });
});
