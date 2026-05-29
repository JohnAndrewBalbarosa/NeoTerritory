import { z } from 'zod';

// Learning-module (CMS) payload validation — D92.
//
// The admin CRUD routes accept a module in the frozen LearningModuleDTO wire
// shape (= the frontend LearningModule). This schema validates that shape on
// write so a malformed document can never land in learning_modules. Bounded
// strings keep a single row from becoming an unbounded blob; the exam banks are
// structurally validated (options array, integer correctIndex in range) so the
// learner page can render them without defensive guards on every field.
//
// IDs are sacred: module_id is the PK the learner-progress tables key on. The
// schema validates the id's SHAPE; immutability (no PK change on PUT) is
// enforced in the route, not here.

export const LEARNING_CATEGORIES = [
  'foundations',
  'creational',
  'structural',
  'behavioural',
  'idioms',
] as const;
export type LearningCategoryValue = (typeof LEARNING_CATEGORIES)[number];

// Practical family label (display-cased) — distinct from the lowercase module
// category. Mirrors PracticalExam.family in learningModules.ts.
export const PRACTICAL_FAMILIES = ['Creational', 'Structural', 'Behavioural', 'Idioms'] as const;

export const PASS_MODES = ['detection', 'detection_and_tests'] as const;
export type PassModeValue = (typeof PASS_MODES)[number];

// Bounded-string helpers. Generous caps — long enough for real lesson prose,
// short enough to bound a single document.
const ID_MAX = 120;
const SHORT_TEXT = 400;
const LONG_TEXT = 20_000;

const idSchema = z
  .string()
  .trim()
  .min(1, 'id required')
  .max(ID_MAX, 'id too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'id must be alphanumeric with - or _ only');

const sectionSchema = z
  .object({
    heading: z.string().min(1, 'section heading required').max(SHORT_TEXT),
    body: z.string().max(LONG_TEXT).optional(),
    bullets: z.array(z.string().max(LONG_TEXT)).max(100).optional(),
    code: z.string().max(LONG_TEXT).optional(),
    note: z.string().max(LONG_TEXT).optional(),
  })
  .strip();

const keyTermSchema = z
  .object({
    term: z.string().min(1, 'term required').max(SHORT_TEXT),
    definition: z.string().min(1, 'definition required').max(LONG_TEXT),
  })
  .strip();

const seeAlsoSchema = z
  .object({
    moduleId: z.string().min(1).max(ID_MAX),
    label: z.string().min(1).max(SHORT_TEXT),
  })
  .strip();

// One MCQ item. correctIndex must be an integer that indexes into options.
const examQuestionSchema = z
  .object({
    question: z.string().min(1, 'question text required').max(LONG_TEXT),
    options: z
      .array(z.string().min(1, 'option text required').max(LONG_TEXT))
      .min(2, 'at least two options')
      .max(12, 'too many options'),
    correctIndex: z.number().int('correctIndex must be an integer').min(0),
    explanation: z.string().max(LONG_TEXT).optional(),
  })
  .strip()
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex out of range for options',
    path: ['correctIndex'],
  });

const theoreticalExamSchema = z
  .object({
    kind: z.literal('theoretical'),
    questions: z.array(examQuestionSchema).min(1, 'at least one question').max(100),
  })
  .strip();

const practicalExamSchema = z
  .object({
    kind: z.literal('practical'),
    patternSlug: z.string().min(1, 'patternSlug required').max(SHORT_TEXT),
    patternName: z.string().min(1, 'patternName required').max(SHORT_TEXT),
    family: z.enum(PRACTICAL_FAMILIES),
    prompt: z.string().min(1, 'prompt required').max(LONG_TEXT),
    starterCode: z.string().max(LONG_TEXT).optional(),
    passMode: z.enum(PASS_MODES).optional(),
  })
  .strip();

// Full module document. `id` is required (the route enforces uniqueness on POST
// and immutability on PUT). published / autoTag / sortOrder are optional control
// fields; when present they win, else the route applies defaults (published=1,
// autoTag=1, sortOrder=0).
export const learningModuleSchema = z
  .object({
    id: idSchema,
    category: z.enum(LEARNING_CATEGORIES),
    title: z.string().trim().min(1, 'title required').max(SHORT_TEXT),
    eyebrow: z.string().max(SHORT_TEXT).optional().default(''),
    intro: z.string().max(LONG_TEXT).optional().default(''),
    sections: z.array(sectionSchema).max(200).optional().default([]),
    keyTerms: z.array(keyTermSchema).max(200).optional(),
    summary: z.string().max(LONG_TEXT).optional(),
    seeAlso: z.array(seeAlsoSchema).max(100).optional(),
    theoreticalExam: theoreticalExamSchema.optional(),
    practicalExam: practicalExamSchema.optional(),
    autoTag: z.boolean().optional(),
    published: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .strip();

export type LearningModuleInput = z.infer<typeof learningModuleSchema>;

// PATCH body: control fields only. At least one must be present.
export const patchLearningModuleSchema = z
  .object({
    published: z.boolean().optional(),
    autoTag: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .strip()
  .refine(
    (v) => v.published !== undefined || v.autoTag !== undefined || v.sortOrder !== undefined,
    { message: 'provide at least one of { published, autoTag, sortOrder }' },
  );

export type PatchLearningModuleInput = z.infer<typeof patchLearningModuleSchema>;

// Hand validator returning the agreed {ok,value}|{ok:false,error} contract so
// callers do not need to catch Zod throws. Wraps the schema's safeParse and
// flattens the first issue into a single human-readable message.
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateLearningModule(body: unknown): ValidationResult<LearningModuleInput> {
  const parsed = learningModuleSchema.safeParse(body);
  if (parsed.success) return { ok: true, value: parsed.data };
  const first = parsed.error.issues[0];
  const where = first?.path?.length ? `${first.path.join('.')}: ` : '';
  return { ok: false, error: `${where}${first?.message ?? 'invalid learning module'}` };
}
