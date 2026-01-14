import sqlite3 from 'sqlite3';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'stock_management.db');
const backupDir = join(__dirname, 'backups');
const isDirectRun = process.argv[1] && process.argv[1].endsWith('backup.js');

// Remove backup files older than 30 days to save disk space
const cleanupOldBackups = () => {
  try {
    if (!fs.existsSync(backupDir)) return;

    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds

    files.forEach(file => {
      const filePath = join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning up old backups:', error.message);
  }
};

// Create a complete copy of the database for backup purposes
const backupDatabase = () => {
  return new Promise((resolve, reject) => {
    // Make sure the database file exists before trying to backup
    if (!fs.existsSync(dbPath)) {
      console.log('Database file not found, skipping backup');
      return resolve();
    }

    // Create the backups folder if it doesn't exist yet
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('Created backups directory');
    }

    // Create a unique filename with timestamp so we know when the backup was made
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = join(backupDir, `backup-${timestamp}.db`);

    console.log('Creating database backup...');

    const source = new sqlite3.Database(dbPath);
    const backup = new sqlite3.Database(backupPath);

    // Copy the entire database to the backup file
    source.backup(backup)
      .then(() => {
        const stats = fs.statSync(backupPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`Backup created successfully: ${backupPath}`);
        console.log(`Backup size: ${sizeInMB} MB`);
        
        // Remove old backups to save space
        cleanupOldBackups();
        
        resolve(backupPath);
      })
      .catch(err => {
        console.error('Backup failed:', err.message);
        reject(err);
      })
      .finally(() => {
        source.close();
        backup.close();
      });
  });
};

// If this script is run directly (not imported), run the backup immediately
if (isDirectRun) {
  backupDatabase()
    .then(() => {
      console.log('Backup process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backup process failed:', error);
      process.exit(1);
    });
}

export default backupDatabase;

