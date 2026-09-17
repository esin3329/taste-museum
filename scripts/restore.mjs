#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreBackup } from '../server/backup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [backupDir, requestedDataDir, ...flags] = process.argv.slice(2);
const dataDir = requestedDataDir || process.env.MUSEUM_DATA_DIR || path.join(root, 'server', 'data');

if (!backupDir) {
  console.error('Usage: node scripts/restore.mjs <backup-directory> [data-directory] [--force]');
  process.exitCode = 1;
} else {
  try {
    const result = await restoreBackup({ backupDir, dataDir, force: flags.includes('--force') });
    console.log(`Restored to ${result.dataDir}`);
    if (result.previousDataDir) console.log(`Previous data kept at ${result.previousDataDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
