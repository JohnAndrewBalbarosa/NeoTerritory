import express from 'express';
import { jwtAuth } from '../middleware/jwtAuth';
import { transform } from '../controllers/transformController';
import { upload } from '../middleware/upload';

const router = express.Router();

router.post('/', jwtAuth, upload.single('file'), transform);

export default router;
