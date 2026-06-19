import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectedPatternResult } from '../services/classDeclarationAnalysisService';
import type { TestPhase, TestResult } from '../services/testRunnerService';

vi.mock('../services/testRunnerService', () => ({
  runStaticAnalysis: vi.fn(),
  runSubmissionCompile: vi.fn(),
  runPatternUnitTest: vi.fn(),
  isTestRunnerEnabled: vi.fn(() => true),
  getDisableReason: vi.fn(() => ''),
}));

import { dispatchPatternTests } from '../routes/analysis';
import {
  runPatternUnitTest,
  runStaticAnalysis,
  runSubmissionCompile,
} from '../services/testRunnerService';

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

function resultFor(input: any, phase: TestPhase): TestResult {
  return {
    patternId: input.patternId,
    patternName: input.patternName,
    className: input.className,
    wrapperId: input.wrapperId,
    wrapperOwnerKey: input.wrapperOwnerKey ?? null,
    wrapperSharesDocker: input.wrapperSharesDocker === true,
    phase,
    passed: true,
    expected: phase === 'static_analysis' ? 'no error-level findings' : 'pass',
    actual: '',
    exitCode: 0,
    durationMs: 1,
    verdict: 'pass',
  };
}

describe('dispatchPatternTests wrapper isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runStaticAnalysis).mockImplementation(async (input: any) => resultFor(input, 'static_analysis'));
    vi.mocked(runSubmissionCompile).mockImplementation(async (input: any) => {
      if (input.className === 'SecondQuestion') {
        throw new Error('compile transport lost');
      }
      return resultFor(input, 'compile_run');
    });
    vi.mocked(runPatternUnitTest).mockImplementation(async (input: any) => resultFor(input, 'unit_test'));
  });

  it('keeps sibling wrapper results when one wrapper phase throws', async () => {
    const results = await dispatchPatternTests(
      [
        mk('creational.singleton', 'FirstQuestion'),
        mk('creational.factory', 'SecondQuestion'),
      ],
      'class FirstQuestion {}; class SecondQuestion {};',
      undefined,
      42
    );

    const first = results.filter((row) => row.className === 'FirstQuestion');
    const second = results.filter((row) => row.className === 'SecondQuestion');

    expect(first.map((row) => row.phase)).toEqual(['static_analysis', 'compile_run', 'unit_test']);
    expect(first.every((row) => row.passed)).toBe(true);
    expect(new Set(first.map((row) => row.wrapperId)).size).toBe(1);

    expect(second.map((row) => row.phase)).toEqual(['static_analysis', 'compile_run', 'unit_test']);
    expect(second[0].verdict).toBe('pass');
    expect(second[1].verdict).toBe('sandbox_disabled');
    expect(second[1].message).toContain('compile transport lost');
    expect(second[2].verdict).toBe('skipped');
    expect(new Set(second.map((row) => row.wrapperId)).size).toBe(1);

    expect(first[0].wrapperId).not.toBe(second[0].wrapperId);
    expect(second.every((row) => row.wrapperOwnerKey === 'user:42')).toBe(true);
    expect(second.every((row) => row.wrapperSharesDocker === true)).toBe(true);
    expect(runPatternUnitTest).toHaveBeenCalledTimes(1);
  });
});
