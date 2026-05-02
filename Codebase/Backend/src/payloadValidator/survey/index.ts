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

export const runFeedbackSchema = z.object({
  ratings: z.record(starRatingSchema),
  openEnded: z.record(openTextSchema)
});

export const sessionFeedbackSchema = z.object({
  sessionUuid: z.string().min(1).max(128).optional(),
  ratings: z.record(starRatingSchema),
  openEnded: z.record(openTextSchema)
});
