import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';

/**
 * Property 11: I18n Key Resolution
 *
 * For any achievement definition with name_key K and any supported locale L,
 * the rendered achievement name SHALL equal the translation string at path
 * `achievements.names.{K}` in locale L's translation file. If the key is
 * missing in locale L, it SHALL fall back to the en-US value.
 *
 * **Validates: Requirements 11.1, 11.3**
 */

// All achievement name_keys used by seeded definitions (matching task 8.1 seed data)
const ACHIEVEMENT_NAME_KEYS = [
  // Milestone - runs
  'milestone_100_runs',
  'milestone_500_runs',
  'milestone_1000_runs',
  'milestone_5000_runs',
  // Milestone - items
  'milestone_100_items',
  'milestone_500_items',
  'milestone_1000_items',
  // Milestone - time
  'milestone_50_hours',
  'milestone_100_hours',
  'milestone_500_hours',
  // Streak
  'streak_3_days',
  'streak_7_days',
  'streak_14_days',
  'streak_30_days',
  // Per-class
  'class_amazon_500',
  'class_amazon_1000',
  'class_necromancer_500',
  'class_necromancer_1000',
  'class_barbarian_500',
  'class_barbarian_1000',
  'class_sorceress_500',
  'class_sorceress_1000',
  'class_paladin_500',
  'class_paladin_1000',
  'class_druid_500',
  'class_druid_1000',
  'class_assassin_500',
  'class_assassin_1000',
  'class_warlock_500',
  'class_warlock_1000',
  // Per-area
  'area_pit_100',
  'area_pit_500',
  'area_chaos_sanctuary_100',
  'area_chaos_sanctuary_500',
  'area_ancient_tunnels_100',
  'area_ancient_tunnels_500',
  'area_cow_level_100',
  'area_cow_level_500',
  'area_travincal_100',
  'area_travincal_500',
  'area_baal_100',
  'area_baal_500',
] as const;

// Description keys are the same as name keys in this implementation
const ACHIEVEMENT_DESCRIPTION_KEYS = ACHIEVEMENT_NAME_KEYS;

interface LocaleData {
  achievements: {
    names: Record<string, string>;
    descriptions: Record<string, string>;
  };
}

const locales: Record<string, LocaleData> = {
  'en-US': enUS as unknown as LocaleData,
  'pt-BR': ptBR as unknown as LocaleData,
  es: es as unknown as LocaleData,
};

describe('Property 11: I18n Key Resolution', () => {
  describe('name_key resolution across all locales', () => {
    it('every achievement name_key resolves to a non-empty string in all three locales', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACHIEVEMENT_NAME_KEYS),
          fc.constantFrom('en-US', 'pt-BR', 'es'),
          (nameKey, locale) => {
            const localeData = locales[locale];
            const value = localeData.achievements.names[nameKey];
            expect(value).toBeDefined();
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('description_key resolution across all locales', () => {
    it('every achievement description_key resolves to a non-empty string in all three locales', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACHIEVEMENT_DESCRIPTION_KEYS),
          fc.constantFrom('en-US', 'pt-BR', 'es'),
          (descKey, locale) => {
            const localeData = locales[locale];
            const value = localeData.achievements.descriptions[descKey];
            expect(value).toBeDefined();
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('fallback to en-US when key is missing in pt-BR or es', () => {
    it('if a name_key is missing in pt-BR or es, it exists in en-US', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACHIEVEMENT_NAME_KEYS),
          fc.constantFrom('pt-BR', 'es'),
          (nameKey, locale) => {
            const localeData = locales[locale];
            const value = localeData.achievements.names[nameKey];
            if (value === undefined || value === '') {
              // Fallback: must exist and be non-empty in en-US
              const fallback = locales['en-US'].achievements.names[nameKey];
              expect(fallback).toBeDefined();
              expect(typeof fallback).toBe('string');
              expect(fallback.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 300 }
      );
    });

    it('if a description_key is missing in pt-BR or es, it exists in en-US', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ACHIEVEMENT_DESCRIPTION_KEYS),
          fc.constantFrom('pt-BR', 'es'),
          (descKey, locale) => {
            const localeData = locales[locale];
            const value = localeData.achievements.descriptions[descKey];
            if (value === undefined || value === '') {
              // Fallback: must exist and be non-empty in en-US
              const fallback = locales['en-US'].achievements.descriptions[descKey];
              expect(fallback).toBeDefined();
              expect(typeof fallback).toBe('string');
              expect(fallback.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 300 }
      );
    });
  });

  describe('en-US always has all keys (primary locale completeness)', () => {
    it('every name_key exists and is non-empty in en-US', () => {
      for (const key of ACHIEVEMENT_NAME_KEYS) {
        const value = locales['en-US'].achievements.names[key];
        expect(value, `Missing name_key "${key}" in en-US`).toBeDefined();
        expect(value.length, `Empty name_key "${key}" in en-US`).toBeGreaterThan(0);
      }
    });

    it('every description_key exists and is non-empty in en-US', () => {
      for (const key of ACHIEVEMENT_DESCRIPTION_KEYS) {
        const value = locales['en-US'].achievements.descriptions[key];
        expect(value, `Missing description_key "${key}" in en-US`).toBeDefined();
        expect(value.length, `Empty description_key "${key}" in en-US`).toBeGreaterThan(0);
      }
    });
  });
});
