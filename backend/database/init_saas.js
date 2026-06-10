/**
 * SaaS database initialisation — called automatically on server start.
 * Uses IF NOT EXISTS everywhere so it is safe to run repeatedly.
 */
import { getDatabase } from './connection.js';

const initSaasSchema = () => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();

    db.serialize(() => {
      db.run('PRAGMA foreign_keys = OFF');

      // ── Tenants ────────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS companies (
          company_id    INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT    NOT NULL,
          slug          TEXT    NOT NULL UNIQUE,
          email         TEXT    NOT NULL UNIQUE,
          plan          TEXT    DEFAULT 'trial',
          trial_ends_at DATETIME,
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // ── Users ──────────────────────────────────────────────────────────────
      // Add company_id / password columns to existing table if they are missing
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          user_id    INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER,
          username   TEXT    NOT NULL,
          password   TEXT,
          role       TEXT    DEFAULT 'staff',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Safely add columns that may be missing from old schema
      db.run(`ALTER TABLE users ADD COLUMN company_id INTEGER`, () => {});
      db.run(`ALTER TABLE users ADD COLUMN password   TEXT`,    () => {});

      // ── Workers ────────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS workers (
          worker_id      INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id     INTEGER,
          F_Name         TEXT    NOT NULL,
          Surname        TEXT    NOT NULL,
          Carte_National TEXT,
          Role           TEXT,
          is_deleted     INTEGER DEFAULT 0,
          created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`ALTER TABLE workers ADD COLUMN company_id INTEGER`, () => {});
      db.run(`ALTER TABLE workers ADD COLUMN is_deleted INTEGER DEFAULT 0`, () => {});

      // ── Stock items ────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS stockItems (
          item_id    INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER,
          item_name  TEXT    NOT NULL,
          quantity   INTEGER DEFAULT 0,
          unit       TEXT    DEFAULT 'pcs',
          notes      TEXT,
          is_dynamic BOOLEAN DEFAULT 1,
          is_deleted INTEGER DEFAULT 0,
          place      TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`ALTER TABLE stockItems ADD COLUMN company_id INTEGER`, () => {});
      db.run(`ALTER TABLE stockItems ADD COLUMN is_deleted INTEGER DEFAULT 0`, () => {});
      db.run(`ALTER TABLE stockItems ADD COLUMN place TEXT`, () => {});

      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_company ON stockItems(company_id, item_name)`);

      // ── Product catalogue ──────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS productCatalog (
          catalog_id    INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id    INTEGER,
          item_name     TEXT    NOT NULL,
          default_unit  TEXT    DEFAULT 'pcs',
          default_price REAL,
          notes         TEXT,
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`ALTER TABLE productCatalog ADD COLUMN company_id INTEGER`, () => {});

      // ── Entry vouchers ─────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS entryVouchers (
          entry_id       INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id     INTEGER,
          voucher_number TEXT,
          date           DATETIME DEFAULT CURRENT_TIMESTAMP,
          added_by       INTEGER,
          taken_by       INTEGER,
          notes          TEXT,
          place          TEXT
        )
      `);
      db.run(`ALTER TABLE entryVouchers ADD COLUMN company_id INTEGER`, () => {});

      db.run(`CREATE INDEX IF NOT EXISTS idx_entry_company ON entryVouchers(company_id, date)`);

      // ── Entry details ──────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS entryDetails (
          entry_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id      INTEGER,
          entry_id        INTEGER NOT NULL,
          item_id         INTEGER NOT NULL,
          worker_id       INTEGER,
          quantity        INTEGER NOT NULL
        )
      `);
      db.run(`ALTER TABLE entryDetails ADD COLUMN company_id INTEGER`, () => {});

      // ── Exit vouchers ──────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS exitVouchers (
          exit_id        INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id     INTEGER,
          voucher_number TEXT,
          date           DATETIME DEFAULT CURRENT_TIMESTAMP,
          handled_by     INTEGER,
          taken_by       INTEGER,
          notes          TEXT,
          place          TEXT
        )
      `);
      db.run(`ALTER TABLE exitVouchers ADD COLUMN company_id INTEGER`, () => {});

      db.run(`CREATE INDEX IF NOT EXISTS idx_exit_company ON exitVouchers(company_id, date)`);

      // ── Exit details ───────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS exitDetails (
          exit_detail_id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id     INTEGER,
          exit_id        INTEGER NOT NULL,
          worker_id      INTEGER,
          item_id        INTEGER NOT NULL,
          quantity       INTEGER NOT NULL
        )
      `);
      db.run(`ALTER TABLE exitDetails ADD COLUMN company_id INTEGER`, () => {});

      // ── Audit logs ─────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS auditLogs (
          log_id          INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id      INTEGER,
          action          TEXT    NOT NULL,
          item_id         INTEGER NOT NULL,
          user_id         INTEGER NOT NULL,
          timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
          quantity_before INTEGER,
          quantity_after  INTEGER
        )
      `);
      db.run(`ALTER TABLE auditLogs ADD COLUMN company_id INTEGER`, () => {});

      // ── Orders ─────────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS orders (
          order_id   INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER,
          date       DATETIME DEFAULT CURRENT_TIMESTAMP,
          status     TEXT    DEFAULT 'pending',
          created_by INTEGER
        )
      `);
      db.run(`ALTER TABLE orders ADD COLUMN company_id INTEGER`, () => {});

      // ── Order items ────────────────────────────────────────────────────────
      db.run(`
        CREATE TABLE IF NOT EXISTS orderItems (
          order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id    INTEGER,
          order_id      INTEGER NOT NULL,
          item_name     TEXT    NOT NULL,
          quantity      INTEGER NOT NULL,
          unit          TEXT    NOT NULL,
          place         TEXT
        )
      `, (err) => {
        if (err) return reject(err);
        db.run(`ALTER TABLE orderItems ADD COLUMN company_id INTEGER`, () => {});
        db.run('PRAGMA foreign_keys = ON', (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      });
    });
  });
};

export default initSaasSchema;
