import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetRunEventsStoreForTests,
  pushPhaseEvent,
  reserveRun,
  subscribeRun,
  type RunEvent,
  type RunPhaseEvent,
} from '../services/runEventsStore';
import type { TestResult } from '../services/testRunnerService';

function mkResult(wrapperId: string): TestResult {
  return {
    patternId: 'pattern.one',
    patternName: 'pattern.one',
    className: 'Widget',
    wrapperId,
    wrapperOwnerKey: null,
    wrapperSharesDocker: false,
    phase: 'compile_run',
    passed: true,
    expected: 'expected',
    actual: 'actual',
    exitCode: 0,
    durationMs: 1,
    verdict: 'pass',
  };
}

describe('runEventsStore.pushPhaseEvent', () => {
  afterEach(() => {
    _resetRunEventsStoreForTests();
  });

  it('keeps distinct wrapperIds and dedupes an exact duplicate wrapperId', () => {
    const runId = 'run-1';
    expect(reserveRun(runId, 7)).toBe(true);

    const seen: RunEvent[] = [];
    subscribeRun(runId, (event) => {
      seen.push(event);
    });

    pushPhaseEvent(runId, 'compile_run', mkResult('wrapper-a'));
    pushPhaseEvent(runId, 'compile_run', mkResult('wrapper-b'));
    pushPhaseEvent(runId, 'compile_run', mkResult('wrapper-a'));

    const phases = seen.filter((event): event is RunPhaseEvent => event.type === 'phase');

    expect(phases).toHaveLength(2);
    expect(phases.map((event) => event.result.wrapperId)).toEqual(['wrapper-a', 'wrapper-b']);
  });
});
