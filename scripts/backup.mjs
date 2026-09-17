#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackup, pruneBackups } from '../server/backup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.MUSEUM_DATA_DIR || path.join(root, 'server', 'data');
const backupRoot = process.argv[2] || process.env.MUSEUM_BACKUP_DIR || path.join(root, 'backups');

try {
  const destination = await createBackup({ dataDir, backupRoot });
  console.log(`Backup created at ${destination}`);
  const keep = Number(process.env.MUSEUM_BACKUP_KEEP || 14);
  const removed = await pruneBackups({ backupRoot, keep });
  if (removed.length) console.log(`Removed ${removed.length} old backup(s)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
