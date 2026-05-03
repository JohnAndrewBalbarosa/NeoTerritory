import express, { Request, Response, NextFunction } from 'express';
import { jwtAuth } from '../middleware/jwtAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getScraperStatus, startScraper, stopScraper } from '../services/scraperService';

const router = express.Router();

router.use(jwtAuth, requireAdmin);

router.get('/status', (_req: Request, res: Response) => {
  res.json(getScraperStatus());
});

router.post('/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, hostKey, maxScrolls } = req.body ?? {};
    if (typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ error: 'url required' });
      return;
    }
    const result = startScraper({
      url: url.trim(),
      hostKey: typeof hostKey === 'string' ? hostKey : undefined,
      maxScrolls: typeof maxScrolls === 'number' ? maxScrolls : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/stop', (_req: Request, res: Response) => {
  res.json(stopScraper());
});

export default router;
