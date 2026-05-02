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

// Single C++ source file in the multi-file submission shape.
export const fileEntrySchema = z.object({
  code: z.string().min(1).max(1_000_000),
  name: filenameSchema
});
