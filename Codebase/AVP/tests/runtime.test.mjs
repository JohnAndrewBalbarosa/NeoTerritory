import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

const runtime = await import('../runtime.mjs').catch(() => ({}));

test('demo refuses to reuse an occupied port and cannot attach capture to another service', async () => {
  assert.equal(typeof runtime.assertPortFree, 'function');
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await assert.rejects(runtime.assertPortFree(server.address().port), /occupied|in use/); }
  finally { await new Promise((resolve) => server.close(resolve)); }
});

test('demo can reserve a free loopback port', async () => {
  assert.equal(typeof runtime.assertPortFree, 'function');
  await runtime.assertPortFree(0);
});
