import express, { Request, Response } from 'express';
import { register, login } from '../controllers/authController';
import { validateBody } from '../middleware/validateBody';
import { loginSchema } from '../validation/schemas';
// TEST SEED — REMOVE FOR PRODUCTION
import { listTestAccounts } from '../db/_testSeed/devconUsers';

const router = express.Router();

router.post('/register', register);
router.post('/login', validateBody(loginSchema), login);

// TEST SEED — REMOVE FOR PRODUCTION
router.get('/test-accounts', (_req: Request, res: Response) => {
  const accounts = listTestAccounts();
  res.json({ accounts, password: accounts.length ? 'devcon' : null });
});

export default router;
