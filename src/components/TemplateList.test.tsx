import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TemplateList from "./TemplateList";
import type { Template } from "../types";

vi.mock("../api", () => ({
  getTemplates: vi.fn(),
  touchTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import { getTemplates, touchTemplate, deleteTemplate } from "../api";

const mockGetTemplates = vi.mocked(getTemplates);
const mockTouchTemplate = vi.mocked(touchTemplate);
const mockDeleteTemplate = vi.mocked(deleteTemplate);

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "tpl-1",
    profile_id: "profile-1",
    name: "Mephisto Runs",
    area: "Mephisto",
    player_count: 1,
    route_id: null,
    session_goal_type: "runs",
    session_goal_value: 50,
    tags: null,
    last_used_at: "2024-06-01T10:00:00Z",
    created_at: "2024-05-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
    ...overrides,
  };
}

const fiveTemplates: Template[] = [
  makeTemplate({ id: "tpl-1", name: "Mephisto Runs", last_used_at: "2024-06-05T10:00:00Z" }),
  makeTemplate({ id: "tpl-2", name: "Pit Farming", last_used_at: "2024-06-04T10:00:00Z" }),
  makeTemplate({ id: "tpl-3", name: "Chaos Sanctuary", last_used_at: "2024-06-03T10:00:00Z" }),
  makeTemplate({ id: "tpl-4", name: "Cow Level", last_used_at: "2024-06-02T10:00:00Z" }),
  makeTemplate({ id: "tpl-5", name: "Ancient Tunnels", last_used_at: "2024-06-01T10:00:00Z" }),
];

describe("TemplateList Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTouchTemplate.mockResolvedValue(undefined);
    mockDeleteTemplate.mockResolvedValue(undefined);
  });

  it("renders nothing when no templates exist", async () => {
    mockGetTemplates.mockResolvedValue([]);

    const { container } = render(
      <TemplateList
        profileId="profile-1"
        onStartFromTemplate={vi.fn()}
        onEditTemplate={vi.fn()}
        sessionActive={false}
      />
    );

    await waitFor(() => {
      expect(mockGetTemplates).toHaveBeenCalledWith("profile-1");
    });

    expect(container.querySelector(".template-list")).not.toBeInTheDocument();
  });

  it("renders MRU section with top 3 recently used templates", async () => {
    mockGetTemplates.mockResolvedValue(fiveTemplates);

    render(
      <TemplateList
        profileId="profile-1"
        onStartFromTemplate={vi.fn()}
        onEditTemplate={vi.fn()}
        sessionActive={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mephisto Runs")).toBeInTheDocument();
    });

    // First 3 templates should have MRU class
    const mruCards = document.querySelectorAll(".template-card--mru");
    expect(mruCards).toHaveLength(3);

    // Remaining templates should not have MRU class
    const remainingCards = document.querySelectorAll(".template-list-remaining .template-card");
    expect(remainingCards).toHaveLength(2);
  });

  it("clicking a template card triggers one-click start flow", async () => {
    mockGetTemplates.mockResolvedValue([fiveTemplates[0]]);
    const onStartFromTemplate = vi.fn();

    render(
      <TemplateList
        profileId="profile-1"
        onStartFromTemplate={onStartFromTemplate}
        onEditTemplate={vi.fn()}
        sessionActive={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mephisto Runs")).toBeInTheDocument();
    });

    const card = screen.getByRole("button", { name: /Start session from template: Mephisto Runs/i });
    fireEvent.click(card);

    await waitFor(() => {
      expect(mockTouchTemplate).toHaveBeenCalledWith("tpl-1");
    });

    expect(onStartFromTemplate).toHaveBeenCalledWith(fiveTemplates[0]);
  });

  it("delete confirmation dialog shows template name", async () => {
    mockGetTemplates.mockResolvedValue([fiveTemplates[0]]);

    render(
      <TemplateList
        profileId="profile-1"
        onStartFromTemplate={vi.fn()}
        onEditTemplate={vi.fn()}
        sessionActive={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mephisto Runs")).toBeInTheDocument();
    });

    // Click the delete button
    const deleteBtn = screen.getByLabelText("Delete template: Mephisto Runs");
    fireEvent.click(deleteBtn);

    // Confirmation dialog should appear with template name
    const dialog = screen.getByRole("dialog", { name: "Confirm delete" });
    expect(dialog).toBeInTheDocument();

    // The dialog message contains the template name in a <strong> tag
    const dialogMessage = dialog.querySelector(".template-delete-message");
    expect(dialogMessage).toBeInTheDocument();
    expect(dialogMessage!.textContent).toContain("Mephisto Runs");

    expect(screen.getByText("Delete", { selector: ".btn-danger" })).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders nothing when session is active", async () => {
    mockGetTemplates.mockResolvedValue(fiveTemplates);

    const { container } = render(
      <TemplateList
        profileId="profile-1"
        onStartFromTemplate={vi.fn()}
        onEditTemplate={vi.fn()}
        sessionActive={true}
      />
    );

    await waitFor(() => {
      expect(mockGetTemplates).toHaveBeenCalledWith("profile-1");
    });

    expect(container.querySelector(".template-list")).not.toBeInTheDocument();
  });
});
