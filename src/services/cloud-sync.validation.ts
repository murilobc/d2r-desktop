/**
 * Cloud Sync validation module.
 *
 * Provides payload structure validation and token validation.
 * Unrecognized fields are ignored (not rejected, not persisted).
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Known collection keys in the SyncPayload schema
const KNOWN_COLLECTIONS = [
  "profiles",
  "runs",
  "items",
  "herald_encounters",
  "colossal_ancient_attempts",
  "anni_logs",
  "xp_entries",
  "keybind_profiles",
  "routes",
  "custom_areas",
] as const;

/**
 * Check whether a string is a valid ISO 8601 date.
 * A string matches ISO 8601 if `new Date(str).toISOString()` doesn't throw
 * and the result is a valid date (not NaN).
 */
function isValidIso8601(str: unknown): boolean {
  if (typeof str !== "string") return false;
  const date = new Date(str);
  return !Number.isNaN(date.getTime());
}

/**
 * Validate a single record within a collection.
 * Returns an error string if invalid, or undefined if valid.
 */
function validateRecord(
  collectionName: string,
  index: number,
  record: unknown,
): string | undefined {
  if (record === null || typeof record !== "object") {
    return `Record in '${collectionName}' at index ${index} must be a non-null object`;
  }

  const rec = record as Record<string, unknown>;

  if (!("id" in rec) || typeof rec.id !== "string" || rec.id.length === 0) {
    return `Record in '${collectionName}' at index ${index} has empty id`;
  }

  if (!("updated_at" in rec)) {
    return `Record in '${collectionName}' at index ${index} is missing 'updated_at'`;
  }

  if (!isValidIso8601(rec.updated_at)) {
    return `Record in '${collectionName}' at index ${index} has invalid 'updated_at' timestamp`;
  }

  return undefined;
}

/**
 * Validate all records in a single collection.
 * Returns an error string if any record is invalid, or undefined if all valid.
 */
function validateCollection(
  collectionName: string,
  collection: unknown,
): string | undefined {
  if (!Array.isArray(collection)) {
    return `'${collectionName}' must be an array`;
  }

  for (let i = 0; i < collection.length; i++) {
    const error = validateRecord(collectionName, i, collection[i]);
    if (error) return error;
  }

  return undefined;
}

/**
 * Validate a sync payload structure.
 *
 * Checks:
 * - schema_version exists and is a positive integer
 * - timestamp exists and is a valid ISO 8601 string
 * - Each known collection (if present) has records with:
 *   - non-empty `id` string
 *   - valid ISO 8601 `updated_at` timestamp
 *
 * Unrecognized top-level or nested fields are ignored.
 */
export function validatePayload(payload: unknown): ValidationResult {
  if (payload === null || payload === undefined || typeof payload !== "object") {
    return { valid: false, error: "Payload must be a non-null object" };
  }

  const obj = payload as Record<string, unknown>;

  // Validate schema_version
  if (!("schema_version" in obj)) {
    return { valid: false, error: "Missing required field 'schema_version'" };
  }
  const schemaVersion = obj.schema_version;
  if (
    typeof schemaVersion !== "number" ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    return {
      valid: false,
      error: "'schema_version' must be a positive integer",
    };
  }

  // Validate timestamp
  if (!("timestamp" in obj)) {
    return { valid: false, error: "Missing required field 'timestamp'" };
  }
  if (!isValidIso8601(obj.timestamp)) {
    return {
      valid: false,
      error: "'timestamp' must be a valid ISO 8601 date string",
    };
  }

  // Validate each known collection that is present
  for (const collectionName of KNOWN_COLLECTIONS) {
    if (!(collectionName in obj)) {
      continue;
    }

    const error = validateCollection(collectionName, obj[collectionName]);
    if (error) {
      return { valid: false, error };
    }
  }

  return { valid: true };
}

/**
 * Validate a token string.
 *
 * Rejects:
 * - Empty strings
 * - Whitespace-only strings
 * - Strings longer than 255 characters
 */
export function validateToken(token: string): ValidationResult {
  if (token.length === 0) {
    return { valid: false, error: "Token must not be empty" };
  }

  if (token.trim().length === 0) {
    return { valid: false, error: "Token must not be whitespace-only" };
  }

  if (token.length > 255) {
    return {
      valid: false,
      error: "Token must not exceed 255 characters",
    };
  }

  return { valid: true };
}
