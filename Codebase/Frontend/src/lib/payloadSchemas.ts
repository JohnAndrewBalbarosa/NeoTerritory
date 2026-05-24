// Frontend mirror of the backend pattern-groups payload validators
// (Backend/src/payloadValidator/patternGroups). The backend remains the
// source of truth and re-validates every request; this mirror only powers
// client-side pre-validation so admins see inline errors before the wire.
//
// Hand-rolled (no zod on the frontend) but kept shape-for-shape identical to
// the backend Zod schemas. The load-bearing rule is the NON-EMPTY
// ordered_checks: an empty ordered_checks makes the matcher treat the pattern
// as "always matches" → universal false positives.

export const PATTERN_FAMILIES = ['creational', 'structural', 'behavioural', 'idiom'] as const;
export type PatternFamily = (typeof PATTERN_FAMILIES)[number];

const PATTERN_ID_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/i;

export interface PatternDefinition {
  pattern_id: string;
  pattern_family: PatternFamily;
  pattern_name: string;
  ordered_checks: unknown[];
  enabled?: boolean;
  [key: string]: unknown;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

// Validate a single pattern definition object. Returns the parsed value on
// success or a human-readable error string on failure.
export function validatePatternDefinition(input: unknown): ValidationResult<PatternDefinition> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'must be a JSON object' };
  }
  const obj = input as Record<string, unknown>;

  if (typeof obj.pattern_id !== 'string' || !PATTERN_ID_RE.test(obj.pattern_id)) {
    return { ok: false, error: 'pattern_id must be "<family>.<name>" (alphanumeric + underscore)' };
  }
  if (typeof obj.pattern_family !== 'string' || !(PATTERN_FAMILIES as readonly string[]).includes(obj.pattern_family)) {
    return { ok: false, error: `pattern_family must be one of: ${PATTERN_FAMILIES.join(', ')}` };
  }
  if (typeof obj.pattern_name !== 'string' || obj.pattern_name.length < 1) {
    return { ok: false, error: 'pattern_name required' };
  }
  if (!Array.isArray(obj.ordered_checks) || obj.ordered_checks.length === 0) {
    return { ok: false, error: 'ordered_checks must be a non-empty array (empty matches everything)' };
  }
  if (obj.enabled !== undefined && typeof obj.enabled !== 'boolean') {
    return { ok: false, error: 'enabled must be a boolean when present' };
  }
  return { ok: true, value: obj as PatternDefinition };
}

// Validate a parsed file payload that may be a single object OR an array of
// pattern definitions. Returns the flattened list on success.
export function validatePatternFile(input: unknown): ValidationResult<PatternDefinition[]> {
  const entries = Array.isArray(input) ? input : [input];
  if (entries.length === 0) {
    return { ok: false, error: 'no pattern definitions found' };
  }
  const out: PatternDefinition[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const res = validatePatternDefinition(entries[i]);
    if (!res.ok || !res.value) {
      const prefix = Array.isArray(input) ? `entry ${i + 1}: ` : '';
      return { ok: false, error: `${prefix}${res.error}` };
    }
    out.push(res.value);
  }
  return { ok: true, value: out };
}

// Group-creation constraints (mirror createPatternGroupSchema).
export const GROUP_NAME_MAX = 120;
export const GROUP_PATTERNS_MAX = 200;

export function validateGroupName(name: string): ValidationResult<string> {
  const trimmed = name.trim();
  if (trimmed.length < 1) return { ok: false, error: 'name required' };
  if (trimmed.length > GROUP_NAME_MAX) return { ok: false, error: 'name too long' };
  return { ok: true, value: trimmed };
}
