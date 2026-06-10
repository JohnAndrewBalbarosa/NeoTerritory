import { describe, it, expect } from 'vitest';
import * as intakeService from '../services/projectSpecIntakeService';
import * as policyService from '../services/featureTogglePolicyService';
import * as assessmentService from '../services/assessmentOrchestrationService';
import { ProjectBriefInput } from '../services/projectLearningContracts';

describe('Project Learning Orchestration Flow', () => {
  const mockBrief: ProjectBriefInput = {
    projectId: 'proj-123',
    projectTitle: 'Healthcare operations platform',
    businessSpecs: [
      'A hospital wants one onboarding workflow for insurance checks, appointment scheduling, lab requests, and billing notifications.',
      'External partners use different request formats, but internal teams want one consistent process.',
      'Managers need live status updates whenever a patient case changes, and actions must be queued for audit and possible retry.',
      'Pricing and prioritization rules vary by department and can change per contract.'
    ],
    architectureSpecs: [
      'Keep partner integrations separated from internal workflows.',
      'Do not make every screen know all subsystem details.',
      'Allow different decision rules without rewriting the workflow.'
    ],
    businessProcess: 'Intake staff creates a patient case; partner data is normalized; several backend services are coordinated; status changes notify dashboards; billing and scheduling actions are stored for retry; department-specific policies choose prioritization.'
  };

  it('should convert an implicit brief into a scoped learning plan', () => {
    const scope = intakeService.intakeProjectBrief(mockBrief);
    expect(scope.projectId).toBe('proj-123');
    expect(scope.requiredPatterns).toEqual(expect.arrayContaining([
      'adapter',
      'facade',
      'observer',
      'command',
      'strategy',
    ]));
    expect(scope.requiredModules.some((moduleId) => moduleId.includes('facade'))).toBe(true);
    expect((scope.requiredTopics ?? []).length).toBeGreaterThan(0);
    expect(scope.notes[0]).toBe('implicit deny applied');
    expect(scope.confidence).toBe('high');
  });

  it('should resolve toggles based on scope', () => {
    const scope = intakeService.intakeProjectBrief(mockBrief);
    const manifest = policyService.resolveTogglePolicy(scope);
    
    const adapterToggle = manifest.toggles.find(t => t.key === 'pattern.adapter');
    expect(adapterToggle?.enabled).toBe(true);

    const facadeToggle = manifest.toggles.find((t) => t.key === 'pattern.facade');
    expect(facadeToggle?.enabled).toBe(true);

    const builderToggle = manifest.toggles.find(t => t.key === 'pattern.builder');
    expect(builderToggle?.enabled).toBe(false);
  });

  it('should score a pretest and suggest bypass if passed', () => {
    const pretestAttempt = {
      projectId: 'proj-123',
      internId: 'int-456',
      moduleId: 'adapter',
      attemptType: 'pretest' as const,
      answers: [
        { questionId: 'q1', answer: 'This is a long enough answer to pass' }
      ]
    };
    const result = assessmentService.scorePretestAttempt(pretestAttempt);
    expect(result.decision).toBe('pass');
    expect(result.nextAction).toBe('bypass-module');
  });

  it('should score a posttest and suggest completion if passed', () => {
    const posttestAttempt = {
      projectId: 'proj-123',
      internId: 'int-456',
      moduleId: 'adapter',
      attemptType: 'posttest' as const,
      answers: [
        { questionId: 'q1', answer: 'This is a very long and detailed answer to pass the posttest' }
      ]
    };
    const result = assessmentService.scorePosttestAttempt(posttestAttempt);
    expect(result.decision).toBe('pass');
    expect(result.nextAction).toBe('module-complete');
  });
});
