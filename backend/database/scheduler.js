import cron from 'node-cron';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { backupDatabase } from './backup.js';
import { runCleanup } from './cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCK_DIR = join(__dirname, 'backups');
const LOCK_FILE = join(LOCK_DIR, '.scheduler.lock');

const acquireLock = (jobName) => {
  if (!fs.existsSync(LOCK_DIR)) {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  }
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      const ageMinutes = (Date.now() - new Date(lockData.started).getTime()) / 60000;
      if (ageMinutes < 30) {
        console.log(`[scheduler] Skipping ${jobName}: ${lockData.job} is still running (${ageMinutes.toFixed(0)}m)`);
        return false;
      }
      console.log(`[scheduler] Stale lock from ${lockData.job} (${ageMinutes.toFixed(0)}m old), overriding`);
    } catch {
      // corrupt lock file, override
    }
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ job: jobName, started: new Date().toISOString() }));
  return true;
};

const releaseLock = () => {
  try { fs.unlinkSync(LOCK_FILE); } catch { /* already gone */ }
};

const runJob = async (jobName, fn) => {
  if (!acquireLock(jobName)) return;
  const start = Date.now();
  try {
    console.log(`[scheduler] Starting ${jobName}`);
    await fn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[scheduler] ${jobName} completed in ${elapsed}s`);
  } catch (err) {
    console.error(`[scheduler] ${jobName} FAILED:`, err.message);
  } finally {
    releaseLock();
  }
};

const startScheduler = () => {
  const scheduleEnabled = (process.env.SCHEDULER_ENABLED || 'true') !== 'false';
  if (!scheduleEnabled) {
    console.log('[scheduler] Disabled via SCHEDULER_ENABLED=false');
    return;
  }

  // Daily backup at 2:00 AM
  cron.schedule(process.env.DAILY_BACKUP_CRON || '0 2 * * *', () => {
    runJob('daily-backup', () => backupDatabase('daily'));
  });

  // Weekly backup every Sunday at 3:00 AM
  cron.schedule(process.env.WEEKLY_BACKUP_CRON || '0 3 * * 0', () => {
    runJob('weekly-backup', () => backupDatabase('weekly'));
  });

  // Cleanup is available manually via: npm run cleanup:daily / cleanup:weekly
  // Automatic cleanup is disabled — all logs and orders are kept forever.
  // Enable by setting CLEANUP_ENABLED=true in .env if the database gets too large.
  const cleanupEnabled = process.env.CLEANUP_ENABLED === 'true';
  if (cleanupEnabled) {
    cron.schedule(process.env.DAILY_CLEANUP_CRON || '0 4 * * *', () => {
      runJob('daily-cleanup', () => runCleanup({ dryRun: false, type: 'daily' }));
    });
    cron.schedule(process.env.WEEKLY_CLEANUP_CRON || '0 5 * * 0', () => {
      runJob('weekly-cleanup', () => runCleanup({ dryRun: false, type: 'weekly' }));
    });
  }

  console.log('[scheduler] Jobs scheduled:');
  console.log('  Daily backup:  2:00 AM');
  console.log('  Weekly backup: Sunday 3:00 AM');
  console.log(`  Cleanup:       ${cleanupEnabled ? 'ENABLED (daily 4AM, weekly Sunday 5AM)' : 'OFF (run manually if needed)'}`);
};

export { startScheduler };
export default startScheduler;
