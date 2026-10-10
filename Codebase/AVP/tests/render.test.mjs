import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDuration } from '../verify-render.mjs';
test('container may include sub-frame AAC padding while preserving a 116-second film', () => {
  verifyDuration(116);
  verifyDuration(116.011);
});
test('incorrect lengths and two-minute output are rejected', () => {
  for (const duration of [NaN, null, 115, 116.1, 120, 121]) assert.throws(() => verifyDuration(duration));
});
