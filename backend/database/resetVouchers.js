import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const resetVouchers = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('Resetting all vouchers (bons)...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');

      // Delete entry details first (due to foreign key constraints)
      db.run('DELETE FROM entryDetails', function(err) {
        if (err) {
          console.error('Error deleting entryDetails:', err.message);
          db.close();
          reject(err);
          return;
        }
        console.log(`Deleted ${this.changes} entry detail records`);

        // Delete exit details
        db.run('DELETE FROM exitDetails', function(err2) {
          if (err2) {
            console.error('Error deleting exitDetails:', err2.message);
            db.close();
            reject(err2);
            return;
          }
          console.log(`Deleted ${this.changes} exit detail records`);

          // Delete entry vouchers
          db.run('DELETE FROM entryVouchers', function(err3) {
            if (err3) {
              console.error('Error deleting entryVouchers:', err3.message);
              db.close();
              reject(err3);
              return;
            }
            console.log(`Deleted ${this.changes} entry voucher records`);

            // Delete exit vouchers
            db.run('DELETE FROM exitVouchers', function(err4) {
              if (err4) {
                console.error('Error deleting exitVouchers:', err4.message);
                db.close();
                reject(err4);
                return;
              }
              console.log(`Deleted ${this.changes} exit voucher records`);

              // Reset auto-increment counters
              db.run('DELETE FROM sqlite_sequence WHERE name IN ("entryVouchers", "exitVouchers", "entryDetails", "exitDetails")', function(err5) {
                if (err5) {
                  console.warn('Warning resetting sequences:', err5.message);
                } else {
                  console.log('Reset auto-increment counters for vouchers');
                }

                db.close((closeErr) => {
                  if (closeErr) {
                    reject(closeErr);
                  } else {
                    console.log('All vouchers reset successfully!');
                    resolvePromise();
                  }
                });
              });
            });
          });
        });
      });
    });
  });
};

// Run if this file is executed directly
if (isDirectRun) {
  resetVouchers()
    .then(() => {
      console.log('Reset vouchers finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Reset vouchers failed:', error);
      process.exit(1);
    });
}

export default resetVouchers;

