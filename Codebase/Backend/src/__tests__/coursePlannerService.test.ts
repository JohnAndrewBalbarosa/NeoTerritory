import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/aiDocumentationService', () => ({
  pickProvider: vi.fn(() => null),
}));

import { generateCoursePlan } from '../services/coursePlannerService';

describe('Course planner fallback audit', () => {
  const devconStudentPrompt = [
    'Devcon student module delegation needs one stable enrollment flow, but onboarding, practice, check-ins, and certification can vary by cohort.',
    'Progress records belong behind a repository boundary so the study workflow does not know storage details.',
    'Student journey state should unlock or hide actions as milestones change, and dashboard updates must fan out to instructors and mentors.',
    'Different cohorts choose different prioritization rules at runtime, so the workflow needs a strategy boundary instead of hard-coded branching.',
    'Review actions are queued for audit and retry, and the admin panel should expose one simple front door while keeping the intern-learning modules separate.',
  ].join(' ');

  it('surfaces a diverse non-adapter plan for a Devcon-style student delegation brief', async () => {
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
    expect(plan.requiredLearning.length).toBeGreaterThanOrEqual(3);
    expect(plan.diagnostics.patternAudit).toBeDefined();
    expect(plan.diagnostics.patternAudit?.some((item) => item.slug === 'repository' && item.selected)).toBe(true);
    expect(plan.diagnostics.patternAudit?.some((item) => item.slug === 'state' && item.selected)).toBe(true);
    expect(plan.diagnostics.patternAudit?.some((item) => item.slug === 'strategy' && item.selected)).toBe(true);
  });
});
