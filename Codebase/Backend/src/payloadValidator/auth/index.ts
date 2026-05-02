import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256)
});

export const claimSeatSchema = z.object({
  username: z.string().regex(/^devcon\d+$/i)
});
