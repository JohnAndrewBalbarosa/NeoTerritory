import fs from 'node:fs';

// Original, deterministic synthesis: no reference-video audio or stock samples.
// Low-level air sweeps emphasize editorial cuts; a short chord marks the brand.
export function writeCommercialCues(destination) {
  const rate = 48000;
  const samples = new Float32Array(116 * rate);
  const cuts = [8, 15, 20, 28, 36, 39, 42, 47.5, 51, 55, 59, 68, 76, 84, 90, 95, 98, 101, 104, 107, 110];
  let seed = 73491;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  for (const cut of cuts) {
    const start = Math.round((cut - 0.16) * rate);
    const count = Math.round(0.34 * rate);
    let low = 0;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const n = noise();
      low += (n - low) * (0.04 + t * 0.15);
      const envelope = Math.sin(Math.PI * t) ** 2;
      samples[start + i] += low * envelope * 0.1;
    }
  }
  for (const cut of [15, 110]) {
    const start = Math.round(cut * rate);
    for (let i = 0; i < rate * 0.6; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t / 0.015) * Math.exp(-t * 8);
      const chord = [523.25, 659.25, 783.99].reduce((sum, hz) => sum + Math.sin(2 * Math.PI * hz * t), 0) / 3;
      samples[start + i] += chord * envelope * 0.035;
    }
  }
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(destination, wav);
}
