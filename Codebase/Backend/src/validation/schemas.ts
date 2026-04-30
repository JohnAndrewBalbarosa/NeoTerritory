import { z } from 'zod';

// Filename: 1-255 chars, no path separators, no null bytes, no control chars.
const FILENAME_BAD_CHARS = /[\\/\x00-\x1f]/;

export const filenameSchema = z
  .string()
  .min(1, 'filename required')
  .max(255, 'filename too long')
  .refine((v) => !FILENAME_BAD_CHARS.test(v), {
    message: 'filename contains path separators or control characters'
  });

export const analyzeBodySchema = z.object({
  code: z.string().min(1, 'code required').max(1_000_000, 'code too large'),
  filename: filenameSchema
});

export const saveRunSchema = z.object({
  pendingId: z.string().min(1).max(128),
  userResolvedPattern: z.string().min(1).max(128).optional()
});

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256)
});

export const claimSeatSchema = z.object({
  username: z.string().regex(/^devcon\d+$/i)
});

const reviewAnswerValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const reviewSubmitSchema = z.object({
  scope: z.enum(['mid', 'end']),
  answers: z.record(reviewAnswerValueSchema),
  analysisRunId: z.union([z.string(), z.number()]).optional()
});
