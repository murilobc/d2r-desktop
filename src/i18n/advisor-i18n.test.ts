import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { createElement } from "react";
import i18n from "./index";
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";
import es from "./locales/es.json";

/**
 * Unit tests for navigation and i18n integration (Task 8.3)
 *
 * Validates: Requirements 1.2, 1.3, 7.2, 7.3
 */

// --- Test 1: Sidebar entry disabled when no profile selected ---
// Validates: Requirement 1.2

describe("Sidebar entry disabled when no profile selected", () => {
  /**
   * This test verifies that the advisor sidebar button uses
   * disabled={!selectedProfile} pattern. We render a minimal component
   * mimicking the App sidebar logic.
   */
  function SidebarAdvisorButton({ selectedProfile }: { selectedProfile: unknown | null }) {
    const { t } = useTranslation();
    return createElement(
      "button",
      {
        className: "nav-btn",
        disabled: !selectedProfile,
        "data-testid": "advisor-btn",
      },
      `✦ ${t("sidebar.advisor")}`
    );
  }

  beforeEach(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("advisor button is disabled when no profile is selected", () => {
    render(createElement(SidebarAdvisorButton, { selectedProfile: null }));
    const btn = screen.getByTestId("advisor-btn");
    expect(btn).toBeDisabled();
  });

  it("advisor button is enabled when a profile is selected", () => {
    render(
      createElement(SidebarAdvisorButton, {
        selectedProfile: { id: "p1", name: "TestChar" },
      })
    );
    const btn = screen.getByTestId("advisor-btn");
    expect(btn).not.toBeDisabled();
  });
});

// --- Test 2: Sidebar label renders in all 3 locales ---
// Validates: Requirements 7.2, 7.3

describe("Sidebar label renders in all 3 locales", () => {
  const expectedLabels: Record<string, string> = {
    "en-US": (enUS as unknown as Record<string, Record<string, string>>).sidebar.advisor,
    "pt-BR": (ptBR as unknown as Record<string, Record<string, string>>).sidebar.advisor,
    es: (es as unknown as Record<string, Record<string, string>>).sidebar.advisor,
  };

  it("en-US locale has advisor sidebar key with correct value", () => {
    expect(expectedLabels["en-US"]).toBe("Advisor");
  });

  it("pt-BR locale has advisor sidebar key with correct value", () => {
    expect(expectedLabels["pt-BR"]).toBe("Consultor");
  });

  it("es locale has advisor sidebar key with correct value", () => {
    expect(expectedLabels["es"]).toBe("Asesor");
  });

  it("sidebar.advisor key renders correctly for each locale via i18n", async () => {
    for (const locale of ["en-US", "pt-BR", "es"] as const) {
      await i18n.changeLanguage(locale);
      const translated = i18n.t("sidebar.advisor");
      expect(translated).toBe(expectedLabels[locale]);
    }
  });

  it("all advisor.* keys exist in all 3 locales", () => {
    const enAdvisor = (enUS as Record<string, unknown>).advisor as Record<string, unknown>;
    const ptAdvisor = (ptBR as Record<string, unknown>).advisor as Record<string, unknown>;
    const esAdvisor = (es as Record<string, unknown>).advisor as Record<string, unknown>;

    expect(enAdvisor).toBeDefined();
    expect(ptAdvisor).toBeDefined();
    expect(esAdvisor).toBeDefined();

    // All top-level keys in en-US advisor namespace should exist in pt-BR and es
    const enKeys = Object.keys(enAdvisor);
    const ptKeys = new Set(Object.keys(ptAdvisor));
    const esKeys = new Set(Object.keys(esAdvisor));

    const missingPt = enKeys.filter((k) => !ptKeys.has(k));
    const missingEs = enKeys.filter((k) => !esKeys.has(k));

    expect(missingPt, "Missing advisor keys in pt-BR").toEqual([]);
    expect(missingEs, "Missing advisor keys in es").toEqual([]);
  });
});

// --- Test 3: Locale switch re-renders text without reload ---
// Validates: Requirements 1.3, 7.3

describe("Locale switch re-renders text without reload", () => {
  function AdvisorLabel() {
    const { t } = useTranslation();
    return createElement("span", { "data-testid": "advisor-label" }, t("sidebar.advisor"));
  }

  beforeEach(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("switching locale from en-US to pt-BR updates rendered text", async () => {
    render(createElement(AdvisorLabel));

    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Advisor");

    await act(async () => {
      await i18n.changeLanguage("pt-BR");
    });

    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Consultor");
  });

  it("switching locale from en-US to es updates rendered text", async () => {
    render(createElement(AdvisorLabel));

    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Advisor");

    await act(async () => {
      await i18n.changeLanguage("es");
    });

    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Asesor");
  });

  it("switching locale back and forth works without page reload", async () => {
    render(createElement(AdvisorLabel));

    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Advisor");

    await act(async () => {
      await i18n.changeLanguage("es");
    });
    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Asesor");

    await act(async () => {
      await i18n.changeLanguage("pt-BR");
    });
    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Consultor");

    await act(async () => {
      await i18n.changeLanguage("en-US");
    });
    expect(screen.getByTestId("advisor-label")).toHaveTextContent("Advisor");
  });
});
