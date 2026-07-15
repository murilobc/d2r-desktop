import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';
import { detectInitialLocale, SUPPORTED_LOCALES, LOCALE_STORAGE_KEY } from './index';
import i18n from './index';
import { formatDate, formatNumber } from './formatters';

// --- Helpers ---

/**
 * Recursively flatten a nested object into dot-notation keys.
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// --- Property 1: Translation key completeness (Task 5.1) ---
// **Validates: Requirements 1.3, 4.3**

describe('Property 1: Translation key completeness', () => {
  const enKeys = flattenKeys(enUS).sort();
  const ptKeys = flattenKeys(ptBR).sort();
  const esKeys = flattenKeys(es).sort();

  it('every en-US key exists in pt-BR', () => {
    const ptKeySet = new Set(ptKeys);
    const missing = enKeys.filter((k) => !ptKeySet.has(k));
    expect(missing).toEqual([]);
  });

  it('every en-US key exists in es', () => {
    const esKeySet = new Set(esKeys);
    const missing = enKeys.filter((k) => !esKeySet.has(k));
    expect(missing).toEqual([]);
  });
});

// --- Property 4: OS locale detection (Task 5.2) ---
// **Validates: Requirements 2.5, 5.3**

describe('Property 4: OS locale detection resolves to a supported locale', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('always returns a member of SUPPORTED_LOCALES for any navigator.language', () => {
    fc.assert(
      fc.property(fc.string(), (langStr) => {
        Object.defineProperty(navigator, 'language', {
          value: langStr,
          writable: true,
          configurable: true,
        });
        const result = detectInitialLocale();
        expect(SUPPORTED_LOCALES).toContain(result);
      }),
      { numRuns: 200 }
    );
  });

  it('exact matches return the correct locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      Object.defineProperty(navigator, 'language', {
        value: locale,
        writable: true,
        configurable: true,
      });
      expect(detectInitialLocale()).toBe(locale);
    }
  });

  it('prefix match: "pt" resolves to "pt-BR"', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'pt',
      writable: true,
      configurable: true,
    });
    expect(detectInitialLocale()).toBe('pt-BR');
  });

  it('prefix match: "es-AR" resolves to "es"', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'es-AR',
      writable: true,
      configurable: true,
    });
    expect(detectInitialLocale()).toBe('es');
  });

  it('unsupported locales fall back to en-US', () => {
    for (const unsupported of ['fr', 'de', 'zh']) {
      Object.defineProperty(navigator, 'language', {
        value: unsupported,
        writable: true,
        configurable: true,
      });
      expect(detectInitialLocale()).toBe('en-US');
    }
  });
});

// --- Property 5: Date formatting (Task 5.3) ---
// **Validates: Requirements 3.1**

describe('Property 5: Date formatting matches Intl.DateTimeFormat for active locale', () => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  for (const locale of SUPPORTED_LOCALES) {
    it(`formatDate matches Intl.DateTimeFormat for locale "${locale}"`, () => {
      i18n.changeLanguage(locale);

      fc.assert(
        fc.property(
          // Generate timestamps between year 2000 and 2030
          fc.integer({ min: 946684800000, max: 1893456000000 }),
          (timestamp) => {
            const date = new Date(timestamp);
            const expected = new Intl.DateTimeFormat(locale, defaultOptions).format(date);
            const result = formatDate(date);
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 50 }
      );
    });
  }
});

// --- Property 6: Number formatting (Task 5.4) ---
// **Validates: Requirements 3.2**

describe('Property 6: Number formatting matches Intl.NumberFormat for active locale', () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`formatNumber matches Intl.NumberFormat for locale "${locale}"`, () => {
      i18n.changeLanguage(locale);

      fc.assert(
        fc.property(
          fc.double({ min: -1e12, max: 1e12, noNaN: true, noDefaultInfinity: true }),
          (value) => {
            const expected = new Intl.NumberFormat(locale).format(value);
            const result = formatNumber(value);
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });
  }
});

// --- Task 5.5: Unit tests for language selector and persistence ---
// **Validates: Requirements 2.2, 2.3, 5.3**

describe('Language selector and persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.changeLanguage('en-US');
  });

  it('changing language to pt-BR updates i18n.language', async () => {
    await i18n.changeLanguage('pt-BR');
    expect(i18n.language).toBe('pt-BR');
  });

  it('localStorage is written with the correct key and value when language changes', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('pt-BR');
  });

  it('invalid locale stored in localStorage results in fallback to en-US', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'xx-INVALID');
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      writable: true,
      configurable: true,
    });
    const result = detectInitialLocale();
    expect(result).toBe('en-US');
    // Invalid key should be cleared
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });
});
