// Migration: exit unregistered items
// Adds a table to record items that physically left the depot but do NOT exist
// in the stock (the office searched for them and found nothing). These are
// flagged on the exit voucher for tracking, and never touch stock quantities.
// Purely additive — existing exit data is untouched.

export const up = async (db) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS exitUnregisteredItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exit_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      worker_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exit_id) REFERENCES exitVouchers (exit_id),
      FOREIGN KEY (worker_id) REFERENCES workers (worker_id)
    )
  `);
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_exitUnregistered_exit
    ON exitUnregisteredItems(exit_id)
  `);
};

export const down = async (db) => {
  await db.run('DROP TABLE IF EXISTS exitUnregisteredItems');
};
