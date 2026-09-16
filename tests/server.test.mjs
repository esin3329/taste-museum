import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../server/index.mjs';

async function runningServer() {
  const root = await mkdtemp(path.join(tmpdir(), 'taste-museum-'));
  const clientDir = path.join(root, 'client');
  await mkdir(clientDir, { recursive: true });
  await writeFile(path.join(clientDir, 'index.html'), '<!doctype html><title>Museum</title>');
  const server = createServer({ dataDir: path.join(root, 'data'), clientDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, root, base: `http://127.0.0.1:${address.port}` };
}

async function stop(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('starts with demo-free persisted collection and serves the app shell', async () => {
  const first = await runningServer();
  try {
    const items = await (await fetch(`${first.base}/api/items`)).json();
    assert.deepEqual(items, { items: [] });
    const shell = await (await fetch(`${first.base}/anything`, { headers: { accept: 'text/html' } })).text();
    assert.match(shell, /Museum/);
  } finally {
    await stop(first.server);
  }
});

test('persists a text item across server instances', async () => {
  const first = await runningServer();
  const dataDir = first.root + '/data';
  try {
    const response = await fetch(`${first.base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '비 오는 날', kind: 'text', text: '천천히 걷기', note: '기억', room: null }),
    });
    assert.equal(response.status, 201);
  } finally {
    await stop(first.server);
  }
  const second = createServer({ dataDir, clientDir: first.root + '/client' });
  await new Promise((resolve) => second.listen(0, '127.0.0.1', resolve));
  try {
    const result = await (await fetch(`http://127.0.0.1:${second.address().port}/api/items`)).json();
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, '비 오는 날');
  } finally {
    await stop(second);
  }
});

test('uploads an image and returns a generated server path', async () => {
  const instance = await runningServer();
  try {
    const form = new FormData();
    form.append('title', '업로드한 사진');
    form.append('note', '폰에서 보낸 기록');
    form.append('room', '2');
    form.append('file', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'my photo.png');
    const response = await fetch(`${instance.base}/api/upload`, { method: 'POST', body: form });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.item.title, '업로드한 사진');
    assert.equal(payload.item.room, 2);
    assert.match(payload.item.image, /^\/uploads\/[a-f0-9-]+\.png$/);
    const stored = await readFile(path.join(instance.root, 'data', payload.item.image.replace('/uploads/', 'uploads/')));
    assert.equal(stored.toString(), 'fake-png');
    assert.equal((await fetch(`${instance.base}${payload.item.image}`)).status, 200);
    assert.equal((await fetch(`${instance.base}/museum/${payload.item.image.split('/').pop()}`)).status, 404);
  } finally {
    await stop(instance.server);
  }
});
