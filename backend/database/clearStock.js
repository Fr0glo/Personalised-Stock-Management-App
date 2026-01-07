import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const clearStock = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('🧨 Clearing stock items (keeping product catalog)...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Clear stockItems table (actual stock with quantities)
      db.run('DELETE FROM stockItems', (err) => {
        if (err) {
          console.error('❌ Error clearing stockItems:', err.message);
          db.close();
          reject(err);
          return;
        }
        console.log('✅ Cleared table stockItems');
      });

      // Reset auto-increment counter for stockItems
      db.run('DELETE FROM sqlite_sequence WHERE name = "stockItems"', (err) => {
        if (err) {
          console.error('❌ Error resetting stockItems sequence:', err.message);
        } else {
          console.log('✅ Reset auto-increment counter for stockItems');
        }

        db.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
          } else {
            console.log('🎉 Stock items cleared (product catalog kept).');
            resolvePromise();
          }
        });
      });
    });
  });
};

// Run clear if this file is executed directly
if (isDirectRun) {
  clearStock()
    .then(() => {
      console.log('✅ Clear stock finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Clear stock failed:', error);
      process.exit(1);
    });
}

export default clearStock;



