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

  const documentWorkflowBrief: ProjectBriefInput = {
    projectId: 'proj-456',
    projectTitle: 'Legal document approval workflow',
    businessSpecs: [
      'Every contract must follow the same review pipeline: draft intake, compliance review, finance approval, executive signoff, and archive.',
      'Departments may customize what happens inside each approval step but cannot change the overall order.',
      'A contract moves between draft, under review, rejected, approved, and archived, and actions available to staff change by lifecycle stage.',
      'Approvers need queued approval and rejection actions with audit history and retry support.'
    ],
    architectureSpecs: [
      'Keep the approval skeleton stable while letting departments override step details.',
      'Avoid spreading lifecycle if statements across screens.'
    ],
    businessProcess: 'A contract enters a fixed approval flow, changes state over time, and stores approval actions for audit and retry.'
  };

  const repositoryBrief: ProjectBriefInput = {
    projectId: 'proj-789',
    projectTitle: 'Claims case storage boundary',
    businessSpecs: [
      'Case workers need one business-facing way to search, save, and retrieve claims regardless of whether data is in SQL, archived files, or a vendor case store.',
      'The domain workflow should not know query syntax or storage location.',
      'Storage may change by region and retention policy.'
    ],
    architectureSpecs: [
      'Hide persistence details from claims workflow code.',
      'Keep search and save operations behind a domain collection boundary.'
    ],
    businessProcess: 'Claim cases are saved, queried, and loaded through one domain data access boundary while storage implementations vary.'
  };

  const vagueBrief: ProjectBriefInput = {
    projectId: 'proj-000',
    projectTitle: 'Operations dashboard',
    businessSpecs: ['Build a dashboard for managers to see operational data.'],
    architectureSpecs: ['Keep it simple.'],
    businessProcess: 'Managers view metrics.'
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

  it('should infer template-method style workflows without requiring an adapter cue', () => {
    const scope = intakeService.intakeProjectBrief(documentWorkflowBrief);
    expect(scope.requiredPatterns).toEqual(expect.arrayContaining([
      'template-method',
      'command',
      'state',
    ]));
    expect(scope.requiredPatterns).not.toContain('adapter');
    expect(scope.confidence).toBe('medium');
  });

  it('should keep repository briefs on the storage boundary instead of the adapter path', () => {
    const scope = intakeService.intakeProjectBrief(repositoryBrief);
    expect(scope.requiredPatterns).toEqual(expect.arrayContaining(['repository']));
    expect(scope.requiredPatterns).not.toContain('adapter');
    expect(scope.confidence).toBe('low');
  });

  it('should stay low confidence on a vague brief rather than inventing a pattern', () => {
    const scope = intakeService.intakeProjectBrief(vagueBrief);
    expect(scope.requiredPatterns).toEqual([]);
    expect(scope.requiredModules).toEqual([]);
    expect(scope.confidence).toBe('low');
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
