import { describe, it, expect } from 'vitest';
import { passRateBucket } from '../passRateBucket';

describe('passRateBucket', () => {
  it('returns none when there is no data', () => {
    expect(passRateBucket(0, 0)).toBe('none');
  });
  it('buckets high/mid/low by first-try pass rate', () => {
    expect(passRateBucket(0.9, 10)).toBe('high');
    expect(passRateBucket(0.8, 10)).toBe('high');
    expect(passRateBucket(0.65, 10)).toBe('mid');
    expect(passRateBucket(0.5, 10)).toBe('mid');
    expect(passRateBucket(0.49, 10)).toBe('low');
    expect(passRateBucket(0, 4)).toBe('low');
  });
});
