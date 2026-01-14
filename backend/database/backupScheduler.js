import backupDatabase from './backup.js';

// Run backups every 24 hours
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

console.log('Backup scheduler started');
console.log(`Next backup will run in ${BACKUP_INTERVAL / (60 * 60 * 1000)} hours`);

// Create a backup right away when the scheduler starts
backupDatabase()
  .then(() => {
    console.log('Initial backup completed');
  })
  .catch(err => {
    console.error('Initial backup failed:', err);
  });

// Set up automatic backups every 24 hours
setInterval(() => {
  console.log('Running scheduled backup...');
  backupDatabase()
    .then(() => {
      console.log('Scheduled backup completed');
    })
    .catch(err => {
      console.error('Scheduled backup failed:', err);
    });
}, BACKUP_INTERVAL);

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nBackup scheduler stopped');
  process.exit(0);
});

