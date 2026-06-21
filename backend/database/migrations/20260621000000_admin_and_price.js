// Migration: admin account + stock price
// - Adds an optional `price` (unit price) column to stockItems for valuation.
// - Seeds the admin account (admin / admin123, role 'superadmin') that unlocks
//   the Analyse dashboard. Idempotent.

export const up = async (db) => {
  const cols = await db.all('PRAGMA table_info(stockItems)');
  if (!cols.some(c => c.name === 'price')) {
    await db.run('ALTER TABLE stockItems ADD COLUMN price REAL');
  }

  // Explicit user_id 9996 to avoid colliding with the hardcoded fallback ids
  // (security 9997, Mohamad 9998, Brahim 9999) used in auth.js.
  const admin = await db.get("SELECT user_id FROM users WHERE LOWER(username) = 'admin'");
  if (!admin) {
    await db.run("INSERT INTO users (user_id, username, password, role) VALUES (9996, 'admin', 'admin123', 'superadmin')");
  } else {
    await db.run("UPDATE users SET role = 'superadmin' WHERE LOWER(username) = 'admin'");
  }
};

export const down = async (db) => {
  // Remove the seeded admin account. (The price column is left in place —
  // SQLite can't easily drop a column and the data is harmless.)
  await db.run("DELETE FROM users WHERE LOWER(username) = 'admin' AND role = 'superadmin'");
};
