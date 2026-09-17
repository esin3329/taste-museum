import { cp, access, mkdir, rename, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function folderName(date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function createBackup({ dataDir, backupRoot, now = new Date() }) {
  const source = path.resolve(dataDir);
  const root = path.resolve(backupRoot);
  const database = path.join(source, 'museum.sqlite');
  if (!(await exists(database))) throw new Error(`database not found: ${database}`);
  await mkdir(root, { recursive: true });
  const destination = path.join(root, folderName(now));
  if (await exists(destination)) throw new Error(`backup already exists: ${destination}`);
  await mkdir(destination);

  const db = new DatabaseSync(database);
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally {
    db.close();
  }
  await cp(database, path.join(destination, 'museum.sqlite'));
  const uploads = path.join(source, 'uploads');
  if (await exists(uploads)) await cp(uploads, path.join(destination, 'uploads'), { recursive: true });
  else await mkdir(path.join(destination, 'uploads'));
  const manifest = {
    format: 1,
    createdAt: now.toISOString(),
    source: path.basename(source),
  };
  await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return destination;
}

export async function pruneBackups({ backupRoot, keep = 14 }) {
  const count = Number(keep);
  if (!Number.isInteger(count) || count < 1) throw new Error('backup retention must be a positive integer');
  const root = path.resolve(backupRoot);
  if (!(await exists(root))) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name)).map((entry) => entry.name).sort().reverse();
  const removed = [];
  for (const name of folders.slice(count)) {
    const destination = path.join(root, name);
    await rm(destination, { recursive: true, force: true });
    removed.push(destination);
  }
  return removed;
}

export async function restoreBackup({ backupDir, dataDir, force = false, now = new Date() }) {
  const source = path.resolve(backupDir);
  const target = path.resolve(dataDir);
  const database = path.join(source, 'museum.sqlite');
  if (!(await exists(database))) throw new Error(`backup database not found: ${database}`);
  if (source === target) throw new Error('backup directory and data directory must be different');
  const targetExists = await exists(target);
  if (targetExists && !force) throw new Error(`data directory exists; pass --force to rotate it: ${target}`);

  let previousDataDir;
  if (targetExists) {
    previousDataDir = `${target}.before-restore-${folderName(now)}-${randomUUID().slice(0, 8)}`;
    await rename(target, previousDataDir);
  }
  try {
    await mkdir(target, { recursive: true });
    await cp(database, path.join(target, 'museum.sqlite'));
    const uploads = path.join(source, 'uploads');
    if (await exists(uploads)) await cp(uploads, path.join(target, 'uploads'), { recursive: true });
    else await mkdir(path.join(target, 'uploads'));
  } catch (error) {
    await rm(target, { recursive: true, force: true }).catch(() => {});
    if (previousDataDir) await rename(previousDataDir, target).catch(() => {});
    throw error;
  }
  return { dataDir: target, previousDataDir };
}
