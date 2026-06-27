import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuickTags, { PREDEFINED_TAGS } from "./QuickTags";

describe("QuickTags Component", () => {
  it("renders all predefined tag buttons", () => {
    render(<QuickTags activeTags={[]} onToggle={() => {}} />);
    for (const tag of PREDEFINED_TAGS) {
      expect(screen.getByText(tag.label)).toBeInTheDocument();
    }
  });

  it("marks active tags with active class and aria-pressed", () => {
    render(<QuickTags activeTags={["gg", "fast"]} onToggle={() => {}} />);
    const ggBtn = screen.getByText("🔥 GG");
    const fastBtn = screen.getByText("⚡ Fast");
    const slowBtn = screen.getByText("🐢 Slow");

    expect(ggBtn).toHaveClass("active");
    expect(ggBtn).toHaveAttribute("aria-pressed", "true");
    expect(fastBtn).toHaveClass("active");
    expect(fastBtn).toHaveAttribute("aria-pressed", "true");
    expect(slowBtn).not.toHaveClass("active");
    expect(slowBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onToggle with the tag value when clicked", () => {
    const onToggle = vi.fn();
    render(<QuickTags activeTags={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByText("💀 Death"));
    expect(onToggle).toHaveBeenCalledWith("death");

    fireEvent.click(screen.getByText("🎯 Target"));
    expect(onToggle).toHaveBeenCalledWith("target");
  });

  it("renders the Tags label", () => {
    render(<QuickTags activeTags={[]} onToggle={() => {}} />);
    expect(screen.getByText("Tags:")).toBeInTheDocument();
  });
});
