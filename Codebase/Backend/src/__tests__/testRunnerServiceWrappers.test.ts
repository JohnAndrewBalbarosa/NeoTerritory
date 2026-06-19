import { describe, expect, it } from 'vitest';
import { binaryNameForWrapper } from '../services/testRunnerService';

describe('testRunnerService wrapper binary names', () => {
  it('keeps legacy binary names when no wrapper id is present', () => {
    expect(binaryNameForWrapper('user_main')).toBe('user_main');
    expect(binaryNameForWrapper('unit_driver')).toBe('unit_driver');
  });

  it('adds a sanitized wrapper suffix so shared-pod cleanup targets one wrapper', () => {
    expect(binaryNameForWrapper('user_main', 'wrap_creational.singleton/Class#1'))
      .toBe('user_main_wrap_creational_singleton_Class_1');
    expect(binaryNameForWrapper('unit_driver', 'wrap_behavioral-observer_abc123'))
      .toBe('unit_driver_wrap_behavioral-observer_abc123');
  });
});
