import fs from 'node:fs';
import path from 'node:path';

export function assertDemoDirectory(root, state) {
  const base = path.resolve(root, 'Codebase/AVP/.local');
  const target = path.resolve(state);
  if (path.dirname(target) !== base || !/^run-[a-zA-Z0-9-]+$/.test(path.basename(target))) {
    throw new Error('Refusing non-demo state directory');
  }
  for (let current = target; current !== path.dirname(current); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error('Demo state cannot use symbolic links');
    }
  }
  for (const name of ['demo.sqlite', 'credentials.json', 'outputs', 'next']) {
    const item = path.join(target, name);
    if (fs.existsSync(item) && (fs.lstatSync(item).isSymbolicLink() || fs.lstatSync(item).nlink > 1 && fs.lstatSync(item).isFile())) {
      throw new Error('Demo state cannot share linked files');
    }
  }
  return target;
}

export function demoEnvironment(root, state, inherited = process.env) {
  const target = assertDemoDirectory(root, state);
  // Explicitly blank configured keys: dotenv otherwise fills absent keys from live .env files.
  const env = Object.fromEntries(Object.keys(inherited).map((key) => [key, '']));
  for (const dir of [root, path.join(root, 'Codebase/Backend'), path.join(root, 'Codebase/Frontend'), path.join(root, 'Codebase/FrontendNext')]) {
    for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) continue;
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) env[match[1]] = '';
    }
  }
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot']) if (inherited[key]) env[key] = inherited[key];
  return Object.assign(env, {
    NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '4311', SSL_PORT: '0',
    DB_PATH: path.join(target, 'demo.sqlite'), TEST_RESULTS_DIR: path.join(target, 'outputs'),
    SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '', AUTH_SUPABASE_SELF_HOSTED_URL: '', AUTH_SUPABASE_ANON_KEY: '',
    GEMINI_API_KEY: '', GOOGLE_API_KEY: '', ANTHROPIC_API_KEY: '', AI_PROVIDER: '',
    SEED_TEST_USERS: '0', ENABLE_PILOT_LOGIN: 'false', DEV_TEST_MODE: 'true',
    TEST_RUNNER_USE_DOCKER: '0', ENABLE_TEST_RUNNER: '0', NEOTERRITORY_ENABLE_SCRAPER: '0',
    AWS_BACKEND_ORIGIN: 'http://127.0.0.1:4311', CORS_ORIGIN: 'http://127.0.0.1:4310',
    FRONTEND_ORIGIN: 'http://127.0.0.1:4310', PUBLIC_BASE_URL: 'http://127.0.0.1:4310',
    NEXT_TELEMETRY_DISABLED: '1', AVP_STATE_DIR: target,
    NEOTERRITORY_CATALOG: path.join(root, 'Codebase/Microservice/pattern_catalog'),
  });
}
