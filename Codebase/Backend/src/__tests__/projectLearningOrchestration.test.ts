import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { ProjectBriefInput } from '../services/projectLearningContracts';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-orch-'));
const dbPath = path.join(tmpRoot, 'projectLearningOrchestration.sqlite');

vi.mock('../db/_testSeed/devconUsers', () => ({
  seedDevconUsers: () => {},
  ensureTestFolders: () => {},
}));

let intakeService: typeof import('../services/projectSpecIntakeService');
let policyService: typeof import('../services/featureTogglePolicyService');
let assessmentService: typeof import('../services/assessmentOrchestrationService');
let PATTERN_CATALOG: (typeof import('../services/coursePlannerService'))['PATTERN_CATALOG'];

describe('Project Learning Orchestration Flow', () => {
  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    const { initDb } = await import('../db/initDb');
    initDb();

    intakeService = await import('../services/projectSpecIntakeService');
    policyService = await import('../services/featureTogglePolicyService');
    assessmentService = await import('../services/assessmentOrchestrationService');
    ({ PATTERN_CATALOG } = await import('../services/coursePlannerService'));
  });

  const devconDelegationBrief: ProjectBriefInput = {
    projectId: 'proj-devcon',
    projectTitle: 'Devcon student module delegation',
    businessSpecs: [
      'Conference volunteers and student interns move through one stable enrollment flow, but onboarding, practice, check-ins, and certification can vary by cohort.',
      'Progress records belong behind one repository boundary so the learning workflow does not need storage details.',
      'Student journey state should unlock or hide actions as milestones change, and dashboards must fan out updates to instructors and mentors.',
      'Different cohorts choose different prioritization rules at runtime, and review actions must be queued for audit and retry.'
    ],
    architectureSpecs: [
      'Keep the workflow skeleton stable while allowing step overrides per cohort.',
      'Keep storage behind a repository boundary and broadcast milestone changes through observers.',
      'Do not use Adapter to model the delegation layer.',
      'Do not use Singleton to model the delegation layer.'
    ],
    businessProcess: 'Mentors enroll students, delegate modules by readiness, persist progress, notify dashboards when milestones change, and switch review policy per cohort without changing the overall workflow skeleton.'
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

  it('should convert a Devcon delegation brief into a scoped learning plan', () => {
    const scope = intakeService.intakeProjectBrief(devconDelegationBrief);
    expect(scope.projectId).toBe('proj-devcon');
    expect(scope.requiredPatterns).toEqual(expect.arrayContaining([
      'command',
      'observer',
      'repository',
      'state',
      'strategy',
    ]));
    expect(scope.requiredPatterns).not.toContain('adapter');
    expect(scope.excludedPatterns).toEqual(expect.arrayContaining(['adapter', 'singleton']));
    expect(scope.requiredModules.some((moduleId) => moduleId.includes('command'))).toBe(true);
    expect(scope.requiredModules.some((moduleId) => moduleId.includes('repository'))).toBe(true);
    expect(scope.requiredModules.some((moduleId) => moduleId.includes('state'))).toBe(true);
    expect(scope.requiredModules.some((moduleId) => moduleId.includes('observer'))).toBe(true);
    expect(scope.requiredModules.some((moduleId) => moduleId.includes('strategy'))).toBe(true);
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
    const scope = intakeService.intakeProjectBrief(devconDelegationBrief);
    const manifest = policyService.resolveTogglePolicy(scope);

    const adapterToggle = manifest.toggles.find(t => t.key === 'pattern.adapter');
    expect(adapterToggle?.enabled).toBe(false);

    const singletonToggle = manifest.toggles.find((t) => t.key === 'pattern.singleton');
    expect(singletonToggle?.enabled).toBe(false);

    const commandToggle = manifest.toggles.find((t) => t.key === 'pattern.command');
    expect(commandToggle?.enabled).toBe(true);

    const repositoryToggle = manifest.toggles.find((t) => t.key === 'pattern.repository');
    expect(repositoryToggle?.enabled).toBe(true);

    const observerToggle = manifest.toggles.find((t) => t.key === 'pattern.observer');
    expect(observerToggle?.enabled).toBe(true);

    const strategyToggle = manifest.toggles.find((t) => t.key === 'pattern.strategy');
    expect(strategyToggle?.enabled).toBe(true);
  });

  it('should load a JSON toggle policy that covers every catalog pattern', () => {
    const config = policyService.loadTogglePolicyConfig();
    const policySlugs = config.patterns.map((pattern) => pattern.slug).sort();
    const catalogSlugs = PATTERN_CATALOG.map((pattern) => pattern.slug).sort();
    expect(policySlugs).toEqual(catalogSlugs);
    expect(config.patterns.some((pattern) => pattern.toggleKey === 'pattern.template-method')).toBe(true);
  });

  it('should score a pretest and suggest bypass if passed', () => {
    const pretestAttempt = {
      projectId: 'proj-123',
      internId: 'int-456',
      moduleId: 'command',
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
      moduleId: 'command',
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
