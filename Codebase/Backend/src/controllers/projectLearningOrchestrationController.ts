import { Request, Response, NextFunction } from 'express';
import * as projectSpecIntakeService from '../services/projectSpecIntakeService';
import * as featureTogglePolicyService from '../services/featureTogglePolicyService';
import * as assessmentOrchestrationService from '../services/assessmentOrchestrationService';
import * as readinessEvidenceService from '../services/readinessEvidenceService';
import { ProjectBriefInput, AssessmentAttempt } from '../services/projectLearningContracts';

export const createProjectScope = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const brief: ProjectBriefInput = req.body;
    if (!brief.projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const scope = projectSpecIntakeService.intakeProjectBrief(brief);
    res.status(200).json(scope);
  } catch (err) {
    next(err);
  }
};

export const resolveProjectScopeToggles = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const scope = req.body;
    if (!scope.projectId || !scope.scopeVersion) {
      res.status(400).json({ error: 'projectId and scopeVersion are required' });
      return;
    }
    const manifest = featureTogglePolicyService.resolveTogglePolicy(scope);
    res.status(200).json(manifest);
  } catch (err) {
    next(err);
  }
};

export const submitInternPretest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const attempt: AssessmentAttempt = req.body;
    if (!attempt.projectId || !attempt.internId || !attempt.moduleId) {
      res.status(400).json({ error: 'projectId, internId, and moduleId are required' });
      return;
    }
    const result = assessmentOrchestrationService.scorePretestAttempt(attempt);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const submitInternPosttest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const attempt: AssessmentAttempt = req.body;
    if (!attempt.projectId || !attempt.internId || !attempt.moduleId) {
      res.status(400).json({ error: 'projectId, internId, and moduleId are required' });
      return;
    }
    const result = assessmentOrchestrationService.scorePosttestAttempt(attempt);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getProjectReadiness = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const readiness = readinessEvidenceService.listReadyInterns(projectId);
    res.status(200).json(readiness);
  } catch (err) {
    next(err);
  }
};
