import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import OverlayEditor from "./OverlayEditor";

// Mock DnD context to avoid needing actual drag-and-drop setup
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  ),
  closestCenter: vi.fn(),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
}));

// Mock child components to isolate DOM structure testing
vi.mock("../components/overlay-editor/ProfileManager", () => ({
  default: () => <div data-testid="profile-manager">ProfileManager</div>,
}));

vi.mock("../components/overlay-editor/WidgetLibrary", () => ({
  default: () => <div data-testid="widget-library">WidgetLibrary</div>,
}));

vi.mock("../components/overlay-editor/PreviewCanvas", () => ({
  default: () => <div data-testid="preview-canvas">PreviewCanvas</div>,
}));

vi.mock("../components/overlay-editor/PropertyInspector", () => ({
  default: () => <div data-testid="property-inspector">PropertyInspector</div>,
}));

vi.mock("../components/overlay-editor/BackgroundSettings", () => ({
  default: () => <div data-testid="background-settings">BackgroundSettings</div>,
}));

vi.mock("../components/overlay-editor/DimensionControls", () => ({
  default: () => <div data-testid="dimension-controls">DimensionControls</div>,
}));

// Mock the hook to provide a loaded state with an active profile
const mockLoadProfiles = vi.fn();
vi.mock("../hooks/useOverlayProfiles", () => ({
  useOverlayProfiles: () => ({
    profiles: [
      {
        id: "profile-1",
        name: "Default",
        is_active: true,
        layout: {
          width: 400,
          height: 300,
          background_color: "#000000",
          background_opacity: 0.85,
          widgets: [],
        },
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    activeProfile: {
      id: "profile-1",
      name: "Default",
      is_active: true,
      layout: {
        width: 400,
        height: 300,
        background_color: "#000000",
        background_opacity: 0.85,
        widgets: [],
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    loading: false,
    error: null,
    loadProfiles: mockLoadProfiles,
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteProfile: vi.fn(),
    switchProfile: vi.fn(),
  }),
}));

describe("OverlayEditor DOM Structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders header, profile bar, and 3-column grid in correct order", () => {
    const { container } = render(<OverlayEditor />);

    const editorRoot = container.querySelector(".overlay-editor");
    expect(editorRoot).toBeInTheDocument();

    // Get direct children of the overlay-editor div (excluding text nodes)
    const children = Array.from(editorRoot!.children);

    // Find the key structural elements
    const header = container.querySelector(".overlay-editor-header");
    const profileBar = container.querySelector(".overlay-editor-profile-bar");
    const grid = container.querySelector(".overlay-editor-grid");

    expect(header).toBeInTheDocument();
    expect(profileBar).toBeInTheDocument();
    expect(grid).toBeInTheDocument();

    // Verify order: header comes before profile bar, profile bar comes before grid
    const headerIndex = children.indexOf(header as Element);
    const profileBarIndex = children.indexOf(profileBar as Element);
    const gridIndex = children.indexOf(grid as Element);

    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(profileBarIndex).toBeGreaterThan(headerIndex);
    expect(gridIndex).toBeGreaterThan(profileBarIndex);
  });

  it("renders page header with title and subtitle", () => {
    const { container } = render(<OverlayEditor />);

    const header = container.querySelector(".overlay-editor-header");
    expect(header).toBeInTheDocument();

    const title = header!.querySelector("h1");
    expect(title).toBeInTheDocument();
    expect(title!.textContent).toBe("Overlay Editor");

    const subtitle = header!.querySelector("p");
    expect(subtitle).toBeInTheDocument();
    expect(subtitle!.textContent).toContain("Customize");
  });

  it("renders 3-column grid with left, center, and right columns", () => {
    const { container } = render(<OverlayEditor />);

    const grid = container.querySelector(".overlay-editor-grid");
    expect(grid).toBeInTheDocument();

    const left = grid!.querySelector(".overlay-editor-left");
    const center = grid!.querySelector(".overlay-editor-center");
    const right = grid!.querySelector(".overlay-editor-right");

    expect(left).toBeInTheDocument();
    expect(center).toBeInTheDocument();
    expect(right).toBeInTheDocument();
  });

  it("places WidgetLibrary in left column, PreviewCanvas in center, PropertyInspector in right", () => {
    const { container, getByTestId } = render(<OverlayEditor />);

    const left = container.querySelector(".overlay-editor-left");
    const center = container.querySelector(".overlay-editor-center");
    const right = container.querySelector(".overlay-editor-right");

    expect(left).toContainElement(getByTestId("widget-library"));
    expect(center).toContainElement(getByTestId("preview-canvas"));
    expect(right).toContainElement(getByTestId("property-inspector"));
  });

  it("renders canvas settings as children of center column", () => {
    const { container, getByTestId } = render(<OverlayEditor />);

    const center = container.querySelector(".overlay-editor-center");
    expect(center).toBeInTheDocument();

    // Canvas settings container exists within center column
    const canvasSettings = center!.querySelector(
      ".overlay-editor-canvas-settings"
    );
    expect(canvasSettings).toBeInTheDocument();

    // DimensionControls and BackgroundSettings are inside canvas settings
    expect(canvasSettings).toContainElement(getByTestId("dimension-controls"));
    expect(canvasSettings).toContainElement(getByTestId("background-settings"));
  });

  it("renders canvas settings below PreviewCanvas within center column", () => {
    const { container, getByTestId } = render(<OverlayEditor />);

    const center = container.querySelector(".overlay-editor-center");
    const centerChildren = Array.from(center!.children);

    const previewCanvas = getByTestId("preview-canvas");
    const canvasSettings = center!.querySelector(
      ".overlay-editor-canvas-settings"
    );

    // Find the indices — PreviewCanvas should come before canvas settings
    const canvasIndex = centerChildren.indexOf(
      previewCanvas.closest(".overlay-editor-center > *") || previewCanvas
    );
    const settingsIndex = centerChildren.indexOf(canvasSettings as Element);

    expect(canvasIndex).toBeGreaterThanOrEqual(0);
    expect(settingsIndex).toBeGreaterThan(canvasIndex);
  });

  it("renders ProfileManager inside the profile bar", () => {
    const { container, getByTestId } = render(<OverlayEditor />);

    const profileBar = container.querySelector(".overlay-editor-profile-bar");
    expect(profileBar).toContainElement(getByTestId("profile-manager"));
  });
});
