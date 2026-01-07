import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const seedCustomData = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('🌱 Seeding custom users and workers...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      const users = [
        { username: 'brahim', role: 'admin' },
        { username: 'rachida', role: 'admin' },
        { username: 'touria', role: 'admin' }
      ];

      const workers = [
        { F_Name: 'Brahim', Surname: 'Bahssi', Carte_National: null, Role: 'Worker' },
        { F_Name: 'Mohammad', Surname: 'Baadi', Carte_National: null, Role: 'Worker' }
      ];

      db.run('BEGIN TRANSACTION');

      const userStmt = db.prepare(
        'INSERT INTO users (username, role) VALUES (?, ?)'
      );
      users.forEach(user => {
        userStmt.run([user.username, user.role]);
      });
      userStmt.finalize();

      const workerStmt = db.prepare(
        'INSERT INTO workers (F_Name, Surname, Carte_National, Role) VALUES (?, ?, ?, ?)'
      );
      workers.forEach(worker => {
        workerStmt.run([
          worker.F_Name,
          worker.Surname,
          worker.Carte_National,
          worker.Role
        ]);
      });
      workerStmt.finalize();

      db.run('COMMIT', (err) => {
        if (err) {
          console.error('❌ Error committing custom seed transaction:', err.message);
          db.close();
          reject(err);
        } else {
          console.log('✅ Custom users and workers seeded successfully');
          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
            } else {
              resolvePromise();
            }
          });
        }
      });
    });
  });
};

// Run seeding if this file is executed directly
if (isDirectRun) {
  seedCustomData()
    .then(() => {
      console.log('✅ Seed custom data finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed custom data failed:', error);
      process.exit(1);
    });
}

export default seedCustomData;


