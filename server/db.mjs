import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const KINDS = new Set(['photo', 'text', 'link']);
const ROOMS = new Set([1, 2, 3, 4]);

function normalRoom(value) {
  if (value === null || value === undefined || value === '' || value === 'null') return null;
  const room = Number(value);
  if (!Number.isInteger(room) || !ROOMS.has(room)) throw new Error('room must be between 1 and 4');
  return room;
}

function cleanItem(row) {
  const item = {
    id: row.id,
    title: row.title,
    kind: row.kind,
    note: row.note ?? '',
    room: row.room === null ? null : Number(row.room),
  };
  if (row.image) item.image = row.image;
  if (row.text) item.text = row.text;
  if (row.url) item.url = row.url;
  return item;
}

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'museum.sqlite'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('photo', 'text', 'link')),
      note TEXT NOT NULL DEFAULT '',
      room INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      image TEXT,
      text TEXT,
      url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS items_room_order ON items(room, sort_order, created_at);
  `);
  const roomSeed = db.prepare(`INSERT OR IGNORE INTO rooms (id, name, description, image, sort_order) VALUES (?, ?, ?, ?, ?)`);
  [
    [1, '고요한 순간들', '사진과 음악, 문장으로 모은 고요한 취향', 'quiet-door.png', 1],
    [2, '언젠가의 공간', '언젠가 머물고 싶은 공간을 모았습니다.', 'lobby.png', 2],
    [3, '오래 곁에 둔 것들', '물건에 남은 시간과 기억을 모았습니다.', 'highlight.png', 3],
    [4, '아직 이름 없는 취향', '이유를 몰라도 좋아하는 마음부터.', 'album.png', 4],
  ].forEach((room) => roomSeed.run(...room));

  const list = db.prepare('SELECT id, title, kind, note, room, image, text, url FROM items ORDER BY room IS NULL, room, sort_order, created_at');
  const get = db.prepare('SELECT id, title, kind, note, room, image, text, url FROM items WHERE id = ?');
  const insert = db.prepare(`INSERT INTO items (id, title, kind, note, room, image, text, url, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM items WHERE room IS ?), 0), ?, ?)`);
  const remove = db.prepare('DELETE FROM items WHERE id = ?');

  function normalize(input) {
    const kind = String(input.kind || '');
    if (!KINDS.has(kind)) throw new Error('kind must be photo, text, or link');
    const title = String(input.title || '').trim();
    if (!title || title.length > 200) throw new Error('title is required and must be at most 200 characters');
    const note = String(input.note || '').trim().slice(0, 4000);
    const room = normalRoom(input.room);
    const text = input.text ? String(input.text).slice(0, 10000) : null;
    const url = input.url ? String(input.url).trim() : null;
    const image = input.image ? String(input.image) : null;
    if (image && !image.startsWith('/museum/') && !image.startsWith('/uploads/')) throw new Error('invalid image path');
    if (kind === 'link' && (!url || !/^https?:\/\//i.test(url))) throw new Error('url must start with http:// or https://');
    if (kind === 'text' && !text?.trim()) throw new Error('text is required');
    return { title, kind, note, room, text, url, image };
  }

  return {
    listItems: () => list.all().map(cleanItem),
    getItem: (id) => {
      const row = get.get(id);
      return row ? cleanItem(row) : null;
    },
    insertItem: (input) => {
      const value = normalize(input);
      const id = input.id || crypto.randomUUID();
      const now = new Date().toISOString();
      insert.run(id, value.title, value.kind, value.note, value.room, value.image, value.text, value.url, value.room, now, now);
      return cleanItem(get.get(id));
    },
    updateItem: (id, input) => {
      const existing = get.get(id);
      if (!existing) return null;
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(input, 'title')) {
        const title = String(input.title ?? '').trim();
        if (!title || title.length > 200) throw new Error('invalid title');
        patch.title = title;
      }
      if (Object.prototype.hasOwnProperty.call(input, 'note')) {
        patch.note = String(input.note ?? '').trim().slice(0, 4000);
      }
      if (Object.prototype.hasOwnProperty.call(input, 'room')) patch.room = normalRoom(input.room);
      if (Object.prototype.hasOwnProperty.call(input, 'text')) {
        const text = input.text === null ? null : String(input.text).slice(0, 10000);
        patch.text = text && text.trim() ? text : null;
      }
      if (Object.prototype.hasOwnProperty.call(input, 'url')) {
        const url = input.url === null || input.url === '' ? null : String(input.url).trim();
        if (url && !/^https?:\/\//i.test(url)) throw new Error('url must start with http:// or https://');
        patch.url = url;
      }
      if (Object.prototype.hasOwnProperty.call(input, 'image')) {
        const image = input.image === null || input.image === '' ? null : String(input.image);
        if (image && !image.startsWith('/museum/') && !image.startsWith('/uploads/')) throw new Error('invalid image path');
        patch.image = image;
      }
      const nextText = Object.prototype.hasOwnProperty.call(patch, 'text') ? patch.text : existing.text;
      const nextUrl = Object.prototype.hasOwnProperty.call(patch, 'url') ? patch.url : existing.url;
      if (existing.kind === 'text' && !nextText?.trim()) throw new Error('text is required');
      if (existing.kind === 'link' && (!nextUrl || !/^https?:\/\//i.test(nextUrl))) throw new Error('url must start with http:// or https://');
      const fields = Object.keys(patch);
      if (fields.length) {
        const values = fields.map((field) => patch[field]);
        const assignments = fields.map((field) => `${field} = ?`).join(', ');
        values.push(new Date().toISOString(), id);
        db.prepare(`UPDATE items SET ${assignments}, updated_at = ? WHERE id = ?`).run(...values);
      }
      return cleanItem(get.get(id));
    },
    deleteItem: (id) => {
      const existing = get.get(id);
      if (!existing) return null;
      remove.run(id);
      return cleanItem(existing);
    },
    close: () => db.close(),
  };
}
