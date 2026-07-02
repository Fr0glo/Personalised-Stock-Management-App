import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// DB_PATH lets one codebase serve many isolated client instances (one DB each),
// e.g. a subdomain per client. Defaults to the local file for single installs.
const dbPath = process.env.DB_PATH || join(__dirname, 'stock_management.db');

// Keep a single database connection open instead of opening/closing for each query
// This is much more efficient and faster
let dbInstance = null;

const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        // Enable WAL mode - allows multiple users to read while one writes
        // This makes the database much faster when multiple people use it at once
        dbInstance.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            console.error('Error enabling WAL mode:', err.message);
          } else {
            console.log('WAL mode enabled - database ready for concurrent access');
          }
        });
        // Optimize database performance settings
        dbInstance.run('PRAGMA synchronous = NORMAL'); // Balance between speed and safety
        dbInstance.run('PRAGMA cache_size = 10000'); // Cache more data in memory for faster queries
        // Enable foreign key constraints to keep data relationships valid
        dbInstance.run('PRAGMA foreign_keys = ON');
      }
    });
  }
  return dbInstance;
};

// Helper function to run queries with promises
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Helper function to get single row
const getRow = (query, params = []) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Helper function to get multiple rows
const getAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

export { getDatabase, runQuery, getRow, getAll }; 