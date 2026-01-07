import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const fixVoucherUsers = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('🔧 Fixing voucher user references...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Get valid user IDs
      db.all('SELECT user_id, username FROM users', (err, users) => {
        if (err) {
          console.error('Error fetching users:', err.message);
          db.close();
          reject(err);
          return;
        }

        if (users.length === 0) {
          console.log('No users found in database');
          db.close();
          resolvePromise();
          return;
        }

        // Get rachida's user_id as default
        const rachidaUser = users.find(u => u.username.toLowerCase() === 'rachida');
        const defaultUserId = rachidaUser ? rachidaUser.user_id : users[0].user_id;

        console.log(`Using user_id ${defaultUserId} as default for old vouchers`);

        // Update entry vouchers with invalid user IDs
        db.run(
          `UPDATE entryVouchers 
           SET added_by = ? 
           WHERE added_by NOT IN (SELECT user_id FROM users)`,
          [defaultUserId],
          function(err) {
            if (err) {
              console.error('Error updating entry vouchers:', err.message);
            } else {
              console.log(`✅ Updated ${this.changes} entry vouchers`);
            }

            // Update exit vouchers with invalid user IDs
            db.run(
              `UPDATE exitVouchers 
               SET handled_by = ? 
               WHERE handled_by NOT IN (SELECT user_id FROM users)`,
              [defaultUserId],
              function(err2) {
                if (err2) {
                  console.error('Error updating exit vouchers:', err2.message);
                } else {
                  console.log(`✅ Updated ${this.changes} exit vouchers`);
                }

                db.close((closeErr) => {
                  if (closeErr) {
                    reject(closeErr);
                  } else {
                    console.log('🎉 Voucher user references fixed!');
                    resolvePromise();
                  }
                });
              }
            );
          }
        );
      });
    });
  });
};

// Run if this file is executed directly
if (isDirectRun) {
  fixVoucherUsers()
    .then(() => {
      console.log('✅ Fix voucher users finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix voucher users failed:', error);
      process.exit(1);
    });
}

export default fixVoucherUsers;



