import { afterEach, describe, it, expect, vi } from 'vitest';
import type { DetectedPatternResult } from '../services/classDeclarationAnalysisService';
import { buildWrapperExecutionPlans } from '../routes/analysis';

function mk(patternId: string, className: string): DetectedPatternResult {
  return {
    patternId,
    patternFamily: 'creational',
    patternName: patternId,
    targetClassHash: `${className}-${patternId}`,
    className,
    fileName: 'sample.cpp',
    classText: `class ${className} {};`,
    parentClassName: '',
    documentationTargets: [],
    unitTestTargets: [],
  };
}

describe('buildWrapperExecutionPlans', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an independent wrapper per eligible question', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.111111)
      .mockReturnValueOnce(0.222222);

    const plans = buildWrapperExecutionPlans([
      mk('creational.singleton', 'FirstQuestion'),
      mk('creational.factory', 'SecondQuestion'),
    ]);

    expect(plans).toHaveLength(2);
    expect(plans[0].className).toBe('FirstQuestion');
    expect(plans[1].className).toBe('SecondQuestion');
    expect(plans[0].wrapperId).not.toBe(plans[1].wrapperId);
    expect(plans[0].sourcePattern.classText).toContain('FirstQuestion');
    expect(plans[1].sourcePattern.classText).toContain('SecondQuestion');
  });
});
