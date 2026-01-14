import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const clearStock = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('Clearing stock items (keeping product catalog)...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');

      // Delete audit logs related to stock items first
      db.run('DELETE FROM auditLogs', function(err) {
        if (err) {
          console.warn('Warning clearing auditLogs:', err.message);
        } else {
          console.log(`Cleared ${this.changes} audit log records`);
        }

        // Clear stockItems table (actual stock with quantities)
        // Set quantities to 0 instead of deleting to preserve item records
        db.run('UPDATE stockItems SET quantity = 0', function(err2) {
          if (err2) {
            console.error('Error clearing stockItems:', err2.message);
            db.close();
            reject(err2);
            return;
          }
          console.log(`Reset ${this.changes} stock items to quantity 0`);

          // Alternative: Delete all stock items (uncomment if preferred)
          // db.run('DELETE FROM stockItems', (err) => {
          //   if (err) {
          //     console.error('❌ Error clearing stockItems:', err.message);
          //     db.close();
          //     reject(err);
          //     return;
          // }
          // console.log('✅ Cleared table stockItems');
          // });

          // Reset auto-increment counter for stockItems
          db.run('DELETE FROM sqlite_sequence WHERE name = "stockItems"', (err3) => {
            if (err3) {
              console.warn('Warning resetting stockItems sequence:', err3.message);
            } else {
              console.log('Reset auto-increment counter for stockItems');
            }

            db.close((closeErr) => {
              if (closeErr) {
                reject(closeErr);
              } else {
                console.log('Stock items cleared (product catalog kept).');
                resolvePromise();
              }
            });
          });
        });
      });
    });
  });
};

// Run clear if this file is executed directly
if (isDirectRun) {
  clearStock()
    .then(() => {
      console.log('Clear stock finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Clear stock failed:', error);
      process.exit(1);
    });
}

export default clearStock;





