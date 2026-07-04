// Toggle a per-client feature flag from the server (owner-only, over SSH).
//
// Usage:  node database/setFeature.js <client> <feature> <on|off>
//   e.g.  node database/setFeature.js x facture on
//         node database/setFeature.js x facture off
//
// Resolves the client's database at database/clients/<client>.db and flips the
// flag inside companySettings.features (JSON). Clients cannot do this from the
// app — enabling a paid feature requires shell access to this server.
import sqlite3 from 'sqlite3';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = (process.argv[2] || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
const feature = (process.argv[3] || '').trim();
const state = (process.argv[4] || '').trim().toLowerCase();

if (!client || !feature || !['on', 'off'].includes(state)) {
  console.error('Usage: node database/setFeature.js <client> <feature> <on|off>');
  console.error('  e.g. node database/setFeature.js x facture on');
  process.exit(1);
}

const dbPath = join(__dirname, 'clients', `${client}.db`);
if (!existsSync(dbPath)) {
  console.error(`No database for client "${client}" (${dbPath}).`);
  console.error(`Provision it first:  npm run provision-client ${client} <port>`);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);
const run = (q, p = []) => new Promise((res, rej) => db.run(q, p, function (e) { e ? rej(e) : res(this); }));
const get = (q, p = []) => new Promise((res, rej) => db.get(q, p, (e, r) => (e ? rej(e) : res(r))));
const all = (q, p = []) => new Promise((res, rej) => db.all(q, p, (e, r) => (e ? rej(e) : res(r))));

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

(async () => {
  try {
    await run(FULL_SCHEMA);
    const cols = await all('PRAGMA table_info(companySettings)');
    if (!cols.some((c) => c.name === 'features')) {
      await run("ALTER TABLE companySettings ADD COLUMN features TEXT DEFAULT '{}'");
    }
    let row = await get('SELECT features FROM companySettings WHERE id = 1');
    if (!row) { await run('INSERT INTO companySettings (id) VALUES (1)'); row = { features: '{}' }; }

    let features = {};
    try { features = JSON.parse(row.features || '{}'); } catch { features = {}; }
    features[feature] = (state === 'on');
    await run('UPDATE companySettings SET features = ? WHERE id = 1', [JSON.stringify(features)]);

    console.log(`\n✓ ${client}: feature "${feature}" is now ${state.toUpperCase()}.`);
    console.log(`  Features for ${client}: ${JSON.stringify(features)}`);
    console.log('  (The client sees the change after a full page refresh.)\n');
    db.close();
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
})();
