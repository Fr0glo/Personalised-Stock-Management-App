// Migration: baseline schema
// Records all columns that were added ad-hoc before the migration system existed.
// This migration is idempotent — it checks before adding each column.

const addColumnIfMissing = async (db, table, column, definition) => {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

export const up = async (db) => {
  await addColumnIfMissing(db, 'users', 'password', 'TEXT');
  await addColumnIfMissing(db, 'users', 'is_deleted', 'INTEGER DEFAULT 0');
  await addColumnIfMissing(db, 'workers', 'password', 'TEXT');
  await addColumnIfMissing(db, 'workers', 'is_deleted', 'INTEGER DEFAULT 0');
  await addColumnIfMissing(db, 'stockItems', 'place', 'TEXT');
  await addColumnIfMissing(db, 'stockItems', 'is_deleted', 'INTEGER DEFAULT 0');
  await addColumnIfMissing(db, 'entryVouchers', 'voucher_number', 'TEXT');
  await addColumnIfMissing(db, 'entryVouchers', 'taken_by', 'INTEGER');
  await addColumnIfMissing(db, 'entryVouchers', 'notes', 'TEXT');
  await addColumnIfMissing(db, 'entryVouchers', 'place', 'TEXT');
  await addColumnIfMissing(db, 'exitVouchers', 'voucher_number', 'TEXT');
  await addColumnIfMissing(db, 'exitVouchers', 'taken_by', 'INTEGER');
  await addColumnIfMissing(db, 'exitVouchers', 'notes', 'TEXT');
  await addColumnIfMissing(db, 'exitVouchers', 'place', 'TEXT');
  await addColumnIfMissing(db, 'orderItems', 'place', 'TEXT');
};

export const down = async (db) => {
  // Baseline migration — rolling back would mean dropping columns that
  // may already have data. Intentionally left as no-op for safety.
  console.log('Baseline migration cannot be rolled back (columns may contain data).');
};
