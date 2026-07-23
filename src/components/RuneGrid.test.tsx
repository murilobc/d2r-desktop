import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RuneGrid from "./RuneGrid";
import { RUNE_DEFINITIONS } from "../data/runes";

describe("RuneGrid", () => {
  const emptyInventory: Record<string, number> = {};
  const defaultProps = {
    inventory: emptyInventory,
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onSetCount: vi.fn(),
    onReset: vi.fn(),
  };

  it("renders all 33 RuneCell components (one per rune)", () => {
    render(<RuneGrid {...defaultProps} />);

    for (const rune of RUNE_DEFINITIONS) {
      expect(screen.getByText(rune.name)).toBeInTheDocument();
    }
  });

  it("renders exactly 33 rune cells", () => {
    const { container } = render(<RuneGrid {...defaultProps} />);
    const cells = container.querySelectorAll(".rune-cell");
    expect(cells).toHaveLength(33);
  });

  it("renders the .rune-grid container with 6-column grid layout class", () => {
    const { container } = render(<RuneGrid {...defaultProps} />);
    const grid = container.querySelector(".rune-grid");
    expect(grid).toBeInTheDocument();
  });

  it("passes correct count from inventory to each RuneCell", () => {
    const inventory: Record<string, number> = { El: 5, Zod: 2 };
    render(<RuneGrid {...defaultProps} inventory={inventory} />);

    // El should show count 5
    expect(screen.getByLabelText("El count 5, click to edit")).toBeInTheDocument();
    // Zod should show count 2
    expect(screen.getByLabelText("Zod count 2, click to edit")).toBeInTheDocument();
    // A rune not in inventory should show count 0
    expect(screen.getByLabelText("Tir count 0, click to edit")).toBeInTheDocument();
  });

  it("renders without errors when onSetCount and onReset callbacks are provided", () => {
    const onSetCount = vi.fn();
    const onReset = vi.fn();

    expect(() => {
      render(
        <RuneGrid
          {...defaultProps}
          onSetCount={onSetCount}
          onReset={onReset}
        />
      );
    }).not.toThrow();
  });

  it("renders the rune-grid-container wrapper", () => {
    const { container } = render(<RuneGrid {...defaultProps} />);
    expect(container.querySelector(".rune-grid-container")).toBeInTheDocument();
  });

  it("renders the grid title", () => {
    render(<RuneGrid {...defaultProps} />);
    expect(screen.getByText("Rune Inventory")).toBeInTheDocument();
  });
});
