import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import * as fc from "fast-check";
import TradeValueBadge from "./TradeValueBadge";
import { TRADE_VALUES, SOURCE_ATTRIBUTION } from "../data/tradeValues";

const CATEGORY_CSS: Record<string, string> = {
  "HR+":      "trade-badge-hr",
  "Mid":      "trade-badge-mid",
  "Low":      "trade-badge-low",
  "Self-use": "trade-badge-selfuse",
};

const entries = Object.entries(TRADE_VALUES);

describe("TradeValueBadge", () => {
  // Feature: trade-values, Property 5: Badge Renders for Known Items
  it("renders a badge with correct CSS class for every known item (Property 5)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...entries),
        ([name, entry]) => {
          const { container, unmount } = render(<TradeValueBadge itemName={name} />);
          const badge = container.querySelector(".trade-badge");
          expect(badge).not.toBeNull();
          expect(badge?.classList.contains(CATEGORY_CSS[entry.category])).toBe(true);
          unmount();
        }
      ),
      { numRuns: Math.min(entries.length, 100) }
    );
  });

  it("renders nothing for an unknown item", () => {
    const { container } = render(<TradeValueBadge itemName="unknown-xyz-item-not-in-db" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders .trade-badge.trade-badge-hr with text ~HR+ for Enigma", () => {
    const { container } = render(<TradeValueBadge itemName="Enigma" />);
    const badge = container.querySelector(".trade-badge.trade-badge-hr");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("~HR+");
  });

  it("title attribute contains SOURCE_ATTRIBUTION for a known item", () => {
    const { container } = render(<TradeValueBadge itemName="Enigma" />);
    const badge = container.querySelector(".trade-badge");
    expect(badge?.getAttribute("title")).toContain(SOURCE_ATTRIBUTION);
  });

  it("aria-label is present for a known item", () => {
    const { container } = render(<TradeValueBadge itemName="Enigma" />);
    const badge = container.querySelector(".trade-badge");
    expect(badge?.getAttribute("aria-label")).toBeTruthy();
    expect(badge?.getAttribute("aria-label")).toContain("trade value");
  });
});
