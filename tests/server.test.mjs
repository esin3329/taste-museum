import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../server/index.mjs';
import { createBackup, pruneBackups, restoreBackup } from '../server/backup.mjs';

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
    const created = await response.json();
    const moved = await fetch(`${first.base}/api/items/${created.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: 2 }),
    });
    assert.equal(moved.status, 200);
    assert.equal((await moved.json()).item.room, 2);
  } finally {
    await stop(first.server);
  }
  const second = createServer({ dataDir, clientDir: first.root + '/client' });
  await new Promise((resolve) => second.listen(0, '127.0.0.1', resolve));
  try {
    const result = await (await fetch(`http://127.0.0.1:${second.address().port}/api/items`)).json();
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].title, '비 오는 날');
    assert.equal(result.items[0].room, 2);
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

test('updates editable fields and clears a room when null is supplied', async () => {
  const instance = await runningServer();
  try {
    const createdResponse = await fetch(`${instance.base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '초안', kind: 'text', text: '처음 문장', note: '초기 메모', room: 2 }),
    });
    const created = await createdResponse.json();
    const updatedResponse = await fetch(`${instance.base}/api/items/${created.item.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '고친 제목', text: '고친 문장', note: '고친 메모', room: null }),
    });
    assert.equal(updatedResponse.status, 200);
    assert.deepEqual((await updatedResponse.json()).item, {
      id: created.item.id,
      title: '고친 제목',
      kind: 'text',
      note: '고친 메모',
      room: null,
      text: '고친 문장',
    });
  } finally {
    await stop(instance.server);
  }
});

test('deletes a persisted item and its uploaded file', async () => {
  const instance = await runningServer();
  try {
    const form = new FormData();
    form.append('title', '지울 사진');
    form.append('file', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'remove.png');
    const uploadResponse = await fetch(`${instance.base}/api/upload`, { method: 'POST', body: form });
    const uploaded = await uploadResponse.json();
    const imagePath = uploaded.item.image;

    const deleteResponse = await fetch(`${instance.base}/api/items/${uploaded.item.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.equal((await deleteResponse.json()).item.id, uploaded.item.id);
    assert.deepEqual(await (await fetch(`${instance.base}/api/items`)).json(), { items: [] });
    assert.equal((await fetch(`${instance.base}${imagePath}`)).status, 404);
  } finally {
    await stop(instance.server);
  }
});

test('replaces an uploaded photo and removes the previous file', async () => {
  const instance = await runningServer();
  try {
    const first = new FormData();
    first.append('title', '첫 사진');
    first.append('file', new Blob([Buffer.from('first-png')], { type: 'image/png' }), 'first.png');
    const created = await (await fetch(`${instance.base}/api/upload`, { method: 'POST', body: first })).json();

    const replacement = new FormData();
    replacement.append('title', '바꾼 사진');
    replacement.append('note', '새 기록');
    replacement.append('room', '3');
    replacement.append('file', new Blob([Buffer.from('second-png')], { type: 'image/png' }), 'second.png');
    const response = await fetch(`${instance.base}/api/items/${created.item.id}/upload`, { method: 'POST', body: replacement });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.item.title, '바꾼 사진');
    assert.equal(payload.item.room, 3);
    assert.notEqual(payload.item.image, created.item.image);
    assert.equal((await fetch(`${instance.base}${created.item.image}`)).status, 404);
    assert.equal((await fetch(`${instance.base}${payload.item.image}`)).status, 200);
    const unplaced = new FormData();
    unplaced.append('title', '수집함 사진');
    unplaced.append('room', 'null');
    unplaced.append('file', new Blob([Buffer.from('third-png')], { type: 'image/png' }), 'third.png');
    const unplacedResponse = await fetch(`${instance.base}/api/items/${created.item.id}/upload`, { method: 'POST', body: unplaced });
    assert.equal((await unplacedResponse.json()).item.room, null);
  } finally {
    await stop(instance.server);
  }
});

test('backs up the database and uploaded files into a timestamped folder', async () => {
  const instance = await runningServer();
  try {
    const form = new FormData();
    form.append('title', '백업할 사진');
    form.append('file', new Blob([Buffer.from('backup-png')], { type: 'image/png' }), 'backup.png');
    await fetch(`${instance.base}/api/upload`, { method: 'POST', body: form });
  } finally {
    await stop(instance.server);
  }
  const backupRoot = path.join(instance.root, 'backups');
  const backupDir = await createBackup({ dataDir: path.join(instance.root, 'data'), backupRoot, now: new Date('2026-09-17T12:34:56.000Z') });
  assert.equal(path.basename(backupDir), '2026-09-17T12-34-56-000Z');
  await access(path.join(backupDir, 'museum.sqlite'));
  await access(path.join(backupDir, 'uploads'));
  assert.match(await readFile(path.join(backupDir, 'manifest.json'), 'utf8'), /2026-09-17T12:34:56.000Z/);
  assert.equal((await readdir(path.join(backupDir, 'uploads'))).length, 1);
});

test('prunes timestamped backups beyond the retention count', async () => {
  const instance = await runningServer();
  await stop(instance.server);
  const dataDir = path.join(instance.root, 'data');
  const backupRoot = path.join(instance.root, 'backups');
  const dates = [1, 2, 3].map((day) => new Date(`2026-09-${String(day).padStart(2, '0')}T12:34:56.000Z`));
  for (const now of dates) await createBackup({ dataDir, backupRoot, now });
  const removed = await pruneBackups({ backupRoot, keep: 2 });
  assert.equal(removed.length, 1);
  await access(path.join(backupRoot, '2026-09-03T12-34-56-000Z', 'museum.sqlite'));
  await assert.rejects(access(path.join(backupRoot, '2026-09-01T12-34-56-000Z')));
});

test('restores a backup into a data directory and preserves the old directory with force', async () => {
  const instance = await runningServer();
  let backupDir;
  try {
    const response = await fetch(`${instance.base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '복원할 문장', kind: 'text', text: '남겨 둔 기록', room: null }),
    });
    assert.equal(response.status, 201);
    await stop(instance.server);
    backupDir = await createBackup({ dataDir: path.join(instance.root, 'data'), backupRoot: path.join(instance.root, 'backups'), now: new Date('2026-09-17T12:34:56.000Z') });
  } catch (error) {
    await stop(instance.server).catch(() => {});
    throw error;
  }
  const target = path.join(instance.root, 'restored-data');
  await restoreBackup({ backupDir, dataDir: target });
  const restored = createServer({ dataDir: target, clientDir: path.join(instance.root, 'client') });
  await new Promise((resolve) => restored.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal((await (await fetch(`http://127.0.0.1:${restored.address().port}/api/items`)).json()).items[0].title, '복원할 문장');
  } finally {
    await stop(restored);
  }
  await writeFile(path.join(target, 'marker.txt'), 'current data');
  const rotated = await restoreBackup({ backupDir, dataDir: target, force: true });
  assert.equal(rotated.dataDir, target);
  await access(path.join(rotated.previousDataDir, 'marker.txt'));
});
