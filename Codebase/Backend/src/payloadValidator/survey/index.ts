import { z } from 'zod';

const reviewAnswerValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const reviewSubmitSchema = z.object({
  scope: z.enum(['mid', 'end']),
  answers: z.record(reviewAnswerValueSchema),
  analysisRunId: z.union([z.string(), z.number()]).optional()
});

const starRatingSchema = z.number().int().min(1).max(5);
const openTextSchema = z.string().max(4000);

export const consentSchema = z.object({
  version: z.string().min(1).max(64)
});

export const pretestSchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
});

// Pattern ID schema — matches the catalog. Lower-snake_case, optional
// underscore. Keeps the F1 ground-truth payload tight without coupling
// the schema to a hard-coded enum (which would force a redeploy every
// time the catalog grows).
const patternIdSchema = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);

export const runFeedbackSchema = z.object({
  ratings: z.record(starRatingSchema),
  openEnded: z.record(openTextSchema),
  // Per-run F1 ground truth from the participant. surveyMissed lists
  // patterns the participant intended to write but the analyzer didn't
  // tag. surveyRejected lists detected patterns the participant rejects
  // as incorrect. Both default to empty when the survey wasn't shown.
  surveyMissed:   z.array(patternIdSchema).max(20).optional(),
  surveyRejected: z.array(patternIdSchema).max(20).optional(),
});

export const sessionFeedbackSchema = z.object({
  sessionUuid: z.string().min(1).max(128).optional(),
  ratings: z.record(starRatingSchema),
  openEnded: z.record(openTextSchema)
});
