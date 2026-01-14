import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const removeTouriya = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('🧹 Removing duplicate Touriya user...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Find Touriya user
      db.get('SELECT * FROM users WHERE LOWER(username) = ?', ['touriya'], (err, row) => {
        if (err) {
          console.error('Error finding Touriya:', err.message);
          db.close();
          reject(err);
          return;
        }

        if (!row) {
          console.log('✅ No Touriya user found - nothing to remove');
          db.close();
          resolvePromise();
          return;
        }

        console.log(`Found Touriya user with ID: ${row.user_id}`);

        // Delete Touriya user
        db.run('DELETE FROM users WHERE LOWER(username) = ?', ['touriya'], function(err) {
          if (err) {
            console.error('Error deleting Touriya:', err.message);
            db.close();
            reject(err);
            return;
          }

          console.log(`✅ Removed Touriya user (${this.changes} row(s) deleted)`);
          console.log('✅ Only Touria remains in the system');

          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
            } else {
              resolvePromise();
            }
          });
        });
      });
    });
  });
};

// Run if this file is executed directly
if (isDirectRun) {
  removeTouriya()
    .then(() => {
      console.log('✅ Cleanup finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export default removeTouriya;

