import express from 'express';
import { getRow, runQuery, getAll } from '../database/connection.js';

const router = express.Router();

// Per-install company profile used to white-label the app and its documents
// (logo, name, contact, brand colours). One row (id = 1).
let ensured = false;
const DEFAULTS = {
  company_name: '',
  logo: null,
  address: '',
  phone: '',
  ice: '',
  email: '',
  tagline: '',
  color_primary: '#14246B',
  color_accent: '#F1581A',
  bon_template: 'classic',
  setup_done: 0,
  features: {},
};

// features is stored as a JSON string; expose it to callers as an object.
const withParsedFeatures = (row) => {
  if (!row) return row;
  let features = {};
  try { features = JSON.parse(row.features || '{}'); } catch { features = {}; }
  return { ...row, features };
};

const ensureTable = async () => {
  if (ensured) return;
  await runQuery(`
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
  `);
  // Older installs may predate the features column — add it if missing.
  const cols = await getAll('PRAGMA table_info(companySettings)');
  if (!cols.some((c) => c.name === 'features')) {
    await runQuery("ALTER TABLE companySettings ADD COLUMN features TEXT DEFAULT '{}'");
  }
  const row = await getRow('SELECT id FROM companySettings WHERE id = 1');
  if (!row) {
    await runQuery('INSERT INTO companySettings (id) VALUES (1)');
  }
  ensured = true;
};

// GET /api/company — the branding used everywhere (public: login/sidebar/PDFs need it)
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const row = await getRow('SELECT * FROM companySettings WHERE id = 1');
    res.json(row ? withParsedFeatures(row) : { id: 1, ...DEFAULTS });
  } catch (error) {
    console.error('Error fetching company settings:', error);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// PUT /api/company — update the profile (admin-gated on the frontend)
router.put('/', async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};
    const fields = ['company_name', 'logo', 'address', 'phone', 'ice', 'email', 'tagline', 'color_primary', 'color_accent', 'bon_template'];

    const existing = await getRow('SELECT * FROM companySettings WHERE id = 1');
    const sets = [];
    const params = [];
    for (const f of fields) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); params.push(b[f]); }
    }
    // Mark setup complete once a name is provided (feeds the first-run wizard)
    if (b.setup_done !== undefined) { sets.push('setup_done = ?'); params.push(b.setup_done ? 1 : 0); }
    else if (b.company_name && !existing?.setup_done) { sets.push('setup_done = ?'); params.push(1); }

    if (sets.length > 0) {
      await runQuery(`UPDATE companySettings SET ${sets.join(', ')} WHERE id = 1`, params);
    }

    const row = await getRow('SELECT * FROM companySettings WHERE id = 1');
    res.json(withParsedFeatures(row));
  } catch (error) {
    console.error('Error updating company settings:', error);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
});

export default router;
