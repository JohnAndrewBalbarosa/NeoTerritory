import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';

/**
 * Body validation middleware factory.
 * Usage: router.post('/path', validateBody(schema), handler)
 *
 * On success: replaces req.body with the parsed (and coerced) data.
 * On failure: 400 with { error, issues }.
 */
export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return function validateBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
