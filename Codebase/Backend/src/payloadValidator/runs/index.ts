import { z } from 'zod';

export const saveRunSchema = z.object({
  pendingId: z.string().min(1).max(128),
  userResolvedPattern: z.string().min(1).max(128).optional(),
  // Per-class user pattern resolution map. Keys are class names (typical
  // C++ identifier length), values are pattern keys.
  classResolvedPatterns: z.record(
    z.string().min(1).max(128),
    z.string().min(1).max(128)
  ).optional()
});

// Submit-and-save replaces the older two-step "validate then save" flow.
// The same payload structure as saveRunSchema, but the route guarantees
// validation happens BEFORE persisting; the frontend's lone "Submit
// validation & save" button hits this single endpoint.
export const submitAndSaveSchema = saveRunSchema;
