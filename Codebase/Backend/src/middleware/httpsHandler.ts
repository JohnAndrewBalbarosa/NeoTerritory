import { Request, Response, NextFunction } from 'express';

/**
 * Decoupled HTTPS Request Handler Adapter
 * 
 * This middleware checks the incoming request protocol and can enforce 
 * HTTPS routing or handle protocol-specific logic.
 */

export const httpsAdapter = (req: Request, res: Response, next: NextFunction): void => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  // Log protocol for debugging in production
  if (process.env.NODE_ENV === 'production' && !isHttps) {
    console.warn(`[HTTPS Adapter] Non-secure request detected from ${req.ip}`);
  }

  // Future: Enforce HTTPS redirection if domain is assigned
  // if (process.env.ENFORCE_HTTPS === '1' && !isHttps) {
  //   return res.redirect(`https://${req.headers.host}${req.url}`);
  // }

  next();
};

/**
 * Protocol-aware routing adapter
 */
export function wrapHttpsRoute(handler: (req: Request, res: Response) => void) {
  return (req: Request, res: Response) => {
    // Inject custom HTTPS headers or context if needed
    (req as any).isSecureConnection = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return handler(req, res);
  };
}
