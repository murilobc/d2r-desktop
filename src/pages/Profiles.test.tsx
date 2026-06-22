import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import Profiles from "./Profiles";
import { mockProfiles } from "../test/mocks";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

describe("Profiles Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_profiles") return mockProfiles;
      return undefined;
    });
  });

  it("renders profiles page title", async () => {
    render(<Profiles onSelectProfile={vi.fn()} />);
    expect(screen.getByText("Profiles")).toBeInTheDocument();
  });

  it("renders profile cards after loading", async () => {
    render(<Profiles onSelectProfile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("TestSorc")).toBeInTheDocument();
      expect(screen.getByText("HammerPally")).toBeInTheDocument();
    });
  });

  it("shows create form when clicking New Profile button", async () => {
    render(<Profiles onSelectProfile={vi.fn()} />);
    fireEvent.click(screen.getByText("+ New Profile"));
    expect(screen.getByText("Create Profile")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Character name")).toBeInTheDocument();
  });

  it("hides form when clicking Cancel", async () => {
    render(<Profiles onSelectProfile={vi.fn()} />);
    fireEvent.click(screen.getByText("+ New Profile"));
    expect(screen.getByText("Create Profile")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Create Profile")).not.toBeInTheDocument();
  });

  it("calls onSelectProfile when Select is clicked", async () => {
    const onSelect = vi.fn();
    render(<Profiles onSelectProfile={onSelect} />);
    await waitFor(() => {
      expect(screen.getByText("TestSorc")).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByText("Select");
    fireEvent.click(selectButtons[0]);
    expect(onSelect).toHaveBeenCalledWith(mockProfiles[0]);
  });

  it("shows empty state when no profiles", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_profiles") return [];
      return undefined;
    });

    render(<Profiles onSelectProfile={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("No profiles created. Create one to get started!")).toBeInTheDocument();
    });
  });

  it("calls create_profile on form submit", async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_profiles") return [];
      if (cmd === "create_profile") return { id: "new-1", name: "NewChar", class: "Warlock", mode: "Ladder", created_at: "", updated_at: "" };
      return undefined;
    });

    render(<Profiles onSelectProfile={vi.fn()} />);
    fireEvent.click(screen.getByText("+ New Profile"));

    const nameInput = screen.getByPlaceholderText("Character name");
    fireEvent.change(nameInput, { target: { value: "NewChar" } });
    fireEvent.click(screen.getByText("Create Profile"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_profile", expect.objectContaining({
        input: expect.objectContaining({ name: "NewChar" }),
      }));
    });
  });
});
