import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'stock_management.db');

const resetDatabase = () => {
  return new Promise((resolve, reject) => {
    console.log('🗑️  Resetting database...');
    
    // Delete the database file completely
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Deleted existing database file');
    }
    
    // Create new database
    const db = new sqlite3.Database(dbPath);
    
    db.serialize(() => {
      console.log('🏗️  Creating fresh database tables...');
      
      // Users table (office staff)
      db.run(`
        CREATE TABLE users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          role TEXT DEFAULT 'staff',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Workers table (people who handle stock)
      db.run(`
        CREATE TABLE workers (
          worker_id INTEGER PRIMARY KEY AUTOINCREMENT,
          F_Name TEXT NOT NULL,
          Surname TEXT NOT NULL,
          Carte_National TEXT,
          Role TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // StockItems table (products/inventory)
      db.run(`
        CREATE TABLE stockItems (
          item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_name TEXT NOT NULL,
          quantity INTEGER DEFAULT 0,
          unit TEXT DEFAULT 'pcs',
          notes TEXT,
          is_dynamic BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EntryVouchers table (Bon d'entrée)
      db.run(`
        CREATE TABLE entryVouchers (
          entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          added_by INTEGER NOT NULL,
          FOREIGN KEY (added_by) REFERENCES users (user_id)
        )
      `);

      // EntryDetails table (items in entry vouchers)
      db.run(`
        CREATE TABLE entryDetails (
          entry_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          worker_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          FOREIGN KEY (entry_id) REFERENCES entryVouchers (entry_id),
          FOREIGN KEY (item_id) REFERENCES stockItems (item_id),
          FOREIGN KEY (worker_id) REFERENCES workers (worker_id)
        )
      `);

      // ExitVouchers table (Bon de sortie)
      db.run(`
        CREATE TABLE exitVouchers (
          exit_id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          handled_by INTEGER NOT NULL,
          FOREIGN KEY (handled_by) REFERENCES users (user_id)
        )
      `);

      // ExitDetails table (items in exit vouchers)
      db.run(`
        CREATE TABLE exitDetails (
          exit_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
          exit_id INTEGER NOT NULL,
          worker_id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          FOREIGN KEY (exit_id) REFERENCES exitVouchers (exit_id),
          FOREIGN KEY (worker_id) REFERENCES workers (worker_id),
          FOREIGN KEY (item_id) REFERENCES stockItems (item_id)
        )
      `);

      // AuditLogs table (activity tracking)
      db.run(`
        CREATE TABLE auditLogs (
          log_id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          item_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          quantity_before INTEGER,
          quantity_after INTEGER,
          FOREIGN KEY (item_id) REFERENCES stockItems (item_id),
          FOREIGN KEY (user_id) REFERENCES users (user_id)
        )
      `);

      db.run('PRAGMA foreign_keys = ON');
      
      console.log('✅ Database tables created successfully');
      
      // Insert fresh sample data
      console.log('🌱 Inserting sample data...');
      
      // Sample users
      const users = [
        { username: 'admin', role: 'admin' },
        { username: 'staff1', role: 'staff' },
        { username: 'staff2', role: 'staff' }
      ];

      users.forEach(user => {
        db.run(
          'INSERT INTO users (username, role) VALUES (?, ?)',
          [user.username, user.role]
        );
      });

      // Sample workers
      const workers = [
        { F_Name: 'Ahmed', Surname: 'Benzema', Carte_National: '123456789', Role: 'Security' },
        { F_Name: 'Mohammed', Surname: 'Salah', Carte_National: '987654321', Role: 'Foreman' },
        { F_Name: 'Ali', Surname: 'Hassan', Carte_National: '456789123', Role: 'Worker' }
      ];

      workers.forEach(worker => {
        db.run(
          'INSERT INTO workers (F_Name, Surname, Carte_National, Role) VALUES (?, ?, ?, ?)',
          [worker.F_Name, worker.Surname, worker.Carte_National, worker.Role]
        );
      });

      // Sample stock items
      const stockItems = [
        { item_name: 'Ciment 25kg', quantity: 100, unit: 'sacs', notes: 'Ciment de construction' },
        { item_name: 'Briques', quantity: 5000, unit: 'pcs', notes: 'Briques rouges' },
        { item_name: 'Acier 6mm', quantity: 50, unit: 'tonnes', notes: 'Barres d\'acier' },
        { item_name: 'Sable', quantity: 20, unit: 'm3', notes: 'Sable de construction' },
        { item_name: 'Gravier', quantity: 15, unit: 'm3', notes: 'Gravier 5/15' }
      ];

      stockItems.forEach(item => {
        db.run(
          'INSERT INTO stockItems (item_name, quantity, unit, notes) VALUES (?, ?, ?, ?)',
          [item.item_name, item.quantity, item.unit, item.notes]
        );
      });

      console.log('✅ Sample data inserted successfully');
      
      // Show final counts
      db.all('SELECT COUNT(*) as count FROM workers', (err, rows) => {
        if (!err) {
          console.log(`📊 Workers: ${rows[0].count}`);
        }
      });

      db.all('SELECT COUNT(*) as count FROM stockItems', (err, rows) => {
        if (!err) {
          console.log(`📊 Stock Items: ${rows[0].count}`);
        }
      });

      db.all('SELECT COUNT(*) as count FROM users', (err, rows) => {
        if (!err) {
          console.log(`📊 Users: ${rows[0].count}`);
        }
      });

      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🎉 Database reset completed successfully!');
          console.log('✨ No more duplicates!');
          resolve();
        }
      });
    });
  });
};

// Run reset if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then(() => {
      console.log('✅ Reset finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Reset failed:', error);
      process.exit(1);
    });
}

export default resetDatabase; 