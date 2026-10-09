import path from 'node:path';
import { createServer } from '../Frontend/node_modules/vite/dist/node/index.js';
import { ROOT } from './config.mjs';

if (!process.env.AVP_STATE_DIR || process.env.AWS_BACKEND_ORIGIN !== 'http://127.0.0.1:4311') {
  throw new Error('Start the frontend through the isolated AVP launcher');
}
const proxy = Object.fromEntries(['/api', '/auth', '/health'].map((route) => [route, 'http://127.0.0.1:4311']));
const server = await createServer({
  root: path.join(ROOT, 'Codebase/Frontend'),
  envDir: path.join(process.env.AVP_STATE_DIR, 'frontend-env'),
  cacheDir: path.join(process.env.AVP_STATE_DIR, 'vite-cache'),
  server: { host: '127.0.0.1', port: 4310, strictPort: true, proxy, hmr: false },
});
await server.listen();
console.log('AVP frontend ready at http://127.0.0.1:4310');
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await server.close(); process.exit(0); });
