import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, currentState } from './config.mjs';
import { ffmpegPath } from './prepare.mjs';

export function verifyDuration(seconds) {
  // AAC packets can extend container duration slightly beyond the video stream.
  // Allow less than one 30fps frame; decoded video must still contain 3480 frames.
  assert.ok(Number.isFinite(seconds) && Math.abs(seconds - 116) < 1 / 30 && seconds < 120, 'Film must be 116 seconds within sub-frame audio padding and below two minutes');
}
export function filmDirectory(state, revision) {
  if (revision === undefined) return path.join(state, 'film');
  assert.match(revision, /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/, 'Revision must be a short folder name');
  return path.join(state, 'film', revision);
}
export function requestedRevision(args = process.argv) {
  const index = args.indexOf('--revision');
  return index === -1 ? undefined : (args[index + 1] ?? '');
}
export async function verifyFilm(state = currentState(), voiceoverIncluded = null, revision) {
  const { getVideoMetadata } = createRequire(path.join(ROOT, 'Codebase/AVP/video/package.json'))('@remotion/renderer');
  const output = filmDirectory(state, revision);
  const destination = path.join(output, 'CodiNeo-AVP.mp4');
  const report = path.join(output, 'render-verification.json');
  fs.rmSync(report, { force: true });
  const metadata = await getVideoMetadata(destination);
  assert.equal(metadata.width, 1920); assert.equal(metadata.height, 1080);
  assert.equal(metadata.fps, 30); verifyDuration(metadata.durationInSeconds);
  assert.equal(metadata.codec, 'h264'); assert.equal(metadata.audioCodec, 'aac');
  const decode = spawnSync(ffmpegPath(), ['-hide_banner', '-i', destination, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8', timeout: 300000 });
  assert.equal(decode.status, 0, decode.stderr);
  const maxVolume = Number(decode.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  assert.ok(Number.isFinite(maxVolume) && maxVolume < -1, 'Audio must have safe peak headroom');
  assert.match(decode.stderr, /frame=\s*3480/, 'All 3480 output frames must decode');
  fs.writeFileSync(report, JSON.stringify({ passed: true, metadata, maxVolumeDb: maxVolume, decodedFrames: 3480, fullDecode: true, voiceoverIncluded, manualVisualReview: 'Review chapter PNGs and final MP4 before publication' }, null, 2));
  console.log(`Verified under-two-minute 1080p film: ${destination}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyFilm(currentState(), null, requestedRevision());
