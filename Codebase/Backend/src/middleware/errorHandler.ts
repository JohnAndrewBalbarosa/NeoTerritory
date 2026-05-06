import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  status?: number;
  code?: string;
}

const errorHandler = (err: HttpError, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof Error && err.message === 'Invalid file type') {
    res.status(400).json({ error: 'Invalid file type' });
    return;
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large (max 2MB)' });
    return;
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    res.status(400).json({ error: 'Too many files (max 5 per upload)' });
    return;
  }
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
};

export { errorHandler };
