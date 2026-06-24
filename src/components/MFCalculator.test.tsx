import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MFCalculator from "./MFCalculator";

describe("MFCalculator", () => {
  it("renders MF value", () => {
    render(<MFCalculator magicFind={300} />);
    expect(screen.getByText("MF: 300%")).toBeInTheDocument();
  });

  it("calculates correct effective MF for Unique (factor 250)", () => {
    // 300 * 250 / (300 + 250) = 136.36 → rounds to 136
    render(<MFCalculator magicFind={300} />);
    expect(screen.getByText("136%")).toBeInTheDocument();
  });

  it("calculates correct effective MF for Set (factor 500)", () => {
    // 300 * 500 / (300 + 500) = 187.5 → rounds to 188
    render(<MFCalculator magicFind={300} />);
    expect(screen.getByText("188%")).toBeInTheDocument();
  });

  it("calculates correct effective MF for Rare (factor 600)", () => {
    // 300 * 600 / (300 + 600) = 200
    render(<MFCalculator magicFind={300} />);
    expect(screen.getByText("200%")).toBeInTheDocument();
  });

  it("handles 0 MF", () => {
    render(<MFCalculator magicFind={0} />);
    expect(screen.getByText("MF: 0%")).toBeInTheDocument();
    expect(screen.getAllByText("0%").length).toBe(3); // All three show 0%
  });

  it("handles high MF (1000)", () => {
    // 1000 * 250 / (1000 + 250) = 200
    render(<MFCalculator magicFind={1000} />);
    expect(screen.getByText("200%")).toBeInTheDocument(); // Unique
  });
});
