import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DetectionToast from "./DetectionToast";

describe("DetectionToast", () => {
  it("renders message text and close button", () => {
    render(
      <DetectionToast message="No image found in clipboard" onDismiss={vi.fn()} />
    );

    expect(screen.getByText("No image found in clipboard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeInTheDocument();
    expect(screen.getByText("✕")).toBeInTheDocument();
  });

  it("close button is keyboard-focusable (has tabIndex)", () => {
    render(
      <DetectionToast message="No text detected in screenshot" onDismiss={vi.fn()} />
    );

    const closeButton = screen.getByRole("button", { name: "Dismiss notification" });
    expect(closeButton).toHaveAttribute("tabindex", "0");
  });

  it("close button responds to Enter keydown", () => {
    const onDismiss = vi.fn();
    render(
      <DetectionToast message="No item detected in screenshot" onDismiss={onDismiss} />
    );

    const closeButton = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.keyDown(closeButton, { key: "Enter" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("close button responds to Space keydown", () => {
    const onDismiss = vi.fn();
    render(
      <DetectionToast message="No item detected in screenshot" onDismiss={onDismiss} />
    );

    const closeButton = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.keyDown(closeButton, { key: " " });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("close button calls onDismiss on click", () => {
    const onDismiss = vi.fn();
    render(
      <DetectionToast message="Test message" onDismiss={onDismiss} />
    );

    const closeButton = screen.getByRole("button", { name: "Dismiss notification" });
    fireEvent.click(closeButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("applies detection-toast class for fixed positioning in bottom-right", () => {
    const { container } = render(
      <DetectionToast message="Test message" onDismiss={vi.fn()} />
    );

    const toast = container.querySelector(".detection-toast");
    expect(toast).toBeInTheDocument();
  });

  it("has role=alert and aria-live=polite for accessibility", () => {
    render(
      <DetectionToast message="Accessible toast" onDismiss={vi.fn()} />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("aria-live", "polite");
  });

  it("does not render any overlay/backdrop element", () => {
    const { container } = render(
      <DetectionToast message="Test message" onDismiss={vi.fn()} />
    );

    expect(container.querySelector("[class*='overlay']")).not.toBeInTheDocument();
    expect(container.querySelector("[class*='backdrop']")).not.toBeInTheDocument();
  });
});
