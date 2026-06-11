import sqlite3 from 'sqlite3';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, 'stock_management.db');
const MIGRATIONS_DIR = join(__dirname, 'migrations');

const getDb = () => {
  const db = new sqlite3.Database(DB_PATH);
  return {
    db,
    run: (sql, params = []) => new Promise((resolve, reject) => {
      db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
    }),
    all: (sql, params = []) => new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows); });
    }),
    close: () => new Promise(r => db.close(r))
  };
};

const ensureMigrationsTable = async (db) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getAppliedMigrations = async (db) => {
  const rows = await db.all('SELECT name FROM _migrations ORDER BY id');
  return new Set(rows.map(r => r.name));
};

const getMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
};

const runMigrations = async (direction = 'up', target = null) => {
  const db = getDb();
  try {
    await ensureMigrationsTable(db);
    const applied = await getAppliedMigrations(db);
    const files = getMigrationFiles();

    if (direction === 'up') {
      const pending = files.filter(f => !applied.has(f));
      if (pending.length === 0) {
        console.log('No pending migrations.');
        return;
      }

      for (const file of pending) {
        console.log(`Applying: ${file}`);
        const migration = await import(join(MIGRATIONS_DIR, file));
        await migration.up(db);
        await db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);
        console.log(`  Applied: ${file}`);
        if (target && file === target) break;
      }
    } else if (direction === 'down') {
      const appliedList = [...applied].sort().reverse();
      const toRollback = target ? [target] : [appliedList[0]];

      for (const file of toRollback) {
        if (!applied.has(file)) {
          console.log(`Migration not applied: ${file}`);
          continue;
        }
        console.log(`Rolling back: ${file}`);
        const migration = await import(join(MIGRATIONS_DIR, file));
        if (!migration.down) {
          console.log(`  No down() defined for ${file}, skipping.`);
          continue;
        }
        await migration.down(db);
        await db.run('DELETE FROM _migrations WHERE name = ?', [file]);
        console.log(`  Rolled back: ${file}`);
      }
    }

    console.log('Done.');
  } finally {
    await db.close();
  }
};

const showStatus = async () => {
  const db = getDb();
  try {
    await ensureMigrationsTable(db);
    const applied = await getAppliedMigrations(db);
    const files = getMigrationFiles();

    console.log('\n=== Migration Status ===');
    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }
    files.forEach(f => {
      const status = applied.has(f) ? 'APPLIED' : 'PENDING';
      console.log(`  [${status}] ${f}`);
    });
    console.log(`\n${applied.size} applied, ${files.length - applied.size} pending`);
  } finally {
    await db.close();
  }
};

const createMigration = (name) => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const slug = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const filename = `${timestamp}_${slug}.js`;
  const filepath = join(MIGRATIONS_DIR, filename);

  const template = `// Migration: ${name}
// Created: ${new Date().toISOString()}

export const up = async (db) => {
  // await db.run('ALTER TABLE ... ADD COLUMN ...');
};

export const down = async (db) => {
  // Rollback: undo the changes made in up()
  // Note: SQLite does not support DROP COLUMN before 3.35.0
  // For column removal, you must recreate the table
};
`;

  fs.writeFileSync(filepath, template);
  console.log(`Created: ${filepath}`);
  return filepath;
};

// CLI
const isDirectRun = process.argv[1] && process.argv[1].endsWith('migrate.js');
if (isDirectRun) {
  const action = process.argv[2] || 'up';

  switch (action) {
    case 'up':
      runMigrations('up').catch(err => { console.error(err); process.exit(1); });
      break;
    case 'down':
      runMigrations('down', process.argv[3]).catch(err => { console.error(err); process.exit(1); });
      break;
    case 'status':
      showStatus().catch(err => { console.error(err); process.exit(1); });
      break;
    case 'create':
      if (!process.argv[3]) {
        console.error('Usage: node migrate.js create <migration-name>');
        process.exit(1);
      }
      createMigration(process.argv.slice(3).join(' '));
      break;
    default:
      console.log('Usage: node migrate.js [up|down|status|create <name>]');
  }
}

export { runMigrations, showStatus, createMigration };
