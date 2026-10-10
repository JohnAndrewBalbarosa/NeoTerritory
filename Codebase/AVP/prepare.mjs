import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, currentState } from './config.mjs';

export const clipNames = ['01_pm_project_spec', '02_pm_strategy_recommendation', '03_intern_pretest', '04_strategy_recommended', '05_strategy_module', '06_strategy_assessment', '07_studio_source_upload', '08_studio_analyze', '09_strategy_result_overview', '10_strategy_evidence_detail', '11_generated_documentation', '12_export_controls'];
export function validateClips(clips) {
  assert.equal(clips.length, clipNames.length, 'Exactly twelve clean clips required');
  assert.deepEqual(clips.map((c) => c.name), clipNames, 'Clips must be unique and ordered');
  for (const clip of clips) {
    assert.match(clip.source, /^[a-zA-Z0-9_-]+\.webm$/, 'Source must stay inside capture directory');
    assert.ok(Number.isFinite(clip.start) && clip.start >= 0, 'Invalid start');
    assert.ok(Number.isFinite(clip.duration) && clip.duration > 1 && clip.duration < 90, 'Invalid duration');
  }
  return clips;
}
export function selectClipWindow(clip) {
  // Capture holds the completed analysis for 2.5 seconds. Keep that real result
  // plus at most one second of its preceding wait, even on a slower machine.
  const skippedWait = clip.name === '08_studio_analyze' ? Math.max(0, clip.duration - 3.5) : 0;
  return { start: clip.start + skippedWait, duration: Math.min(7.8, clip.duration - skippedWait - .18) };
}
export function ffmpegPath() {
  return createRequire(path.join(ROOT, 'Codebase/AVP/video/package.json'))('ffmpeg-static');
}
export function encode(args) {
  const result = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', timeout: 300000 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || 'Video encoding failed');
  return result;
}
export function createScore(destination) {
  // Original deterministic synthesis: no samples, loops, licensed recordings, or speech.
  const rate = 48000, seconds = 116, count = rate * seconds;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(36 + count * 2, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  let peak = 0;
  const notes = [55, 65.4064, 73.4162, 49];
  for (let i = 0; i < count; i++) {
    const t = i / rate, root = notes[Math.floor(t / 8) % notes.length];
    const beat = t % .625, pulse = Math.exp(-beat * 15) * (1 - Math.exp(-beat * 200));
    const arc = t < 21 ? .45 : t < 72 ? .7 : t < 89 ? .55 : .8;
    const fade = Math.min(1, t / 3, Math.max(0, (116 - t) / 5));
    const chordFade = Math.min(1, (t % 8) / .3, (8 - t % 8) / .5);
    const pad = chordFade * (.10 * Math.sin(2 * Math.PI * root * t) + .045 * Math.sin(2 * Math.PI * root * 1.5 * t) + .025 * Math.sin(2 * Math.PI * root * 2 * t));
    const tick = .035 * pulse * Math.sin(2 * Math.PI * 880 * t);
    const bass = .09 * pulse * Math.sin(2 * Math.PI * 55 * beat + 3 * Math.exp(-beat * 25));
    const reveal = .08 * Math.exp(-Math.max(0, t - 21) * 2) * (t >= 21 && t < 24 ? Math.sin(2 * Math.PI * 110 * t) : 0);
    const value = fade * arc * (pad + tick + bass + reveal);
    peak = Math.max(peak, Math.abs(value)); wav.writeInt16LE(Math.round(value * 32767), 44 + 2 * i);
  }
  fs.writeFileSync(destination, wav);
  return { originalSynthesis: true, durationSeconds: seconds, sampleRate: rate, peakAmplitude: peak, clippedSamples: 0 };
}
export async function prepare(state = currentState()) {
  const capture = path.join(state, 'capture');
  const success = JSON.parse(fs.readFileSync(path.join(capture, 'capture-success.json'), 'utf8'));
  assert.equal(success.passed, true, 'A successful real capture is required');
  assert.equal(success.learningBypass, false);
  const clips = validateClips(JSON.parse(fs.readFileSync(path.join(capture, 'clips.json'), 'utf8')));
  const assets = path.join(ROOT, 'Codebase/AVP/video/public');
  fs.mkdirSync(path.join(assets, 'clips'), { recursive: true });
  fs.mkdirSync(path.join(assets, 'stills'), { recursive: true });
  const report = [];
  for (const clip of clips) {
    // Preserve interaction speed; hold the last clean frame to fill an eight-second editorial take.
    // The final 180ms is excluded to avoid leaking the following assessment state into a clip.
    const { start, duration } = selectClipWindow(clip);
    encode(['-ss', String(start), '-i', path.join(capture, clip.source), '-t', String(duration), '-an', '-vf', 'fps=30,scale=1920:1080', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', path.join(assets, 'clips', `${clip.name}.take.mp4`)]);
    encode(['-i', path.join(assets, 'clips', `${clip.name}.take.mp4`), '-vf', 'tpad=stop_mode=clone:stop_duration=8', '-t', '8', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(assets, 'clips', `${clip.name}.mp4`)]);
    fs.unlinkSync(path.join(assets, 'clips', `${clip.name}.take.mp4`));
    fs.copyFileSync(path.join(capture, `${clip.name}.png`), path.join(assets, 'stills', `${clip.name}.png`));
    report.push({ ...clip, selectedStart: start, selectedDuration: duration, deliveredDuration: 8, playbackSpeed: 1 });
  }
  const audio = createScore(path.join(assets, 'score.wav'));
  fs.writeFileSync(path.join(state, 'prepared-media.json'), JSON.stringify({ capture: path.relative(ROOT, capture), clips: report, audio }, null, 2));
  console.log('Prepared twelve separate 1080p clips and an original 116-second score.');
  return state;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepare().catch((error) => { console.error(error.message); process.exitCode = 1; });
