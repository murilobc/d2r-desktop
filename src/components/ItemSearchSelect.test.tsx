import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ItemSearchSelect from "./ItemSearchSelect";

const mockItems = [
  { id: "shako", name: "Shako", rarity: "Unique" },
  { id: "ber_rune", name: "Ber Rune", rarity: "Rune" },
  { id: "jah_rune", name: "Jah Rune", rarity: "Rune" },
  { id: "tal_armor", name: "Tal Rasha's Guardianship", rarity: "Set" },
  { id: "key_of_terror", name: "Key of Terror", rarity: "Key" },
];

describe("ItemSearchSelect", () => {
  it("renders with search input and rarity filter buttons", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    expect(screen.getByLabelText("Select item")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Filter by rarity" })).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Unique")).toBeInTheDocument();
    expect(screen.getByText("Set")).toBeInTheDocument();
    expect(screen.getByText("Rune")).toBeInTheDocument();
    expect(screen.getByText("Key")).toBeInTheDocument();
  });

  it("shows placeholder with selected item name", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item") as HTMLInputElement;
    expect(input.placeholder).toBe("Shako");
  });

  it("opens dropdown on focus and shows all items", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
  });

  it("filters items by text query", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Rune" } });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(screen.getByText("Ber Rune")).toBeInTheDocument();
    expect(screen.getByText("Jah Rune")).toBeInTheDocument();
  });

  it("filters items by rarity button", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);

    const radiogroup = screen.getByRole("radiogroup", { name: "Filter by rarity" });
    const runeButton = radiogroup.querySelector('button[aria-pressed="false"]:nth-child(4)') as HTMLElement;
    fireEvent.click(runeButton);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(runeButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect when an item is clicked", () => {
    const onSelect = vi.fn();
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={onSelect} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);

    fireEvent.mouseDown(screen.getByText("Ber Rune"));
    expect(onSelect).toHaveBeenCalledWith("ber_rune");
  });

  it("shows 'No items found' for non-matching query", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "xyznonexistent" } });

    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("supports keyboard navigation - ArrowDown moves highlight", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveClass("highlighted");
  });

  it("supports keyboard navigation - Enter selects highlighted item", () => {
    const onSelect = vi.fn();
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={onSelect} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("shako");
  });

  it("supports keyboard navigation - Escape closes dropdown", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("marks the selected item with aria-selected", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);

    const options = screen.getAllByRole("option");
    const selectedOption = options.find((o) => o.textContent?.includes("Shako"));
    expect(selectedOption).toHaveAttribute("aria-selected", "true");
  });

  it("has aria-expanded on combobox wrapper", () => {
    render(
      <ItemSearchSelect items={mockItems} selectedId="shako" onSelect={vi.fn()} />
    );
    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveAttribute("aria-expanded", "false");

    const input = screen.getByLabelText("Select item");
    fireEvent.focus(input);
    expect(combobox).toHaveAttribute("aria-expanded", "true");
  });

  it("uses custom label prop for aria-label", () => {
    render(
      <ItemSearchSelect
        items={mockItems}
        selectedId="shako"
        onSelect={vi.fn()}
        label="Search items"
      />
    );
    expect(screen.getByLabelText("Search items")).toBeInTheDocument();
  });
});
