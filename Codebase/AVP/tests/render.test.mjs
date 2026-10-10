import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDuration, filmDirectory, requestedRevision } from '../verify-render.mjs';
test('container may include sub-frame AAC padding while preserving a 116-second film', () => {
  verifyDuration(116);
  verifyDuration(116.011);
});
test('incorrect lengths and two-minute output are rejected', () => {
  for (const duration of [NaN, null, 115, 116.1, 120, 121]) assert.throws(() => verifyDuration(duration));
});
test('revision exports preserve the original destination and reject path traversal', () => {
  assert.equal(filmDirectory('/tmp/demo'), '/tmp/demo/film');
  assert.equal(filmDirectory('/tmp/demo', requestedRevision(['--prepared', '--revision', 'v2'])), '/tmp/demo/film/v2');
  assert.equal(requestedRevision([]), undefined);
  for (const revision of ['', '../outside', '/tmp/outside', requestedRevision(['--revision'])]) {
    assert.throws(() => filmDirectory('/tmp/demo', revision));
  }
});
