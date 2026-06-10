import express, { Request, Response, NextFunction } from 'express';
import { jwtAuth } from '../middleware/jwtAuth';
import * as controller from '../controllers/projectLearningOrchestrationController';

const router = express.Router();

/**
 * Role-based access control middleware helper.
 */
const roleCheck = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }
  next();
};

// Project manager routes
router.post(
  '/projects/:projectId/spec',
  jwtAuth,
  roleCheck(['admin']),
  controller.createProjectScope
);

router.get(
  '/projects/:projectId/readiness',
  jwtAuth,
  roleCheck(['admin']),
  controller.getProjectReadiness
);

// System/Internal routes (could also be restricted to admin or internal service tokens)
router.post(
  '/projects/:projectId/scope',
  jwtAuth,
  roleCheck(['admin']),
  controller.resolveProjectScopeToggles
);

// Intern routes
router.post(
  '/projects/:projectId/interns/:internId/pretest',
  jwtAuth,
  controller.submitInternPretest
);

router.post(
  '/projects/:projectId/modules/:moduleId/posttest',
  jwtAuth,
  controller.submitInternPosttest
);

export default router;
