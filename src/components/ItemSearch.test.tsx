import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ItemSearch from "./ItemSearch";

describe("ItemSearch Component", () => {
  it("renders with default placeholder", () => {
    render(<ItemSearch onSelect={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search item...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(<ItemSearch onSelect={vi.fn()} placeholder="Find something..." />);
    expect(screen.getByPlaceholderText("Find something...")).toBeInTheDocument();
  });

  it("shows dropdown when typing", () => {
    render(<ItemSearch onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search item...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ist" } });
    expect(screen.getByText("Ist Rune")).toBeInTheDocument();
  });

  it("filters by category", () => {
    render(<ItemSearch onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search item...");
    const select = screen.getByDisplayValue("All");

    fireEvent.change(select, { target: { value: "Rune" } });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ber" } });

    expect(screen.getByText("Ber Rune")).toBeInTheDocument();
  });

  it("calls onSelect when an item is clicked", () => {
    const onSelect = vi.fn();
    render(<ItemSearch onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Search item...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Enigma" } });

    const option = screen.getByText("Enigma");
    fireEvent.mouseDown(option);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Enigma", category: "Runeword" })
    );
  });

  it("shows 'No items found' for invalid search", () => {
    render(<ItemSearch onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search item...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "xyznonexistent999" } });
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("clears input after selection", () => {
    render(<ItemSearch onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search item...") as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Enigma" } });
    fireEvent.mouseDown(screen.getByText("Enigma"));

    expect(input.value).toBe("");
  });

  it("supports keyboard navigation with Enter", () => {
    const onSelect = vi.fn();
    render(<ItemSearch onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Search item...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Zod" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalled();
  });

  it("closes dropdown on Escape", () => {
    render(<ItemSearch onSelect={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search item...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Ist" } });
    expect(screen.getByText("Ist Rune")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByText("Ist Rune")).not.toBeInTheDocument();
  });
});
