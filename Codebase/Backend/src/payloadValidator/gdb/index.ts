import { z } from 'zod';

// /api/analysis/run-tests body. Either pendingId (unsaved run) or runId
// path-param + body — the body schema covers the common optional fields.
export const runTestsSchema = z.object({
  pendingId: z.string().min(1).max(128).optional(),
  // Per-class user pattern resolutions overlay the saved/pending map.
  classResolvedPatterns: z.record(
    z.string().min(1).max(128),
    z.string().min(1).max(128)
  ).optional(),
  // stdin text the binary will receive on its standard input. Newlines
  // act as the user pressing Enter; max 64 KB so a runaway paste can't
  // exhaust the pod's tmpfs.
  stdin: z.string().max(64_000).optional()
});
