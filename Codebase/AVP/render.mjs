import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ROOT, currentState } from './config.mjs';
import { prepare } from './prepare.mjs';
import { verifyFilm } from './verify-render.mjs';

const requireVideo = createRequire(path.join(ROOT, 'Codebase/AVP/video/package.json'));
const { bundle } = requireVideo('@remotion/bundler');
const { selectComposition, renderMedia, renderStill } = requireVideo('@remotion/renderer');
const { chromium } = createRequire(path.join(ROOT, 'Codebase/Frontend/package.json'))('playwright');
const state = currentState();
const output = path.join(state, 'film');
fs.mkdirSync(output, { recursive: true });
fs.rmSync(path.join(output, 'render-verification.json'), { force: true });
if (!process.argv.includes('--prepared')) await prepare(state);
const inputProps = { music: true };
const voIndex = process.argv.indexOf('--voiceover');
if (voIndex !== -1) {
  const source = path.resolve(process.argv[voIndex + 1] || '');
  assert.ok(fs.statSync(source).isFile(), 'Voiceover must be an audio file');
  const ext = path.extname(source).toLowerCase();
  assert.ok(['.wav', '.mp3', '.m4a'].includes(ext), 'Use WAV, MP3 or M4A voiceover');
  inputProps.voiceover = `voiceover${ext}`;
  fs.copyFileSync(source, path.join(ROOT, 'Codebase/AVP/video/public', inputProps.voiceover));
}
const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'Codebase/AVP/video/src/index.tsx'), publicDir: path.join(ROOT, 'Codebase/AVP/video/public') });
const browserExecutable = chromium.executablePath();
const composition = await selectComposition({ serveUrl, id: 'CodiNeoAVP', inputProps, browserExecutable });
assert.equal(composition.durationInFrames, 3480); assert.equal(composition.fps, 30);
const reviewFrames = [90, 190, 390, 720, 960, 1200, 1410, 1500, 1605, 1740, 1860, 1980, 2220, 2430, 2600, 2840, 3060, 3220, 3400];
for (const frame of reviewFrames) await renderStill({ serveUrl, composition, inputProps, browserExecutable, frame, output: path.join(output, `review-${String(frame).padStart(4, '0')}.png`), imageFormat: 'png' });
console.log('Rendered chapter review frames.');
if (process.argv.includes('--stills-only')) process.exit(0);
const destination = path.join(output, 'CodiNeo-AVP.mp4');
let reported = -1;
await renderMedia({
  serveUrl, composition, inputProps, browserExecutable, outputLocation: destination,
  codec: 'h264', audioCodec: 'aac', pixelFormat: 'yuv420p', crf: 18, x264Preset: 'medium', concurrency: 4,
  timeoutInMilliseconds: 120000,
  onProgress: ({ progress }) => { const step = Math.floor(progress * 10); if (step > reported) { reported = step; console.log(`Rendering ${step * 10}%`); } },
});
await verifyFilm(state, Boolean(inputProps.voiceover));
