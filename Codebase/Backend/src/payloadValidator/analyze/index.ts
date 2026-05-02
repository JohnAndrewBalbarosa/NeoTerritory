import { z } from 'zod';
import { filenameSchema, fileEntrySchema } from '../common';

// Accepts either the legacy single-file shape ({ code, filename }) or the
// multi-file shape ({ files: [{ code, name }] }). At least one of the two
// must satisfy: a non-empty code body and a valid filename.
export const analyzeBodySchema = z.object({
  code: z.string().min(1, 'code required').max(1_000_000, 'code too large').optional(),
  filename: filenameSchema.optional(),
  files: z.array(fileEntrySchema).min(1).max(16).optional(),
  // Optional stdin captured from the studio's "Program input" textarea —
  // forwarded verbatim to the binary on every test_run phase. Newlines
  // act as the user's Enter key.
  stdin: z.string().max(64_000).optional()
}).refine(
  (v) => (v.code && v.filename) || (v.files && v.files.length > 0),
  { message: 'Provide { code, filename } or { files: [...] }' }
);
