import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Honour DB_PATH so a new client instance is initialised on its own database.
const dbPath = process.env.DB_PATH || join(__dirname, 'stock_management.db');
const db = new sqlite3.Database(dbPath);

// Create tables
const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table (office staff)
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          role TEXT DEFAULT 'staff',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Workers table (people who handle stock)
      db.run(`
        CREATE TABLE IF NOT EXISTS workers (
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
        CREATE TABLE IF NOT EXISTS stockItems (
          item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_name TEXT NOT NULL,
          quantity INTEGER DEFAULT 0,
          unit TEXT DEFAULT 'pcs',
          notes TEXT,
          is_dynamic BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance (especially important for large datasets)
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_stockItems_item_name ON stockItems(item_name)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_stockItems_quantity ON stockItems(quantity)
      `);

      // ProductCatalog table (master list of products used for Bon d'entrée search)
      db.run(`
        CREATE TABLE IF NOT EXISTS productCatalog (
          catalog_id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_name TEXT NOT NULL,
          default_unit TEXT DEFAULT 'pcs',
          default_price REAL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // EntryVouchers table (Bon d'entrée)
      db.run(`
        CREATE TABLE IF NOT EXISTS entryVouchers (
          entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
          voucher_number TEXT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          added_by INTEGER NOT NULL,
          taken_by INTEGER,
          notes TEXT,
          FOREIGN KEY (added_by) REFERENCES users (user_id),
          FOREIGN KEY (taken_by) REFERENCES workers (worker_id)
        )
      `);

      // EntryDetails table (items in entry vouchers)
      db.run(`
        CREATE TABLE IF NOT EXISTS entryDetails (
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
        CREATE TABLE IF NOT EXISTS exitVouchers (
          exit_id INTEGER PRIMARY KEY AUTOINCREMENT,
          voucher_number TEXT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          handled_by INTEGER NOT NULL,
          taken_by INTEGER,
          notes TEXT,
          FOREIGN KEY (handled_by) REFERENCES users (user_id),
          FOREIGN KEY (taken_by) REFERENCES workers (worker_id)
        )
      `);

      // ExitDetails table (items in exit vouchers)
      db.run(`
        CREATE TABLE IF NOT EXISTS exitDetails (
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
        CREATE TABLE IF NOT EXISTS auditLogs (
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

      // Orders table (posted orders from Commander page)
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          order_id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending',
          created_by INTEGER NOT NULL,
          FOREIGN KEY (created_by) REFERENCES users (user_id)
        )
      `);

      // OrderItems table (items in orders)
      db.run(`
        CREATE TABLE IF NOT EXISTS orderItems (
          order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit TEXT NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders (order_id)
        )
      `);

      // Indexes — created here, after their tables exist
      db.run(`CREATE INDEX IF NOT EXISTS idx_productCatalog_item_name ON productCatalog(item_name)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_entryVouchers_date ON entryVouchers(date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_exitVouchers_date ON exitVouchers(date)`);

      db.run('PRAGMA foreign_keys = ON');
    });

    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Seed initial data
const seedData = async () => {
  const db = new sqlite3.Database(dbPath);
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🌱 Seeding initial data...');
      
      // Check if data already exists
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          console.error('Error checking users:', err);
          return;
        }
        
        // Product installs start EMPTY — the client adds their own stock,
        // personnel and vouchers. (The admin account comes from migrations.)
        if (true) {
          console.log('Clean install — no sample data seeded.');
          db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
          return;
        }
        
        console.log('📝 Inserting sample data...');
        
        // Insert sample users (office staff)
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

        // Insert sample workers
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

        // Insert sample stock items
        const stockItems = [
          { item_name: 'Ciment 25kg', quantity: 100, unit: 'sacs', notes: 'Ciment de construction' },
          { item_name: 'Briques', quantity: 5000, unit: 'pcs', notes: 'Briques rouges' },
          { item_name: 'Acier 6mm', quantity: 50, unit: 'tonnes', notes: 'Barres d\'acier' },
          { item_name: 'Sable', quantity: 20, unit: 'm3', notes: 'Sable de construction' },
          { item_name: 'Gravier', quantity: 15, unit: 'm3', notes: 'Gravier 5/15' },
          // New Items Test
          { item_name: 'Tuyaux PVC', quantity: 200, unit: 'pcs', notes: 'Tuyaux 100mm' },
          { item_name: 'Peinture blanche', quantity: 30, unit: 'L', notes: 'Peinture intérieure' },
          { item_name: 'Vis 6x100', quantity: 1000, unit: 'pcs', notes: 'Vis à bois' },
          { item_name: 'Planches bois', quantity: 80, unit: 'pcs', notes: 'Planches 2x4 3m' },
          { item_name: 'Béton prêt', quantity: 10, unit: 'm3', notes: 'Béton C25/30' }
        ];

        stockItems.forEach(item => {
          db.run(
            'INSERT INTO stockItems (item_name, quantity, unit, notes) VALUES (?, ?, ?, ?)',
            [item.item_name, item.quantity, item.unit, item.notes]
          );
        });

        // Insert sample entry voucher
        db.run(`
          INSERT INTO entryVouchers (entry_id, added_by) 
          VALUES (1, 1)
        `);

        // Insert sample entry details
        db.run(`
          INSERT INTO entryDetails (entry_id, item_id, worker_id, quantity) 
          VALUES (1, 1, 1, 50)
        `);

        // Insert sample exit voucher
        db.run(`
          INSERT INTO exitVouchers (exit_id, handled_by) 
          VALUES (1, 2)
        `);

        // Insert sample exit details
        db.run(`
          INSERT INTO exitDetails (exit_id, worker_id, item_id, quantity) 
          VALUES (1, 2, 2, 100)
        `);

        // Insert sample audit logs
        db.run(`
          INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) 
          VALUES ('entry', 1, 1, 0, 50)
        `);

        db.run(`
          INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) 
          VALUES ('exit', 2, 2, 5000, 4900)
        `);

        db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  });
};

// Main execution
const initDatabase = async () => {
  try {
    console.log('Creating database tables...');
    await createTables();
    console.log('Database tables created successfully');
    
    console.log('Seeding initial data...');
    await seedData();
    console.log('Initial data seeded successfully');
    
    console.log('Database initialization completed! (empty — ready for the client)');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

initDatabase(); 