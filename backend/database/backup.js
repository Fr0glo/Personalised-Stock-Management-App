import sqlite3 from 'sqlite3';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, 'stock_management.db');
const BACKUP_DIR = process.env.BACKUP_DIR || join(__dirname, 'backups');
const DAILY_RETENTION = parseInt(process.env.DAILY_BACKUP_RETENTION || '7', 10);
const WEEKLY_RETENTION = parseInt(process.env.WEEKLY_BACKUP_RETENTION || '4', 10);

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

const compressFile = async (sourcePath, destPath) => {
  await pipeline(
    createReadStream(sourcePath),
    createGzip({ level: 6 }),
    createWriteStream(destPath)
  );
  fs.unlinkSync(sourcePath);
};

const backupDatabase = async (type = 'daily') => {
  if (!fs.existsSync(DB_PATH)) {
    console.log('Database file not found, skipping backup');
    return null;
  }

  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const rawPath = join(BACKUP_DIR, `backup-${type}-${timestamp}.db`);
  const compressedPath = `${rawPath}.gz`;

  console.log(`Creating ${type} backup...`);

  // Use SQLite's VACUUM INTO for a consistent backup (safer than file copy
  // because it waits for any in-progress writes to finish)
  const source = new sqlite3.Database(DB_PATH);
  try {
    await new Promise((resolve, reject) => {
      source.run(`VACUUM INTO ?`, [rawPath], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    await new Promise(r => source.close(r));
  }

  await compressFile(rawPath, compressedPath);

  const stats = fs.statSync(compressedPath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  console.log(`Backup created: ${compressedPath} (${sizeKB} KB)`);

  pruneBackups(type);

  return compressedPath;
};

const pruneBackups = (type) => {
  const retention = type === 'weekly' ? WEEKLY_RETENTION : DAILY_RETENTION;
  const prefix = `backup-${type}-`;

  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix))
    .sort()
    .reverse();

  const toDelete = files.slice(retention);
  toDelete.forEach(file => {
    const filePath = join(BACKUP_DIR, file);
    fs.unlinkSync(filePath);
    console.log(`Pruned old backup: ${file}`);
  });
};

const restoreDatabase = async (backupPath, targetPath) => {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  if (backupPath.endsWith('.gz')) {
    const { createGunzip } = await import('zlib');
    const tempPath = targetPath + '.restoring';
    await pipeline(
      createReadStream(backupPath),
      createGunzip(),
      createWriteStream(tempPath)
    );
    fs.renameSync(tempPath, targetPath);
  } else {
    fs.copyFileSync(backupPath, targetPath);
  }

  const db = new sqlite3.Database(targetPath);
  const result = await new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  await new Promise(r => db.close(r));

  console.log(`Restore verified: ${result.count} users found in restored database`);
  return result;
};

const listBackups = () => {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();

  return files.map(file => {
    const stats = fs.statSync(join(BACKUP_DIR, file));
    const type = file.includes('-weekly-') ? 'weekly' : 'daily';
    return {
      file,
      type,
      size: stats.size,
      date: stats.mtime
    };
  });
};

const isDirectRun = process.argv[1] && process.argv[1].endsWith('backup.js');
if (isDirectRun) {
  const type = process.argv[2] === 'weekly' ? 'weekly' : 'daily';
  const action = process.argv[2];

  if (action === 'list') {
    const backups = listBackups();
    console.log(`\n=== ${backups.length} backups ===`);
    backups.forEach(b => {
      const sizeKB = (b.size / 1024).toFixed(1);
      console.log(`  [${b.type}] ${b.file} (${sizeKB} KB) - ${b.date.toISOString()}`);
    });
    process.exit(0);
  }

  if (action === 'restore') {
    const backupFile = process.argv[3];
    const targetFile = process.argv[4] || join(__dirname, 'stock_management_restored.db');
    if (!backupFile) {
      console.error('Usage: node backup.js restore <backup-file> [target-path]');
      process.exit(1);
    }
    const fullPath = backupFile.startsWith('/') || backupFile.startsWith('C:')
      ? backupFile
      : join(BACKUP_DIR, backupFile);
    restoreDatabase(fullPath, targetFile)
      .then(() => {
        console.log(`Restored to: ${targetFile}`);
        process.exit(0);
      })
      .catch(err => {
        console.error('Restore failed:', err.message);
        process.exit(1);
      });
  } else {
    backupDatabase(type)
      .then(() => {
        console.log(`${type} backup completed successfully`);
        process.exit(0);
      })
      .catch(err => {
        console.error('Backup failed:', err.message);
        process.exit(1);
      });
  }
}

export { backupDatabase, restoreDatabase, listBackups, pruneBackups };
export default backupDatabase;
