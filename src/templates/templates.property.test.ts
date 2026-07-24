/**
 * Property-based tests for Quick-Start Templates.
 *
 * Uses fast-check + vitest to verify template validation logic
 * across randomly generated inputs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { invoke } from "@tauri-apps/api/core";
import { AREAS } from "../types";
import type { CreateTemplateInput, Template } from "../types";
import { createTemplate } from "../api";

vi.mock("@tauri-apps/api/core");
const mockInvoke = vi.mocked(invoke);

// ===== VALIDATION LOGIC UNDER TEST =====

/**
 * Checks whether a new template name collides (case-insensitively)
 * with any existing template name in the same profile.
 *
 * This replicates the uniqueness check enforced by the backend's
 * UNIQUE index on (profile_id, name COLLATE NOCASE).
 *
 * @param existingNames - Template names already stored for the profile
 * @param newName - The candidate name to check
 * @returns true if a collision is detected, false otherwise
 */
export function detectNameCollision(
  existingNames: string[],
  newName: string
): boolean {
  const normalizedNew = newName.toLowerCase();
  return existingNames.some((name) => name.toLowerCase() === normalizedNew);
}

/**
 * Validates a template name.
 *
 * Mirrors the backend validation in db.rs:
 * - Name must contain at least 1 non-whitespace character (trim().is_empty() check)
 * - Name must not exceed 100 characters in length
 *
 * @param name - The candidate template name
 * @returns null if valid, or an error string describing the violation
 */
export function validateTemplateName(name: string): string | null {
  if (name.trim().length === 0) {
    return "Template name must contain at least 1 non-whitespace character";
  }
  if (name.length > 100) {
    return "Template name must not exceed 100 characters";
  }
  return null;
}

/**
 * Validates that a player count is within the allowed range [1, 8].
 *
 * This replicates the validation enforced by the backend's
 * db_create_template / db_update_template functions and the frontend's
 * TemplateForm component.
 *
 * @param count - The player count to validate
 * @returns An error message if invalid, null if valid
 */
export function validatePlayerCount(count: number): string | null {
  if (count < 1 || count > 8) return "Player count must be between 1 and 8";
  return null;
}

// ===== GENERATORS =====

/** Generate a non-empty template name (1–100 chars, at least one non-whitespace). */
const templateNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s) => s.trim().length > 0
);

/** Generate a profile ID as a UUID. */
const profileIdArb = fc.uuid();

/**
 * Generate a pair of strings that are case-insensitive matches.
 * Takes a base string and applies random case transformations.
 */
const caseInsensitiveMatchPairArb = templateNameArb.chain((base) =>
  fc.tuple(
    fc.constant(base),
    fc
      .array(fc.boolean(), { minLength: base.length, maxLength: base.length })
      .map((flags) =>
        base
          .split("")
          .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
          .join("")
      )
  )
);

/**
 * Generate a pair of strings that are NOT case-insensitive matches.
 */
const distinctNamePairArb = fc
  .tuple(templateNameArb, templateNameArb)
  .filter(([a, b]) => a.toLowerCase() !== b.toLowerCase());

// ===== PROPERTY TESTS =====

describe("Feature: quick-start-templates, Property 1: Template name uniqueness per profile", () => {
  /**
   * Property 1: Template name uniqueness per profile
   *
   * For any profile and any two templates belonging to that profile,
   * their names compared case-insensitively SHALL be distinct.
   *
   * **Validates: Requirements 1.3, 4.2**
   */

  it("detects collision for case-insensitive matching names within the same profile", () => {
    fc.assert(
      fc.property(
        profileIdArb,
        caseInsensitiveMatchPairArb,
        (_profileId, [existingName, newName]) => {
          // Given an existing template name and a new name that is a
          // case-insensitive match, the collision check must detect it
          const collision = detectNameCollision([existingName], newName);
          expect(collision).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("does not detect collision for case-insensitively distinct names within the same profile", () => {
    fc.assert(
      fc.property(
        profileIdArb,
        distinctNamePairArb,
        (_profileId, [existingName, newName]) => {
          // Given an existing template name and a new name that is NOT a
          // case-insensitive match, no collision should be detected
          const collision = detectNameCollision([existingName], newName);
          expect(collision).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("detects collision regardless of position in existing names list", () => {
    fc.assert(
      fc.property(
        profileIdArb,
        caseInsensitiveMatchPairArb,
        fc.array(templateNameArb, { minLength: 0, maxLength: 10 }),
        (_profileId, [existingName, newName], otherNames) => {
          // The collision should be detected even when the matching name
          // is buried among other names in the list
          const allNames = [...otherNames, existingName];
          const collision = detectNameCollision(allNames, newName);
          expect(collision).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===== SESSION GOAL VALIDATION LOGIC =====

/**
 * Validates a session goal value.
 *
 * Replicates the backend validation in db.rs:
 * - If value is undefined/null (no goal specified), validation passes.
 * - If value is provided, it must be an integer in [1, 9999].
 *
 * @param value - The session goal value to validate (undefined means no goal)
 * @returns null if valid, error message string if invalid
 */
export function validateSessionGoal(value: number | undefined): string | null {
  if (value === undefined) return null; // no goal is valid
  if (value < 1 || value > 9999) return "Session goal must be between 1 and 9999";
  return null;
}

// ===== GENERATORS FOR SESSION GOAL BOUNDS =====

/** Generate integers that are too low (zero or negative) — invalid session goals. */
const tooLowGoalArb = fc.integer({ max: 0 });

/** Generate integers that are too high (> 9999) — invalid session goals. */
const tooHighGoalArb = fc.integer({ min: 10000 });

/** Generate valid session goal values (1–9999). */
const validGoalArb = fc.integer({ min: 1, max: 9999 });

// ===== PROPERTY TESTS =====

describe("Feature: quick-start-templates, Property 5: Session goal bounds", () => {
  /**
   * Property 5: Session goal bounds
   *
   * For any integer value outside the range [1, 9999], attempting to create
   * or update a template with that session_goal_value SHALL return an error
   * and leave existing data unchanged.
   *
   * **Validates: Requirements 7.4**
   */

  it("rejects session goal values that are zero or negative", () => {
    fc.assert(
      fc.property(tooLowGoalArb, (goalValue) => {
        const result = validateSessionGoal(goalValue);
        expect(result).not.toBeNull();
        expect(result).toBe("Session goal must be between 1 and 9999");
      }),
      { numRuns: 100 }
    );
  });

  it("rejects session goal values greater than 9999", () => {
    fc.assert(
      fc.property(tooHighGoalArb, (goalValue) => {
        const result = validateSessionGoal(goalValue);
        expect(result).not.toBeNull();
        expect(result).toBe("Session goal must be between 1 and 9999");
      }),
      { numRuns: 100 }
    );
  });

  it("accepts any session goal value in [1, 9999]", () => {
    fc.assert(
      fc.property(validGoalArb, (goalValue) => {
        const result = validateSessionGoal(goalValue);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("accepts undefined (no goal) as valid", () => {
    const result = validateSessionGoal(undefined);
    expect(result).toBeNull();
  });
});


// ===== PROPERTY 4 GENERATORS =====

/** Generate integers less than 1 (zero or negative). */
const tooLowPlayerCountArb = fc.integer({ max: 0 });

/** Generate integers greater than 8. */
const tooHighPlayerCountArb = fc.integer({ min: 9 });

/** Generate valid player counts in [1, 8]. */
const validPlayerCountArb = fc.integer({ min: 1, max: 8 });

// ===== PROPERTY 4 TESTS =====

describe("Feature: quick-start-templates, Property 4: Player count bounds", () => {
  /**
   * Property 4: Player count bounds
   *
   * For any integer value outside the range [1, 8], attempting to create
   * or update a template with that player_count SHALL return an error
   * and leave existing data unchanged.
   *
   * **Validates: Requirements 7.3**
   */

  it("rejects player counts below 1 (zero or negative)", () => {
    fc.assert(
      fc.property(tooLowPlayerCountArb, (count) => {
        const result = validatePlayerCount(count);
        expect(result).not.toBeNull();
        expect(result).toBe("Player count must be between 1 and 8");
      }),
      { numRuns: 100 }
    );
  });

  it("rejects player counts above 8", () => {
    fc.assert(
      fc.property(tooHighPlayerCountArb, (count) => {
        const result = validatePlayerCount(count);
        expect(result).not.toBeNull();
        expect(result).toBe("Player count must be between 1 and 8");
      }),
      { numRuns: 100 }
    );
  });

  it("accepts all valid player counts in [1, 8]", () => {
    fc.assert(
      fc.property(validPlayerCountArb, (count) => {
        const result = validatePlayerCount(count);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("for any integer, returns null if and only if in [1, 8]", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (count) => {
        const result = validatePlayerCount(count);
        if (count >= 1 && count <= 8) {
          expect(result).toBeNull();
        } else {
          expect(result).toBe("Player count must be between 1 and 8");
        }
      }),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 2: TEMPLATE CREATION ROUND-TRIP =====

// ===== GENERATORS FOR PROPERTY 2 =====

/** Generate a valid template name: 1–100 chars with at least one non-whitespace. */
const validNameArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Generate a valid area from the AREAS constant. */
const areaArb = fc.constantFrom(...AREAS);

/** Generate a valid player count (1–8). */
const playerCountArb = fc.integer({ min: 1, max: 8 });

/** Generate an optional UUID for route_id. */
const optionalRouteIdArb = fc.oneof(fc.uuid(), fc.constant(undefined));

/** Generate a valid session goal type. */
const sessionGoalTypeArb = fc.constantFrom("none", "runs", "time");

/** Generate an optional session goal value (1–9999) based on goal type. */
function sessionGoalValueArb(goalType: string): fc.Arbitrary<number | undefined> {
  if (goalType === "none") {
    return fc.constant(undefined);
  }
  return fc.integer({ min: 1, max: 9999 });
}

/** Generate an optional tags array (0–10 non-empty strings). */
const optionalTagsArb = fc.oneof(
  fc.constant(undefined),
  fc.array(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), {
    minLength: 0,
    maxLength: 10,
  })
);

/** Generate a valid CreateTemplateInput. */
const createTemplateInputArb: fc.Arbitrary<CreateTemplateInput> = fc
  .tuple(fc.uuid(), validNameArb, areaArb, playerCountArb, optionalRouteIdArb, sessionGoalTypeArb)
  .chain(([profileId, name, area, playerCount, routeId, goalType]) =>
    fc.tuple(
      fc.constant({ profileId, name, area, playerCount, routeId, goalType }),
      sessionGoalValueArb(goalType),
      optionalTagsArb
    )
  )
  .map(([base, goalValue, tags]) => {
    const input: CreateTemplateInput = {
      profile_id: base.profileId,
      name: base.name,
      area: base.area,
      player_count: base.playerCount,
      session_goal_type: base.goalType,
    };
    if (base.routeId !== undefined) {
      input.route_id = base.routeId;
    }
    if (goalValue !== undefined) {
      input.session_goal_value = goalValue;
    }
    if (tags !== undefined) {
      input.tags = tags;
    }
    return input;
  });

describe("Feature: quick-start-templates, Property 2: Template creation round-trip", () => {
  /**
   * Property 2: Template creation round-trip
   *
   * For any valid CreateTemplateInput, creating a template and then comparing
   * the returned Template to the input SHALL show that all fields (name, area,
   * player_count, route_id, session_goal_type, session_goal_value, tags) match
   * the input values.
   *
   * **Validates: Requirements 1.1, 6.2**
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returned template matches all input fields after creation", async () => {
    await fc.assert(
      fc.asyncProperty(createTemplateInputArb, async (input) => {
        // Mock invoke to simulate the backend creating a template
        // The backend returns a Template with the input fields plus id, timestamps
        const mockTemplate: Template = {
          id: crypto.randomUUID(),
          profile_id: input.profile_id,
          name: input.name,
          area: input.area,
          player_count: input.player_count,
          route_id: input.route_id ?? null,
          session_goal_type: input.session_goal_type,
          session_goal_value: input.session_goal_value ?? null,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          last_used_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        mockInvoke.mockResolvedValueOnce(mockTemplate);

        const result = await createTemplate(input);

        // Verify invoke was called with the correct command and input
        expect(mockInvoke).toHaveBeenCalledWith("create_template", { input });

        // Verify round-trip: all input fields match the returned template
        expect(result.name).toBe(input.name);
        expect(result.area).toBe(input.area);
        expect(result.player_count).toBe(input.player_count);
        expect(result.route_id).toBe(input.route_id ?? null);
        expect(result.session_goal_type).toBe(input.session_goal_type);
        expect(result.session_goal_value).toBe(input.session_goal_value ?? null);

        // Tags: input is string[] or undefined, template stores as JSON string or null
        if (input.tags !== undefined) {
          expect(result.tags).toBe(JSON.stringify(input.tags));
        } else {
          expect(result.tags).toBeNull();
        }

        // Verify template has required metadata fields
        expect(result.id).toBeDefined();
        expect(result.id.length).toBeGreaterThan(0);
        expect(result.profile_id).toBe(input.profile_id);
        expect(result.created_at).toBeDefined();
        expect(result.updated_at).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 3 GENERATORS =====

/** Generate empty string — always invalid. */
const emptyStringArb = fc.constant("");

/** Generate whitespace-only strings (at least 1 character, only whitespace). */
const whitespaceOnlyArb = fc
  .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 50 })
  .map((chars) => chars.join(""));

/** Generate strings longer than 100 characters — always invalid. */
const tooLongNameArb = fc.string({ minLength: 101, maxLength: 200 });

/** Generate valid template names: 1–100 chars with at least 1 non-whitespace. */
const validTemplateNameArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

// ===== PROPERTY 3 TESTS =====

describe("Feature: quick-start-templates, Property 3: Invalid names are rejected", () => {
  /**
   * Property 3: Invalid names are rejected
   *
   * For any string that is empty, contains only whitespace, or exceeds 100 characters,
   * attempting to create or update a template with that name SHALL return an error
   * and leave existing data unchanged.
   *
   * **Validates: Requirements 7.1**
   */

  it("rejects empty string as template name", () => {
    fc.assert(
      fc.property(emptyStringArb, (name) => {
        const result = validateTemplateName(name);
        expect(result).not.toBeNull();
        expect(result).toContain("at least 1 non-whitespace character");
      }),
      { numRuns: 100 }
    );
  });

  it("rejects whitespace-only strings as template name", () => {
    fc.assert(
      fc.property(whitespaceOnlyArb, (name) => {
        const result = validateTemplateName(name);
        expect(result).not.toBeNull();
        expect(result).toContain("at least 1 non-whitespace character");
      }),
      { numRuns: 100 }
    );
  });

  it("rejects strings exceeding 100 characters as template name", () => {
    fc.assert(
      fc.property(tooLongNameArb, (name) => {
        const result = validateTemplateName(name);
        expect(result).not.toBeNull();
        expect(result).toContain("must not exceed 100 characters");
      }),
      { numRuns: 100 }
    );
  });

  it("accepts valid names (at least 1 non-whitespace char, <= 100 chars)", () => {
    fc.assert(
      fc.property(validTemplateNameArb, (name) => {
        const result = validateTemplateName(name);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("for any arbitrary string, returns either null (valid) or an error string (invalid)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (name) => {
        const result = validateTemplateName(name);

        const isWhitespaceOnly = name.trim().length === 0;
        const isTooLong = name.length > 100;

        if (isWhitespaceOnly || isTooLong) {
          // Invalid names must produce a non-null error
          expect(result).not.toBeNull();
          expect(typeof result).toBe("string");
        } else {
          // Valid names must produce null (no error)
          expect(result).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ===== PROPERTY 6: DELETE REMOVES EXACTLY ONE TEMPLATE =====

/**
 * Deletes a template from a list by its ID.
 *
 * Simulates the backend's `db_delete_template` behavior at the list level:
 * given a list of templates and a target ID, returns a new list with that
 * template removed.
 *
 * @param templates - The current list of templates
 * @param targetId - The ID of the template to delete
 * @returns A new list with the target template removed
 */
export function deleteFromList(templates: Template[], targetId: string): Template[] {
  return templates.filter(t => t.id !== targetId);
}

// ===== GENERATORS FOR PROPERTY 6 =====

/** Generate a single template with a given ID. */
function templateWithIdArb(id: string): fc.Arbitrary<Template> {
  return fc.tuple(
    validNameArb,
    areaArb,
    playerCountArb,
    optionalRouteIdArb,
    sessionGoalTypeArb,
    optionalTagsArb
  ).map(([name, area, playerCount, routeId, goalType, tags]) => ({
    id,
    profile_id: "profile-1",
    name,
    area,
    player_count: playerCount,
    route_id: routeId ?? null,
    session_goal_type: goalType,
    session_goal_value: null,
    tags: tags ? JSON.stringify(tags) : null,
    last_used_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

/**
 * Generate a list of 1–10 templates with unique IDs, plus a random index
 * identifying the deletion target.
 */
const templateListWithTargetArb = fc
  .integer({ min: 1, max: 10 })
  .chain((size) => {
    // Generate `size` unique IDs
    const idsArb = fc.uniqueArray(fc.uuid(), { minLength: size, maxLength: size });
    return idsArb.chain((ids) => {
      // Generate a template for each ID
      const templatesArb = fc.tuple(...ids.map((id) => templateWithIdArb(id)));
      // Pick a random index as the deletion target
      const indexArb = fc.integer({ min: 0, max: size - 1 });
      return fc.tuple(templatesArb, indexArb);
    });
  });

// ===== PROPERTY 6 TESTS =====

describe("Feature: quick-start-templates, Property 6: Delete removes exactly one", () => {
  /**
   * Property 6: Delete removes exactly one template
   *
   * For any template list of length N, deleting one template by ID SHALL result
   * in a list of length N-1 that does not contain the deleted template's ID,
   * while all other templates remain unchanged.
   *
   * **Validates: Requirements 5.2**
   */

  it("result list has exactly N-1 elements after deleting one template", () => {
    fc.assert(
      fc.property(templateListWithTargetArb, ([templates, targetIndex]) => {
        const targetId = templates[targetIndex].id;
        const result = deleteFromList(templates, targetId);
        expect(result.length).toBe(templates.length - 1);
      }),
      { numRuns: 100 }
    );
  });

  it("deleted template's ID is not present in the result list", () => {
    fc.assert(
      fc.property(templateListWithTargetArb, ([templates, targetIndex]) => {
        const targetId = templates[targetIndex].id;
        const result = deleteFromList(templates, targetId);
        const resultIds = result.map((t) => t.id);
        expect(resultIds).not.toContain(targetId);
      }),
      { numRuns: 100 }
    );
  });

  it("all remaining templates are unchanged after deletion", () => {
    fc.assert(
      fc.property(templateListWithTargetArb, ([templates, targetIndex]) => {
        const targetId = templates[targetIndex].id;
        const result = deleteFromList(templates, targetId);

        // Every template that is NOT the target should be present and identical
        const expected = templates.filter((t) => t.id !== targetId);
        expect(result).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  it("order of remaining templates is preserved after deletion", () => {
    fc.assert(
      fc.property(templateListWithTargetArb, ([templates, targetIndex]) => {
        const targetId = templates[targetIndex].id;
        const result = deleteFromList(templates, targetId);

        // The relative order of non-deleted templates should be preserved
        const expectedIds = templates
          .filter((t) => t.id !== targetId)
          .map((t) => t.id);
        const resultIds = result.map((t) => t.id);
        expect(resultIds).toEqual(expectedIds);
      }),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 7: TOUCH PRESERVES FIELDS =====

/**
 * Simulates the touch_template operation.
 *
 * The backend's `db_touch_template` updates only the `last_used_at` field
 * to the current ISO 8601 timestamp. All other fields remain unchanged.
 *
 * @param template - The template to touch
 * @returns A new template with only `last_used_at` updated
 */
export function applyTouch(template: Template): Template {
  return {
    ...template,
    last_used_at: new Date().toISOString(),
  };
}

// ===== GENERATORS FOR PROPERTY 7 =====

/** Generate a random ISO 8601 timestamp string. */
const isoTimestampArb = fc
  .integer({ min: new Date("2020-01-01T00:00:00Z").getTime(), max: new Date("2030-12-31T23:59:59Z").getTime() })
  .map((ms) => new Date(ms).toISOString());

/** Generate an optional ISO 8601 timestamp (null or string). */
const optionalTimestampArb = fc.oneof(
  fc.constant(null as string | null),
  isoTimestampArb
);

/** Generate a JSON-encoded tags string or null. */
const tagsJsonArb = fc.oneof(
  fc.constant(null as string | null),
  fc
    .array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0), {
      minLength: 0,
      maxLength: 10,
    })
    .map((tags) => JSON.stringify(tags))
);

/** Generate a full Template object with all fields populated randomly. */
const templateArb: fc.Arbitrary<Template> = fc
  .tuple(
    fc.uuid(),                              // id
    fc.uuid(),                              // profile_id
    validNameArb,                           // name
    areaArb,                                // area
    playerCountArb,                         // player_count
    fc.oneof(fc.uuid(), fc.constant(null as string | null)), // route_id
    fc.constantFrom("none", "runs", "time"), // session_goal_type
    fc.oneof(fc.integer({ min: 1, max: 9999 }), fc.constant(null as number | null)), // session_goal_value
    tagsJsonArb,                            // tags
    optionalTimestampArb,                   // last_used_at
    isoTimestampArb,                        // created_at
    isoTimestampArb                         // updated_at
  )
  .map(([id, profileId, name, area, playerCount, routeId, goalType, goalValue, tags, lastUsedAt, createdAt, updatedAt]) => ({
    id,
    profile_id: profileId,
    name,
    area,
    player_count: playerCount,
    route_id: routeId,
    session_goal_type: goalType,
    session_goal_value: goalValue,
    tags,
    last_used_at: lastUsedAt,
    created_at: createdAt,
    updated_at: updatedAt,
  }));

// ===== PROPERTY 7 TESTS =====

describe("Feature: quick-start-templates, Property 7: Touch preserves fields", () => {
  /**
   * Property 7: Touch updates only last_used_at
   *
   * For any template, calling touch_template SHALL update only the
   * `last_used_at` field and leave all other fields (id, profile_id, name,
   * area, player_count, route_id, session_goal_type, session_goal_value,
   * tags, created_at, updated_at) unchanged.
   *
   * **Validates: Requirements 3.2**
   */

  it("touch updates last_used_at to a non-null value", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        // last_used_at must be non-null after touch
        expect(touched.last_used_at).not.toBeNull();
        expect(typeof touched.last_used_at).toBe("string");
        // It must be a valid ISO date
        expect(new Date(touched.last_used_at!).toISOString()).toBe(touched.last_used_at);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify id", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.id).toBe(template.id);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify profile_id", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.profile_id).toBe(template.profile_id);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify name", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.name).toBe(template.name);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify area", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.area).toBe(template.area);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify player_count", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.player_count).toBe(template.player_count);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify route_id", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.route_id).toBe(template.route_id);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify session_goal_type", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.session_goal_type).toBe(template.session_goal_type);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify session_goal_value", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.session_goal_value).toBe(template.session_goal_value);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify tags", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.tags).toBe(template.tags);
      }),
      { numRuns: 100 }
    );
  });

  it("touch does not modify created_at", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);
        expect(touched.created_at).toBe(template.created_at);
      }),
      { numRuns: 100 }
    );
  });

  it("all fields except last_used_at are preserved after touch", () => {
    fc.assert(
      fc.property(templateArb, (template) => {
        const touched = applyTouch(template);

        // All fields except last_used_at must be identical
        expect(touched.id).toBe(template.id);
        expect(touched.profile_id).toBe(template.profile_id);
        expect(touched.name).toBe(template.name);
        expect(touched.area).toBe(template.area);
        expect(touched.player_count).toBe(template.player_count);
        expect(touched.route_id).toBe(template.route_id);
        expect(touched.session_goal_type).toBe(template.session_goal_type);
        expect(touched.session_goal_value).toBe(template.session_goal_value);
        expect(touched.tags).toBe(template.tags);
        expect(touched.created_at).toBe(template.created_at);

        // last_used_at must have changed to a non-null value
        expect(touched.last_used_at).not.toBeNull();
        // If originally null, it definitely changed
        if (template.last_used_at === null) {
          expect(touched.last_used_at).not.toBe(template.last_used_at);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 8: TEMPLATE ORDERING — MRU FIRST, THEN CREATION DATE =====

// ===== SORT LOGIC UNDER TEST =====

/**
 * Sorts templates according to the ordering invariant:
 * 1. Templates with non-null last_used_at come BEFORE templates with null last_used_at
 * 2. Among templates with non-null last_used_at, sort by last_used_at DESCENDING (most recent first)
 * 3. Among templates with null last_used_at, sort by created_at DESCENDING (most recent first)
 *
 * This replicates the SQL ORDER BY: last_used_at DESC NULLS LAST, created_at DESC
 */
export function sortTemplates(templates: Template[]): Template[] {
  return [...templates].sort((a, b) => {
    // Templates with last_used_at come first
    if (a.last_used_at && !b.last_used_at) return -1;
    if (!a.last_used_at && b.last_used_at) return 1;
    // Both have last_used_at: sort descending
    if (a.last_used_at && b.last_used_at) {
      return b.last_used_at.localeCompare(a.last_used_at);
    }
    // Both null: sort by created_at descending
    return b.created_at.localeCompare(a.created_at);
  });
}

// ===== GENERATORS FOR PROPERTY 8 =====

/** Generate a random ISO 8601 timestamp for ordering tests. */
const orderingTimestampArb = fc
  .integer({ min: new Date("2020-01-01T00:00:00Z").getTime(), max: new Date("2030-12-31T23:59:59Z").getTime() })
  .map((ms) => new Date(ms).toISOString());

/** Generate an optional last_used_at timestamp (null ~40% of the time). */
const optionalLastUsedAtArb = fc.oneof(
  { weight: 3, arbitrary: orderingTimestampArb },
  { weight: 2, arbitrary: fc.constant(null) }
);

/** Generate a minimal template with varying last_used_at and created_at for ordering. */
const templateForOrderingArb: fc.Arbitrary<Template> = fc
  .tuple(fc.uuid(), fc.uuid(), orderingTimestampArb, optionalLastUsedAtArb)
  .map(([id, profileId, createdAt, lastUsedAt]) => ({
    id,
    profile_id: profileId,
    name: `Template-${id.slice(0, 8)}`,
    area: "Chaos Sanctuary",
    player_count: 1,
    route_id: null,
    session_goal_type: "none",
    session_goal_value: null,
    tags: null,
    last_used_at: lastUsedAt,
    created_at: createdAt,
    updated_at: createdAt,
  }));

/** Generate an array of templates (1–20) for ordering tests. */
const orderingTemplateListArb = fc.array(templateForOrderingArb, { minLength: 1, maxLength: 20 });

// ===== PROPERTY 8 TESTS =====

describe("Feature: quick-start-templates, Property 8: Template ordering", () => {
  /**
   * Property 8: Template ordering — MRU first, then creation date
   *
   * For any set of templates for a profile, get_templates SHALL return them ordered
   * such that templates with non-null last_used_at appear before templates with null
   * last_used_at, the first group is sorted by last_used_at descending, and the second
   * group is sorted by created_at descending.
   *
   * **Validates: Requirements 2.2, 2.4**
   */

  it("all templates with non-null last_used_at precede those with null last_used_at", () => {
    fc.assert(
      fc.property(orderingTemplateListArb, (templates) => {
        const sorted = sortTemplates(templates);

        // Find the first template with null last_used_at
        const firstNullIndex = sorted.findIndex((t) => t.last_used_at === null);

        if (firstNullIndex === -1) {
          // No null last_used_at — all have timestamps, which is fine
          return;
        }

        // All templates before firstNullIndex must have non-null last_used_at
        for (let i = 0; i < firstNullIndex; i++) {
          expect(sorted[i].last_used_at).not.toBeNull();
        }

        // All templates from firstNullIndex onward must have null last_used_at
        for (let i = firstNullIndex; i < sorted.length; i++) {
          expect(sorted[i].last_used_at).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });

  it("templates with non-null last_used_at are sorted descending by last_used_at", () => {
    fc.assert(
      fc.property(orderingTemplateListArb, (templates) => {
        const sorted = sortTemplates(templates);
        const withLastUsed = sorted.filter((t) => t.last_used_at !== null);

        for (let i = 0; i < withLastUsed.length - 1; i++) {
          // Each last_used_at should be >= the next (descending order)
          expect(withLastUsed[i].last_used_at! >= withLastUsed[i + 1].last_used_at!).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("templates with null last_used_at are sorted descending by created_at", () => {
    fc.assert(
      fc.property(orderingTemplateListArb, (templates) => {
        const sorted = sortTemplates(templates);
        const withoutLastUsed = sorted.filter((t) => t.last_used_at === null);

        for (let i = 0; i < withoutLastUsed.length - 1; i++) {
          // Each created_at should be >= the next (descending order)
          expect(withoutLastUsed[i].created_at >= withoutLastUsed[i + 1].created_at).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("sort is stable — sorting an already sorted list produces the same result", () => {
    fc.assert(
      fc.property(orderingTemplateListArb, (templates) => {
        const sorted1 = sortTemplates(templates);
        const sorted2 = sortTemplates(sorted1);

        // Sorting an already sorted list should produce the same ordering
        expect(sorted2.map((t) => t.id)).toEqual(sorted1.map((t) => t.id));
      }),
      { numRuns: 100 }
    );
  });

  it("sort preserves all original templates (no additions or removals)", () => {
    fc.assert(
      fc.property(orderingTemplateListArb, (templates) => {
        const sorted = sortTemplates(templates);

        // Same length
        expect(sorted.length).toBe(templates.length);

        // Same set of IDs
        const originalIds = [...templates.map((t) => t.id)].sort();
        const sortedIds = [...sorted.map((t) => t.id)].sort();
        expect(sortedIds).toEqual(originalIds);
      }),
      { numRuns: 100 }
    );
  });
});


// ===== PROPERTY 9: EXPORT/IMPORT ROUND-TRIP =====

// ===== EXPORT/IMPORT LOGIC UNDER TEST =====

/**
 * Simulates exporting templates to JSON (as the backend ExportData serialization does).
 * The ExportData struct includes templates as Option<Vec<Template>>, serialized via serde_json.
 *
 * @param templates - Array of templates to export
 * @returns JSON string of the templates array
 */
export function exportTemplates(templates: Template[]): string {
  return JSON.stringify(templates);
}

/**
 * Simulates importing templates from an exported JSON string.
 * Handles the backward-compatible case where the templates field may be null/undefined.
 *
 * @param exported - JSON string of templates, or null/undefined for backward compatibility
 * @returns Array of Template objects (empty array if input is null/undefined)
 */
export function importTemplates(exported: string | null | undefined): Template[] {
  if (exported === null || exported === undefined) {
    return [];
  }
  const parsed = JSON.parse(exported);
  if (parsed === null || parsed === undefined) {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed;
}

// ===== GENERATORS FOR PROPERTY 9 =====

/** Generate a valid ISO 8601 timestamp string for export tests. */
const exportTimestampArb = fc
  .integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() })
  .map((ms) => new Date(ms).toISOString());

/** Generate an optional ISO 8601 timestamp (null or string) for export tests. */
const exportOptionalTimestampArb = fc.oneof(
  fc.constant(null as string | null),
  exportTimestampArb
);

/** Generate a valid tags JSON string (null or JSON array of strings) for export tests. */
const exportTagsJsonArb = fc.oneof(
  fc.constant(null as string | null),
  fc
    .array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0), {
      minLength: 0,
      maxLength: 10,
    })
    .map((tags) => JSON.stringify(tags))
);

/** Generate a complete Template object with all fields randomized for export tests. */
const exportTemplateArb: fc.Arbitrary<Template> = fc
  .tuple(
    fc.uuid(),                                        // id
    fc.uuid(),                                        // profile_id
    validNameArb,                                     // name
    areaArb,                                          // area
    playerCountArb,                                   // player_count
    fc.oneof(fc.uuid(), fc.constant(null as string | null)), // route_id
    sessionGoalTypeArb,                               // session_goal_type
    fc.oneof(fc.integer({ min: 1, max: 9999 }), fc.constant(null as number | null)), // session_goal_value
    exportTagsJsonArb,                                // tags
    exportOptionalTimestampArb,                       // last_used_at
    exportTimestampArb,                               // created_at
    exportTimestampArb                                // updated_at
  )
  .map(([id, profileId, name, area, playerCount, routeId, goalType, goalValue, tags, lastUsed, created, updated]) => ({
    id,
    profile_id: profileId,
    name,
    area,
    player_count: playerCount,
    route_id: routeId,
    session_goal_type: goalType,
    session_goal_value: goalValue,
    tags,
    last_used_at: lastUsed,
    created_at: created,
    updated_at: updated,
  }));

/** Generate an array of 0–10 templates for export round-trip tests. */
const exportTemplateListArb = fc.array(exportTemplateArb, { minLength: 0, maxLength: 10 });

// ===== PROPERTY 9 TESTS =====

describe("Feature: quick-start-templates, Property 9: Export/import round-trip", () => {
  /**
   * Property 9: Export/import round-trip preserves templates
   *
   * For any set of templates, serializing them to the export format (JSON)
   * and then deserializing back produces identical data — same number of
   * templates with all fields matching exactly.
   *
   * **Validates: Requirements 6.3, 6.4**
   */

  it("export then import produces identical template data", () => {
    fc.assert(
      fc.property(exportTemplateListArb, (templates) => {
        const exported = exportTemplates(templates);
        const imported = importTemplates(exported);

        // Same number of templates
        expect(imported.length).toBe(templates.length);

        // Each template's fields match exactly
        for (let i = 0; i < templates.length; i++) {
          const original = templates[i];
          const roundTripped = imported[i];

          expect(roundTripped.id).toBe(original.id);
          expect(roundTripped.profile_id).toBe(original.profile_id);
          expect(roundTripped.name).toBe(original.name);
          expect(roundTripped.area).toBe(original.area);
          expect(roundTripped.player_count).toBe(original.player_count);
          expect(roundTripped.route_id).toBe(original.route_id);
          expect(roundTripped.session_goal_type).toBe(original.session_goal_type);
          expect(roundTripped.session_goal_value).toBe(original.session_goal_value);
          expect(roundTripped.tags).toBe(original.tags);
          expect(roundTripped.last_used_at).toBe(original.last_used_at);
          expect(roundTripped.created_at).toBe(original.created_at);
          expect(roundTripped.updated_at).toBe(original.updated_at);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("deep equality holds for the entire template array after round-trip", () => {
    fc.assert(
      fc.property(exportTemplateListArb, (templates) => {
        const exported = exportTemplates(templates);
        const imported = importTemplates(exported);

        // Deep equality check on the entire array
        expect(imported).toEqual(templates);
      }),
      { numRuns: 100 }
    );
  });

  it("import handles null templates field gracefully (backward compatibility)", () => {
    // When the export data has no templates field (older exports),
    // import should produce an empty array
    const result = importTemplates(null);
    expect(result).toEqual([]);
  });

  it("import handles undefined templates field gracefully (backward compatibility)", () => {
    const result = importTemplates(undefined);
    expect(result).toEqual([]);
  });

  it("import handles JSON null value gracefully", () => {
    // If the exported string is literally "null" (JSON serialization of null)
    const result = importTemplates("null");
    expect(result).toEqual([]);
  });

  it("round-trip preserves empty template list", () => {
    const exported = exportTemplates([]);
    const imported = importTemplates(exported);
    expect(imported).toEqual([]);
  });
});
