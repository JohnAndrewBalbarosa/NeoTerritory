import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDemoDirectory, demoEnvironment } from './isolation.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const local = path.join(ROOT, 'Codebase/AVP/.local');

export function currentState() {
  const state = assertDemoDirectory(ROOT, fs.readFileSync(path.join(local, 'current'), 'utf8').trim());
  const marker = JSON.parse(fs.readFileSync(path.join(state, 'marker.json'), 'utf8'));
  if (marker.kind !== 'codineo-avp' || marker.root !== ROOT) throw new Error('Invalid demo ownership marker');
  return state;
}

export function runtimeEnvironment(state) {
  const env = demoEnvironment(ROOT, state);
  const credentials = JSON.parse(fs.readFileSync(path.join(state, 'credentials.json'), 'utf8'));
  Object.assign(env, { JWT_SECRET: credentials.jwtSecret, ADMIN_USERNAME: 'AVP Project Manager', ADMIN_PASSWORD: credentials.managerPassword });
  const binary = ['build-macos/NeoTerritory', 'build-linux/NeoTerritory', 'build/NeoTerritory', 'build-wsl/NeoTerritory', 'build/NeoTerritory.exe']
    .map((p) => path.join(ROOT, 'Codebase/Microservice', p)).find((p) => fs.existsSync(p));
  if (binary) env.NEOTERRITORY_BIN = binary;
  return env;
}
