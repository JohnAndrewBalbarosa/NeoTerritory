import { describe, expect, it } from 'vitest';
import { generateCoursePlan } from '../services/coursePlannerService';

describe('Course planner fallback audit', () => {
  it('surfaces template-method and a visible audit for a document workflow', async () => {
    const plan = await generateCoursePlan({
      prompt: [
        'Every contract must follow the same review pipeline: draft intake, compliance review, finance approval, executive signoff, and archive.',
        'Departments may customize what happens inside each approval step but cannot change the overall order.',
        'A contract moves between draft, under review, rejected, approved, and archived, and actions available to staff change by lifecycle stage.',
        'Approvers need queued approval and rejection actions with audit history and retry support.',
      ].join(' '),
    });

    expect(plan.source).toBe('heuristic');
    expect(plan.diagnostics.fallbackReason).toBe('no_provider');
    expect(plan.modules.filter((module) => module.published && module.category !== 'foundations').map((module) => module.title))
      .toEqual(expect.arrayContaining(['Command', 'Template Method']));
    expect(plan.diagnostics.patternAudit).toBeDefined();
    expect(plan.diagnostics.patternAudit?.some((item) => item.slug === 'template-method')).toBe(true);
    expect(plan.diagnostics.patternAudit?.some((item) => item.slug === 'adapter' && item.selected === false)).toBe(true);
  });
});
