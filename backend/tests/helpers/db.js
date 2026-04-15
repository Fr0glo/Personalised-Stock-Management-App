/**
 * In-memory SQLite test database helper.
 * Each test file (running in its own process) gets a fresh DB via initTestDb().
 * The runQuery/getRow/getAll exports mirror the real connection.js API so they
 * can be used as a vi.mock() replacement.
 */
import sqlite3 from 'sqlite3';

let db = null;

/** Create all tables in an in-memory SQLite database */
export const initTestDb = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) return reject(err);

      db.serialize(() => {
        // Foreign keys off during setup so we can insert seed data freely
        db.run('PRAGMA foreign_keys = OFF');

        db.run(`CREATE TABLE IF NOT EXISTS users (
          user_id   INTEGER PRIMARY KEY AUTOINCREMENT,
          username  TEXT NOT NULL UNIQUE,
          role      TEXT DEFAULT 'staff',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS workers (
          worker_id     INTEGER PRIMARY KEY AUTOINCREMENT,
          F_Name        TEXT NOT NULL,
          Surname       TEXT NOT NULL,
          Carte_National TEXT,
          Role          TEXT,
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Includes is_deleted and place from the start (routes ADD these if missing)
        db.run(`CREATE TABLE IF NOT EXISTS stockItems (
          item_id    INTEGER PRIMARY KEY AUTOINCREMENT,
          item_name  TEXT NOT NULL,
          quantity   INTEGER DEFAULT 0,
          unit       TEXT DEFAULT 'pcs',
          notes      TEXT,
          is_dynamic BOOLEAN DEFAULT 1,
          is_deleted INTEGER DEFAULT 0,
          place      TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS productCatalog (
          catalog_id    INTEGER PRIMARY KEY AUTOINCREMENT,
          item_name     TEXT NOT NULL,
          default_unit  TEXT DEFAULT 'pcs',
          default_price REAL,
          notes         TEXT,
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS entryVouchers (
          entry_id       INTEGER PRIMARY KEY AUTOINCREMENT,
          voucher_number TEXT,
          date           DATETIME DEFAULT CURRENT_TIMESTAMP,
          added_by       INTEGER NOT NULL,
          taken_by       INTEGER,
          notes          TEXT,
          place          TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS entryDetails (
          entry_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id        INTEGER NOT NULL,
          item_id         INTEGER NOT NULL,
          worker_id       INTEGER NOT NULL,
          quantity        INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS exitVouchers (
          exit_id        INTEGER PRIMARY KEY AUTOINCREMENT,
          voucher_number TEXT,
          date           DATETIME DEFAULT CURRENT_TIMESTAMP,
          handled_by     INTEGER NOT NULL,
          taken_by       INTEGER,
          notes          TEXT,
          place          TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS exitDetails (
          exit_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
          exit_id        INTEGER NOT NULL,
          worker_id      INTEGER NOT NULL,
          item_id        INTEGER NOT NULL,
          quantity       INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS auditLogs (
          log_id          INTEGER PRIMARY KEY AUTOINCREMENT,
          action          TEXT NOT NULL,
          item_id         INTEGER NOT NULL,
          user_id         INTEGER NOT NULL,
          timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
          quantity_before INTEGER,
          quantity_after  INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS orders (
          order_id   INTEGER PRIMARY KEY AUTOINCREMENT,
          date       DATETIME DEFAULT CURRENT_TIMESTAMP,
          status     TEXT DEFAULT 'pending',
          created_by INTEGER NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS orderItems (
          order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id      INTEGER NOT NULL,
          item_name     TEXT NOT NULL,
          quantity      INTEGER NOT NULL,
          unit          TEXT NOT NULL
        )`, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
};

/** Seed base data needed by most tests (one user + one worker) */
export const seedBaseData = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // user_id 1 = office staff
      db.run(`INSERT INTO users (user_id, username, role) VALUES (1, 'testuser', 'staff')`);
      // user_id 9997 = security (special hardcoded ID)
      db.run(`INSERT INTO users (user_id, username, role) VALUES (9997, 'Security', 'security')`);
      // worker_id 1
      db.run(
        `INSERT INTO workers (worker_id, F_Name, Surname, Role) VALUES (1, 'Ahmed', 'Benzema', 'Security')`,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
};

/** Wipe all table rows between tests so state doesn't bleed */
export const clearTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM auditLogs');
      db.run('DELETE FROM orderItems');
      db.run('DELETE FROM orders');
      db.run('DELETE FROM exitDetails');
      db.run('DELETE FROM exitVouchers');
      db.run('DELETE FROM entryDetails');
      db.run('DELETE FROM entryVouchers');
      db.run('DELETE FROM stockItems');
      db.run('DELETE FROM workers');
      db.run('DELETE FROM users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const closeTestDb = () => {
  return new Promise((resolve) => {
    if (db) {
      db.close(() => {
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
};

// ── Drop-in replacements for database/connection.js ─────────────────────────

export const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const getRow = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const getAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};
