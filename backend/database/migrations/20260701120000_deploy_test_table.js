// Migration: deploy test table
// Purpose: prove that migrate.js actually applies a migration on the Windows
// server via update.bat (the step that failed before with the ESM URL error).
// Purely additive and harmless — creates a small marker table.

export const up = async (db) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS deploy_test (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.run("INSERT INTO deploy_test (note) VALUES ('migrate.js ran on the server')");
};

export const down = async (db) => {
  await db.run('DROP TABLE IF EXISTS deploy_test');
};
