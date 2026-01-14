import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const seedLoginUsers = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('Seeding login users...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // First, add password column to users table if it doesn't exist
      db.run(`
        ALTER TABLE users ADD COLUMN password TEXT
      `, (err) => {
        // Ignore error if column already exists
        if (err && !err.message.includes('duplicate column')) {
          console.warn('Warning:', err.message);
        }
      });

      // Office staff users (normal access)
      const officeUsers = [
        { username: 'rachida', password: 'rachida123', role: 'admin' },
        { username: 'brahim', password: 'brahim123', role: 'admin' },
        { username: 'touria', password: 'touria123', role: 'admin' }
      ];

      officeUsers.forEach((user, index) => {
        db.run(
          `INSERT OR REPLACE INTO users (username, password, role) 
           VALUES (?, ?, ?)`,
          [user.username, user.password, user.role],
          function(err) {
            if (err) {
              console.error(`Error inserting ${user.username}:`, err.message);
            } else {
              console.log(`Added/Updated user: ${user.username}`);
            }

            if (index === officeUsers.length - 1) {
              // After office users, update workers for security access
              db.run(
                `UPDATE workers SET password = 'brahimbahessi123' 
                 WHERE LOWER(F_Name || ' ' || Surname) LIKE '%brahim%bahssi%' 
                 OR LOWER(F_Name || ' ' || Surname) LIKE '%brahim%bahessi%'`,
                function(err) {
                  if (err) {
                    console.warn('Warning updating brahim:', err.message);
                  } else {
                    console.log(`Updated Brahim Bahssi worker record`);
                  }

                  db.run(
                    `UPDATE workers SET password = 'mohamadbaadi123' 
                     WHERE LOWER(F_Name || ' ' || Surname) LIKE '%mohamad%baadi%' 
                     OR LOWER(F_Name || ' ' || Surname) LIKE '%mohammad%baadi%'`,
                    function(err) {
                      if (err) {
                        console.warn('Warning updating mohamad:', err.message);
                      } else {
                        console.log(`Updated Mohamad Baadi worker record`);
                      }

                      // Add password column to workers if needed
                      db.run(`
                        ALTER TABLE workers ADD COLUMN password TEXT
                      `, (err) => {
                        // Ignore error if column already exists
                        if (err && !err.message.includes('duplicate column')) {
                          console.warn('Warning:', err.message);
                        }

                        db.close((closeErr) => {
                          if (closeErr) {
                            reject(closeErr);
                          } else {
                            console.log('Login users seeded successfully!');
                            console.log('\nOffice Staff (Normal Access):');
                            console.log('  - rachida / rachida123');
                            console.log('  - brahim / brahim123');
                            console.log('  - touria / touria123');
                            console.log('\nSecurity Staff (Security Page):');
                            console.log('  - brahimbahessi / brahimbahessi123');
                            console.log('  - mohamadbaadi / mohamadbaadi123');
                            resolvePromise();
                          }
                        });
                      });
                    }
                  );
                }
              );
            }
          }
        );
      });
    });
  });
};

// Run if this file is executed directly
if (isDirectRun) {
  seedLoginUsers()
    .then(() => {
      console.log('Seed login users finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed login users failed:', error);
      process.exit(1);
    });
}

export default seedLoginUsers;

