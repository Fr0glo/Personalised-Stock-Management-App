// Migration: per-client feature flags
// Adds a `features` JSON column to companySettings. Each client instance can
// have optional/paid features toggled independently (e.g. facture). The owner
// flips these server-side (database/setFeature.js) over SSH — clients cannot
// enable them from the app. Idempotent.

const FULL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS companySettings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT DEFAULT '',
    logo TEXT,
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    ice TEXT DEFAULT '',
    email TEXT DEFAULT '',
    tagline TEXT DEFAULT '',
    color_primary TEXT DEFAULT '#14246B',
    color_accent TEXT DEFAULT '#F1581A',
    bon_template TEXT DEFAULT 'classic',
    setup_done INTEGER DEFAULT 0,
    features TEXT DEFAULT '{}'
  )
`;

export const up = async (db) => {
  // Fresh installs: the company route creates this table lazily, so it may not
  // exist yet at migration time. Create it (with features) if missing.
  await db.run(FULL_SCHEMA);
  // Existing installs that already had the table: add the column if absent.
  const cols = await db.all('PRAGMA table_info(companySettings)');
  if (!cols.some((c) => c.name === 'features')) {
    await db.run("ALTER TABLE companySettings ADD COLUMN features TEXT DEFAULT '{}'");
  }
  const row = await db.get('SELECT id FROM companySettings WHERE id = 1');
  if (!row) await db.run('INSERT INTO companySettings (id) VALUES (1)');
};

export const down = async (db) => {
  // SQLite can't easily DROP COLUMN; the extra `features` column is harmless.
};
