// Migration: admin sub-accounts
// - created_by: which account created this user (groups sub-accounts under
//   their admin in the owner's Comptes view)
// - max_users: per-admin cap on how many sub-accounts they may create
//   (0 = unlimited; set by the owner)
// - first_login: 1 = show the company setup wizard on this admin's next login
//   (set when the owner promotes/creates an admin)

const addColumnIfMissing = async (db, table, column, definition) => {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

export const up = async (db) => {
  await addColumnIfMissing(db, 'users', 'created_by', 'INTEGER');
  await addColumnIfMissing(db, 'users', 'max_users', 'INTEGER DEFAULT 0');
  await addColumnIfMissing(db, 'users', 'first_login', 'INTEGER DEFAULT 0');
};

export const down = async () => {
  // SQLite can't drop columns easily; harmless to leave in place.
};
