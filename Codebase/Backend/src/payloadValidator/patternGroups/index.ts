import { z } from 'zod';

// Pattern-groups payload validation.
//
// A "group" is a named bundle of pattern definitions uploaded by an admin.
// The custom bundle must mirror enough of the on-disk catalog JSON shape that
// the C++ loader accepts it. The load-bearing rule is ordered_checks being
// NON-EMPTY: an empty ordered_checks makes the matcher treat the pattern as
// "always matches" → universal false positives. .passthrough() keeps the
// loader-tolerant extra fields (signature_categories, lexeme_identifiers,
// implementation_template, …) intact.

export const PATTERN_FAMILIES = ['creational', 'structural', 'behavioural', 'idiom'] as const;
export type PatternFamily = (typeof PATTERN_FAMILIES)[number];

export const patternDefinitionSchema = z
  .object({
    pattern_id: z
      .string()
      .regex(/^[a-z0-9_]+\.[a-z0-9_]+$/i, 'pattern_id must be "<family>.<name>" (alphanumeric + underscore)'),
    pattern_family: z.enum(PATTERN_FAMILIES),
    pattern_name: z.string().min(1, 'pattern_name required'),
    ordered_checks: z
      .array(z.unknown())
      .min(1, 'ordered_checks must be non-empty (empty matches everything)'),
    enabled: z.boolean().optional(),
  })
  .passthrough();

export type PatternDefinition = z.infer<typeof patternDefinitionSchema>;

export const createPatternGroupSchema = z.object({
  name: z.string().trim().min(1, 'name required').max(120, 'name too long'),
  patterns: z.array(patternDefinitionSchema).min(1, 'at least one pattern required').max(200, 'too many patterns'),
});

export type CreatePatternGroupInput = z.infer<typeof createPatternGroupSchema>;

export const patchPatternGroupSchema = z
  .object({
    active: z.boolean().optional(),
    patternEnabled: z.record(z.string(), z.boolean()).optional(),
  })
  .refine((v) => v.active !== undefined || v.patternEnabled !== undefined, {
    message: 'provide at least one of { active, patternEnabled }',
  });

export type PatchPatternGroupInput = z.infer<typeof patchPatternGroupSchema>;
