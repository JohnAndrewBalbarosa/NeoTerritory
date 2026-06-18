import { describe, expect, it } from 'vitest';
import { isLocalTestInternEnabled } from '../services/localDevelopmentAccess';

describe('local test intern access policy', () => {
  it('allows local and test runtimes', () => {
    expect(isLocalTestInternEnabled(undefined)).toBe(true);
    expect(isLocalTestInternEnabled('development')).toBe(true);
    expect(isLocalTestInternEnabled('test')).toBe(true);
  });

  it('rejects production runtime', () => {
    expect(isLocalTestInternEnabled('production')).toBe(false);
  });
});
