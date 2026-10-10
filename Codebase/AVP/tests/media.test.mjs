import test from 'node:test';
import assert from 'node:assert/strict';
import { clipNames, validateClips, selectClipWindow } from '../prepare.mjs';
const valid = () => clipNames.map((name) => ({ name, source: 'intern.webm', start: 0, duration: 3 }));
test('slow analysis edits preserve its actual completed result within the four-second scene', () => {
  const selected = selectClipWindow({ name: '08_studio_analyze', start: 20, duration: 52.5 });
  assert.equal(selected.start, 69);
  assert.equal(selected.duration, 3.32);
  assert.ok(selected.start < 70 && selected.start + selected.duration > 72);
  assert.deepEqual(selectClipWindow({ name: '08_studio_analyze', start: 20, duration: 2.5 }), { start: 20, duration: 2.32 });
});
test('capture manifest requires all twelve unique ordered product states', () => {
  assert.equal(validateClips(valid()).length, 12);
  assert.throws(() => validateClips(valid().slice(1)), /twelve/);
  const duplicate = valid(); duplicate[1].name = duplicate[0].name;
  assert.throws(() => validateClips(duplicate), /unique/);
});
test('capture manifest rejects path traversal and invalid time ranges', () => {
  for (const patch of [{ source: '../credentials.webm' }, { source: '/tmp/outside.webm' }, { start: -1 }, { duration: NaN }, { duration: 120 }]) {
    const clips = valid(); Object.assign(clips[0], patch); assert.throws(() => validateClips(clips));
  }
});
