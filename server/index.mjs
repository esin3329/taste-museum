import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const MAX_UPLOAD = 25 * 1024 * 1024;

function send(res, status, body, headers = {}) {
  const data = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'content-length': data.length, ...headers });
  res.end(data);
}

async function bodyBuffer(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('request too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let offset = 0;
  while (true) {
    const start = buffer.indexOf(marker, offset);
    if (start < 0) break;
    const contentStart = start + marker.length;
    if (buffer.slice(contentStart, contentStart + 2).toString() === '--') break;
    const partStart = contentStart + 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd < 0) break;
    const headers = buffer.slice(partStart, headerEnd).toString('utf8');
    const next = buffer.indexOf(marker, headerEnd + 4);
    if (next < 0) break;
    const data = buffer.slice(headerEnd + 4, next - 2);
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
    const name = disposition.match(/name="([^"]+)"/i)?.[1];
    const filename = disposition.match(/filename="([^"]*)"/i)?.[1];
    if (name) parts.push({ name, filename, contentType: headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '', data });
    offset = next;
  }
  return parts;
}

function safeUploadPath(dataDir, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/uploads\//, '');
  const uploadRoot = path.resolve(dataDir, 'uploads');
  const file = path.resolve(uploadRoot, relative);
  return file.startsWith(uploadRoot + path.sep) ? file : null;
}

function extensionFor(type, filename) {
  const known = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif' };
  return known[type.toLowerCase()] || (path.extname(filename || '').toLowerCase().match(/^\.(jpg|jpeg|png|gif|webp|heic|heif)$/)?.[0] || '');
}

export function createServer({ dataDir = process.env.MUSEUM_DATA_DIR || path.join(root, 'server', 'data'), clientDir = path.join(root, 'dist', 'client') } = {}) {
  const db = openDatabase(dataDir);
  const uploadDir = path.join(dataDir, 'uploads');
  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
      if (url.pathname === '/api/items' && req.method === 'GET') return send(res, 200, { items: db.listItems() });
      if (url.pathname === '/api/items' && req.method === 'POST') {
        const input = JSON.parse((await bodyBuffer(req, 1024 * 1024)).toString('utf8'));
        return send(res, 201, { item: db.insertItem(input) });
      }
      const itemMatch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
      if (itemMatch && req.method === 'PATCH') {
        const item = db.updateItem(decodeURIComponent(itemMatch[1]), JSON.parse((await bodyBuffer(req, 1024 * 1024)).toString('utf8')));
        return item ? send(res, 200, { item }) : send(res, 404, { error: 'item not found' });
      }
      if (url.pathname === '/api/upload' && req.method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
        if (!boundary) return send(res, 400, { error: 'multipart boundary is required' });
        const parts = parseMultipart(await bodyBuffer(req, MAX_UPLOAD), boundary);
        const file = parts.find((part) => part.filename !== undefined && part.name === 'file');
        if (!file || !file.data.length || !file.contentType.toLowerCase().startsWith('image/')) return send(res, 400, { error: 'an image file is required' });
        const extension = extensionFor(file.contentType, file.filename);
        if (!extension) return send(res, 415, { error: 'unsupported image type' });
        await mkdir(uploadDir, { recursive: true });
        const id = crypto.randomUUID();
        const relative = `/uploads/${id}${extension}`;
        const target = path.join(uploadDir, `${id}${extension}`);
        await writeFile(target, file.data, { flag: 'wx' });
        try {
          const fields = Object.fromEntries(parts.filter((part) => part.filename === undefined).map((part) => [part.name, part.data.toString('utf8')]));
          const item = db.insertItem({ id, kind: 'photo', title: fields.title || '이름 없는 사진', note: fields.note || '', room: fields.room || null, image: relative });
          return send(res, 201, { item });
        } catch (error) {
          await unlink(target).catch(() => {});
          throw error;
        }
      }
      if (url.pathname.startsWith('/uploads/')) {
        if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'method not allowed' });
        const filePath = safeUploadPath(dataDir, url.pathname);
        if (!filePath || !existsSync(filePath)) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(filePath).pipe(res);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 404, { error: 'not found' });
      const candidate = path.resolve(clientDir, `.${decodeURIComponent(url.pathname)}`);
      const clientRoot = path.resolve(clientDir);
      const filePath = candidate.startsWith(clientRoot + path.sep) && existsSync(candidate) ? candidate : (url.pathname === '/' || req.headers.accept?.includes('text/html') ? path.join(clientRoot, 'index.html') : null);
      if (!filePath || !existsSync(filePath)) return send(res, 404, { error: 'not found' });
      const content = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'content-length': content.length });
      return req.method === 'HEAD' ? res.end() : res.end(content);
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : 500);
      return send(res, status, { error: status === 500 ? 'internal server error' : error.message });
    }
  });
  const originalClose = server.close.bind(server);
  server.close = (callback) => originalClose((error) => { db.close(); callback?.(error); });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  const server = createServer();
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Taste Museum listening on http://${process.env.HOST || '127.0.0.1'}:${port}`));
}
