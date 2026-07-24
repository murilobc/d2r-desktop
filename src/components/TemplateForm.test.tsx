import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TemplateForm from "./TemplateForm";
import type { Template, Route } from "../types";

vi.mock("../api", () => ({
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
}));

import { createTemplate } from "../api";

const mockCreateTemplate = vi.mocked(createTemplate);

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "tpl-1",
    profile_id: "profile-1",
    name: "Mephisto Runs",
    area: "Mephisto",
    player_count: 3,
    route_id: "route-1",
    session_goal_type: "runs",
    session_goal_value: 100,
    tags: JSON.stringify(["mf", "fast"]),
    last_used_at: "2024-06-01T10:00:00Z",
    created_at: "2024-05-01T10:00:00Z",
    updated_at: "2024-06-01T10:00:00Z",
    ...overrides,
  };
}

const sampleRoutes: Route[] = [
  { id: "route-1", profile_id: "profile-1", name: "Meph Route", areas: ["Mephisto"], created_at: "2024-01-01T00:00:00Z" },
  { id: "route-2", profile_id: "profile-1", name: "Pit Route", areas: ["Pit"], created_at: "2024-01-01T00:00:00Z" },
];

const defaultProps = {
  mode: "create" as const,
  profileId: "profile-1",
  routes: sampleRoutes,
  customAreas: [] as string[],
  availableTags: [] as string[],
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe("TemplateForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Edit mode pre-population", () => {
    it("pre-populates form fields with existing template values in edit mode", () => {
      const template = makeTemplate();

      render(
        <TemplateForm
          {...defaultProps}
          mode="edit"
          initialValues={template}
        />
      );

      // Name field
      const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
      expect(nameInput.value).toBe("Mephisto Runs");

      // Area dropdown
      const areaSelect = screen.getByLabelText("Area") as HTMLSelectElement;
      expect(areaSelect.value).toBe("Mephisto");

      // Player count dropdown
      const playerCountSelect = screen.getByLabelText("Player Count") as HTMLSelectElement;
      expect(playerCountSelect.value).toBe("3");

      // Route dropdown
      const routeSelect = screen.getByLabelText("Route (optional)") as HTMLSelectElement;
      expect(routeSelect.value).toBe("route-1");

      // Goal type
      const goalTypeSelect = screen.getByLabelText("Session Goal") as HTMLSelectElement;
      expect(goalTypeSelect.value).toBe("runs");

      // Goal value
      const goalValueInput = screen.getByLabelText("Goal Value (runs)") as HTMLInputElement;
      expect(goalValueInput.value).toBe("100");
    });
  });

  describe("Validation errors", () => {
    it("shows error when submitting with empty name", async () => {
      render(<TemplateForm {...defaultProps} initialValues={{ name: "" }} />);

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText("Template name is required")).toBeInTheDocument();
      });
    });

    it("shows error when name exceeds 100 characters", async () => {
      const longName = "a".repeat(101);

      render(<TemplateForm {...defaultProps} initialValues={{ name: longName }} />);

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText("Name must be 100 characters or less")).toBeInTheDocument();
      });
    });

    it("shows error for invalid goal value", async () => {
      render(
        <TemplateForm
          {...defaultProps}
          initialValues={{
            name: "Valid Name",
            session_goal_type: "runs",
            session_goal_value: 0,
          }}
        />
      );

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText("Goal value must be between 1 and 9999")).toBeInTheDocument();
      });
    });
  });

  describe("Duplicate name error from backend", () => {
    it("shows backend duplicate name error inline on the name field", async () => {
      mockCreateTemplate.mockRejectedValueOnce(
        new Error("A template with this name already exists")
      );

      render(
        <TemplateForm
          {...defaultProps}
          initialValues={{ name: "Existing Template", area: "Mephisto" }}
        />
      );

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(
          screen.getByText("A template with this name already exists")
        ).toBeInTheDocument();
      });

      // Verify other fields are not cleared
      const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
      expect(nameInput.value).toBe("Existing Template");

      const areaSelect = screen.getByLabelText("Area") as HTMLSelectElement;
      expect(areaSelect.value).toBe("Mephisto");
    });
  });

  describe("Save button disabled with invalid fields", () => {
    it("disables save button when name is empty", () => {
      render(<TemplateForm {...defaultProps} initialValues={{ name: "" }} />);

      const submitButton = screen.getByRole("button", { name: /Create/i });
      expect(submitButton).toBeDisabled();
    });

    it("disables save button when name is whitespace only", () => {
      render(<TemplateForm {...defaultProps} initialValues={{ name: "   " }} />);

      const submitButton = screen.getByRole("button", { name: /Create/i });
      expect(submitButton).toBeDisabled();
    });

    it("enables save button when form is valid", () => {
      render(
        <TemplateForm
          {...defaultProps}
          initialValues={{ name: "Valid Name", area: "Mephisto" }}
        />
      );

      const submitButton = screen.getByRole("button", { name: /Create/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Route dropdown", () => {
    it("shows available routes in the dropdown", () => {
      render(<TemplateForm {...defaultProps} routes={sampleRoutes} />);

      const routeSelect = screen.getByLabelText("Route (optional)") as HTMLSelectElement;
      const options = Array.from(routeSelect.options).map((o) => o.text);

      expect(options).toContain("None");
      expect(options).toContain("Meph Route");
      expect(options).toContain("Pit Route");
    });

    it("excludes deleted routes (routes not in the routes prop)", () => {
      // Only pass one route - the other is "deleted"
      const availableRoutes = [sampleRoutes[0]];

      render(<TemplateForm {...defaultProps} routes={availableRoutes} />);

      const routeSelect = screen.getByLabelText("Route (optional)") as HTMLSelectElement;
      const options = Array.from(routeSelect.options).map((o) => o.text);

      expect(options).toContain("Meph Route");
      expect(options).not.toContain("Pit Route");
    });
  });
});
