import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neoterritory-planner-'));
const dbPath = path.join(tmpRoot, 'planner.sqlite');

const aiMocks = vi.hoisted(() => ({
  pickProvider: vi.fn(),
}));

vi.mock('../services/aiDocumentationService', () => ({
  pickProvider: aiMocks.pickProvider,
}));

vi.mock('../db/_testSeed/devconUsers', () => ({
  seedDevconUsers: () => {},
  ensureTestFolders: () => {},
}));

import { generateCoursePlan } from '../services/coursePlannerService';

const devconStudentPrompt = [
  'Devcon student module delegation needs one stable enrollment flow, but onboarding, practice, check-ins, and certification can vary by cohort.',
  'Progress records belong behind a repository boundary so the study workflow does not know storage details.',
  'Student journey state should unlock or hide actions as milestones change, and dashboard updates must fan out to instructors and mentors.',
  'Different cohorts choose different prioritization rules at runtime, so the workflow needs a strategy boundary instead of hard-coded branching.',
  'Review actions are queued for audit and retry, and the admin panel should expose one simple front door while keeping the intern-learning modules separate.',
].join(' ');

function mockAnthropicJson(payload: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    }),
    text: async () => '',
  })));
}

function useMockProvider(): void {
  aiMocks.pickProvider.mockReturnValue({
    provider: 'anthropic',
    apiKey: 'test-key',
    model: 'test-model',
  });
}

describe('Course planner validation', () => {
  beforeAll(async () => {
    process.env.DB_PATH = dbPath;
    const { initDb } = await import('../db/initDb');
    initDb();
  });

  beforeEach(() => {
    aiMocks.pickProvider.mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('surfaces a diverse non-adapter plan for a Devcon-style fallback brief', async () => {
    const plan = await generateCoursePlan({ prompt: devconStudentPrompt });
    const selectedSlugs = plan.diagnostics.patternAudit?.filter((item) => item.selected).map((item) => item.slug) ?? [];
    const publishedTitles = plan.modules
      .filter((module) => module.published && module.category !== 'foundations')
      .map((module) => module.title);

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('no_provider');
    expect(selectedSlugs).toEqual(expect.arrayContaining([
      'repository',
      'state',
      'strategy',
    ]));
    expect(selectedSlugs).not.toContain('adapter');
    expect(publishedTitles).toEqual(expect.arrayContaining([
      'Repository',
      'State',
      'Strategy',
    ]));
    expect(plan.diagnostics.patternDiversity?.adapter.selected).toBe(false);
  });

  it('accepts structurally valid AI JSON with validation diagnostics', async () => {
    useMockProvider();
    mockAnthropicJson({
      summary: 'Repository, State, and Strategy are the project-specific modules.',
      sections: [
        {
          sectionId: 'structural',
          section: 'Structural',
          modules: [
            {
              moduleId: 'structural-repository',
              title: 'Repository',
              category: 'structural',
              published: true,
              reason: 'The workflow needs persistence hidden behind a domain collection boundary.',
            },
          ],
        },
        {
          sectionId: 'behavioural',
          section: 'Behavioural',
          modules: [
            {
              moduleId: 'behavioural-state',
              title: 'State',
              category: 'behavioural',
              published: true,
              reason: 'Student journeys change behavior as milestones transition.',
            },
            {
              moduleId: 'behavioural-strategy',
              title: 'Strategy',
              category: 'behavioural',
              published: true,
              reason: 'Cohorts choose different prioritization policies at runtime.',
            },
          ],
        },
      ],
      requiredLearning: [
        { moduleId: 'structural-repository', title: 'Repository', category: 'structural' },
        { moduleId: 'behavioural-state', title: 'State', category: 'behavioural' },
        { moduleId: 'behavioural-strategy', title: 'Strategy', category: 'behavioural' },
      ],
    });

    const plan = await generateCoursePlan({ prompt: devconStudentPrompt });
    const publishedIds = plan.modules.filter((module) => module.published).map((module) => module.moduleId);

    expect(plan.source).toBe('ai');
    expect(plan.diagnostics.aiValidation?.status).toBe('passed');
    expect(plan.diagnostics.aiValidation?.mode).toBe('sections');
    expect(plan.diagnostics.aiValidation?.issues).toEqual([]);
    expect(plan.diagnostics.fallbackReason).toBeUndefined();
    expect(publishedIds).toEqual(expect.arrayContaining([
      'foundations-interface-principle',
      'structural-repository',
      'behavioural-state',
      'behavioural-strategy',
    ]));
    expect(plan.diagnostics.patternDiversity?.selectedSlugs).toEqual(expect.arrayContaining([
      'repository',
      'state',
      'strategy',
    ]));
  });

  it('falls back when AI returns mixed or duplicate module output', async () => {
    useMockProvider();
    mockAnthropicJson({
      summary: 'Invalid mixed plan.',
      sections: [
        {
          sectionId: 'structural',
          section: 'Structural',
          modules: [
            { moduleId: 'structural-repository', title: 'Repository', category: 'structural', published: true },
          ],
        },
      ],
      modules: [
        { moduleId: 'structural-repository', title: 'Repository', category: 'structural', published: true },
      ],
      requiredLearning: [
        { moduleId: 'structural-repository', title: 'Repository', category: 'structural' },
      ],
    });

    const plan = await generateCoursePlan({ prompt: devconStudentPrompt });

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('invalid_structure');
    expect(plan.diagnostics.aiValidation?.status).toBe('failed');
    expect(plan.diagnostics.aiValidation?.issues).toEqual(expect.arrayContaining([
      'mixed_sections_modules',
      'duplicate_module:structural-repository',
    ]));
  });

  it('falls back when AI returns unknown ids or selects foundation modules directly', async () => {
    useMockProvider();
    mockAnthropicJson({
      summary: 'Invalid section plan.',
      sections: [
        {
          sectionId: 'structural',
          section: 'Structural',
          modules: [
            {
              moduleId: 'structural-repository',
              title: 'Repository',
              category: 'structural',
              published: true,
            },
            {
              moduleId: 'foundations-interface-principle',
              title: 'Program to an interface',
              category: 'foundations',
              published: true,
            },
            {
              moduleId: 'unknown-module',
              title: 'Unknown',
              category: 'structural',
              published: true,
            },
          ],
        },
        {
          sectionId: 'future',
          section: 'Future',
          modules: [
            {
              moduleId: 'behavioural-state',
              title: 'State',
              category: 'behavioural',
              published: true,
            },
          ],
        },
      ],
      requiredLearning: [
        { moduleId: 'behavioural-state', title: 'State', category: 'behavioural' },
      ],
    });

    const plan = await generateCoursePlan({ prompt: devconStudentPrompt });

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('invalid_structure');
    expect(plan.diagnostics.aiValidation?.status).toBe('failed');
    expect(plan.diagnostics.aiValidation?.issues).toEqual(expect.arrayContaining([
      'unknown_section:future',
      'unknown_module:unknown-module',
      'foundation_module_selected:foundations-interface-principle',
      'required_learning_outside_selected_scope:behavioural-state',
    ]));
  });

  it('falls back as ai_empty when AI returns a valid but empty plan', async () => {
    useMockProvider();
    mockAnthropicJson({
      summary: 'Empty plan.',
      sections: [
        {
          sectionId: 'structural',
          section: 'Structural',
          modules: [],
        },
      ],
      requiredLearning: [],
    });

    const plan = await generateCoursePlan({ prompt: devconStudentPrompt });

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('ai_empty');
    expect(plan.diagnostics.aiSucceeded).toBe(true);
    expect(plan.diagnostics.aiValidation?.status).toBe('failed');
    expect(plan.diagnostics.aiValidation?.issues).toContain('empty_selected_plan');
  });

  it('falls back when AI keeps the plan too narrow across one family', async () => {
    useMockProvider();
    mockAnthropicJson({
      summary: 'Narrow structural plan.',
      sections: [
        {
          sectionId: 'structural',
          section: 'Structural',
          modules: [
            {
              moduleId: 'structural-repository',
              title: 'Repository',
              category: 'structural',
              published: true,
            },
            {
              moduleId: 'structural-facade',
              title: 'Facade',
              category: 'structural',
              published: true,
            },
          ],
        },
      ],
      requiredLearning: [
        { moduleId: 'structural-repository', title: 'Repository', category: 'structural' },
        { moduleId: 'structural-facade', title: 'Facade', category: 'structural' },
      ],
    });

    const plan = await generateCoursePlan({ prompt: 'Build a simple front door to several services with a domain repository behind it.' });

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('pattern_diversity_low');
    expect(plan.diagnostics.aiValidation?.issues).toContain('pattern_diversity_low');
    expect(plan.diagnostics.patternDiversity?.diversityScore).toBeLessThan(45);
  });

  it('falls back when AI over-selects Adapter without translation evidence', async () => {
    useMockProvider();
    mockAnthropicJson({
      summary: 'Weak adapter-only plan.',
      sections: [
        {
          sectionId: 'structural',
          section: 'Structural',
          modules: [
            {
              moduleId: 'structural-adapter',
              title: 'Adapter',
              category: 'structural',
              published: true,
              reason: 'The admin panel has wrappers around subsystem calls.',
            },
          ],
        },
      ],
      requiredLearning: [
        { moduleId: 'structural-adapter', title: 'Adapter', category: 'structural' },
      ],
    });

    const prompt = 'The admin panel should expose one simple front door over several backend services while wrappers keep the same internal API.';
    const plan = await generateCoursePlan({ prompt });

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('adapter_overselected');
    expect(plan.diagnostics.aiValidation?.issues).toContain('adapter_overselected');
    expect(plan.diagnostics.patternDiversity?.adapter.blockedReason).toBeDefined();
  });
});
