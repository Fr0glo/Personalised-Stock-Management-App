import sqlite3 from 'sqlite3';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, 'stock_management.db');
const ARCHIVE_DIR = process.env.ARCHIVE_DIR || join(__dirname, 'archives');
const AUDIT_RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
const ORDER_RETENTION_DAYS = parseInt(process.env.ORDER_RETENTION_DAYS || '180', 10);

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

const ensureArchiveDir = () => {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
};

const ensureArchiveTables = async (db) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS _archive_auditLogs (
      log_id INTEGER,
      action TEXT,
      item_id INTEGER,
      user_id INTEGER,
      timestamp DATETIME,
      quantity_before INTEGER,
      quantity_after INTEGER,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS _archive_orders (
      order_id INTEGER,
      date DATETIME,
      status TEXT,
      created_by INTEGER,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS _archive_orderItems (
      order_item_id INTEGER,
      order_id INTEGER,
      item_name TEXT,
      quantity INTEGER,
      unit TEXT,
      place TEXT,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const logResult = (action, table, count, archiveLocation) => {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${action} | table=${table} | rows=${count} | archive=${archiveLocation}`;
  console.log(msg);

  const logPath = join(ARCHIVE_DIR, 'cleanup.log');
  fs.appendFileSync(logPath, msg + '\n');
};

const runCleanup = async (options = {}) => {
  const { dryRun = true, type = 'daily' } = options;
  const db = getDb();

  try {
    ensureArchiveDir();
    await ensureArchiveTables(db);

    if (dryRun) {
      console.log('=== DRY RUN (no changes will be made) ===\n');
    }

    // Daily cleanup: auditLogs older than AUDIT_RETENTION_DAYS
    const auditCutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86400000).toISOString();
    const auditRows = await db.all(
      'SELECT * FROM auditLogs WHERE timestamp < ?',
      [auditCutoff]
    );

    console.log(`auditLogs: ${auditRows.length} rows older than ${AUDIT_RETENTION_DAYS} days (before ${auditCutoff.slice(0, 10)})`);

    if (auditRows.length > 0 && !dryRun) {
      await db.run('BEGIN TRANSACTION');
      try {
        for (const row of auditRows) {
          await db.run(
            'INSERT INTO _archive_auditLogs (log_id, action, item_id, user_id, timestamp, quantity_before, quantity_after) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [row.log_id, row.action, row.item_id, row.user_id, row.timestamp, row.quantity_before, row.quantity_after]
          );
        }
        const verifyCount = await db.get('SELECT COUNT(*) as c FROM _archive_auditLogs WHERE archived_at >= datetime("now", "-1 minute")');
        if (verifyCount.c < auditRows.length) {
          throw new Error(`Archive verification failed: expected ${auditRows.length}, got ${verifyCount.c}`);
        }
        await db.run('DELETE FROM auditLogs WHERE timestamp < ?', [auditCutoff]);
        await db.run('COMMIT');
        logResult('ARCHIVED+DELETED', 'auditLogs', auditRows.length, '_archive_auditLogs');
      } catch (err) {
        await db.run('ROLLBACK');
        logResult('FAILED', 'auditLogs', 0, err.message);
        console.error('auditLogs cleanup failed, rolled back:', err.message);
      }
    }

    // Weekly cleanup: completed/cancelled orders older than ORDER_RETENTION_DAYS
    if (type === 'weekly' || type === 'all') {
      const orderCutoff = new Date(Date.now() - ORDER_RETENTION_DAYS * 86400000).toISOString();
      const oldOrders = await db.all(
        "SELECT * FROM orders WHERE date < ? AND status IN ('completed', 'cancelled')",
        [orderCutoff]
      );

      console.log(`orders: ${oldOrders.length} completed/cancelled rows older than ${ORDER_RETENTION_DAYS} days`);

      if (oldOrders.length > 0 && !dryRun) {
        await db.run('BEGIN TRANSACTION');
        try {
          for (const order of oldOrders) {
            await db.run(
              'INSERT INTO _archive_orders (order_id, date, status, created_by) VALUES (?, ?, ?, ?)',
              [order.order_id, order.date, order.status, order.created_by]
            );
            const items = await db.all('SELECT * FROM orderItems WHERE order_id = ?', [order.order_id]);
            for (const item of items) {
              await db.run(
                'INSERT INTO _archive_orderItems (order_item_id, order_id, item_name, quantity, unit, place) VALUES (?, ?, ?, ?, ?, ?)',
                [item.order_item_id, item.order_id, item.item_name, item.quantity, item.unit, item.place]
              );
            }
          }

          const orderIds = oldOrders.map(o => o.order_id);
          const placeholders = orderIds.map(() => '?').join(',');
          await db.run(`DELETE FROM orderItems WHERE order_id IN (${placeholders})`, orderIds);
          await db.run(`DELETE FROM orders WHERE order_id IN (${placeholders})`, orderIds);
          await db.run('COMMIT');
          logResult('ARCHIVED+DELETED', 'orders+orderItems', oldOrders.length, '_archive_orders');
        } catch (err) {
          await db.run('ROLLBACK');
          logResult('FAILED', 'orders', 0, err.message);
          console.error('Orders cleanup failed, rolled back:', err.message);
        }
      }
    }

    // Export archive tables to compressed file (monthly snapshot)
    if (!dryRun && type === 'weekly') {
      await exportArchives(db);
    }

    if (dryRun) {
      console.log('\n=== DRY RUN COMPLETE — no data was changed ===');
    }
  } finally {
    await db.close();
  }
};

const exportArchives = async (db) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const exportPath = join(ARCHIVE_DIR, `archive-export-${timestamp}.json`);
  const compressedPath = `${exportPath}.gz`;

  const auditArchive = await db.all('SELECT * FROM _archive_auditLogs');
  const orderArchive = await db.all('SELECT * FROM _archive_orders');
  const orderItemArchive = await db.all('SELECT * FROM _archive_orderItems');

  const total = auditArchive.length + orderArchive.length + orderItemArchive.length;
  if (total === 0) return;

  const data = JSON.stringify({
    exportDate: new Date().toISOString(),
    auditLogs: auditArchive,
    orders: orderArchive,
    orderItems: orderItemArchive
  }, null, 2);

  fs.writeFileSync(exportPath, data);
  await pipeline(
    createReadStream(exportPath),
    createGzip({ level: 6 }),
    createWriteStream(compressedPath)
  );
  fs.unlinkSync(exportPath);

  const stats = fs.statSync(compressedPath);
  console.log(`Archive exported: ${compressedPath} (${(stats.size / 1024).toFixed(1)} KB, ${total} rows)`);
};

// CLI
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('cleanup.js') ||
  process.argv[1].endsWith('cleanup.js/')
);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--run');
  const type = args.includes('--weekly') ? 'weekly' : args.includes('--all') ? 'all' : 'daily';

  if (dryRun && !args.includes('--dry-run')) {
    console.log('Hint: use --run to execute. Default is dry-run for safety.\n');
  }

  runCleanup({ dryRun, type })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}

export { runCleanup };
export default runCleanup;
