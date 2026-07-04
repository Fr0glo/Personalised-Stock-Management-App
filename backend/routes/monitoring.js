import express from 'express';
import sqlite3 from 'sqlite3';
import { readdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// The owner console (Monitoring) only exists on the OWNER instance — enabled by
// OWNER_CONSOLE=1 (set only on the port-4000 process). On client instances the
// env is unset, so every data endpoint 404s: a client can NEVER read another
// client's data, even though all instances share this code.
const consoleEnabled = () => process.env.OWNER_CONSOLE === '1';

// Where the per-client databases live (all on this same VPS). Defaults to this
// instance's own clients folder; override with CLIENTS_DIR when the console runs
// from a different checkout than the clients (e.g. staging preview).
const clientsDir = () => process.env.CLIENTS_DIR || join(__dirname, '..', 'database', 'clients');

// Accounts we don't count as "office users" (mirrors the Comptes page).
const SYSTEM_ROLES = ['owner', 'superadmin', 'security', 'depot'];

// Public: lets the frontend decide whether to show the Testing/Monitoring chooser.
router.get('/status', (req, res) => {
  res.json({ enabled: consoleEnabled() });
});

// Hard gate for every data endpoint. The console is reachable on the public
// domain, so env alone isn't enough — require a secret key too. Set MONITOR_KEY
// on the port-4000 process and send it as the x-monitor-key header.
const guard = (req, res, next) => {
  if (!consoleEnabled()) return res.status(404).json({ error: 'Not found' });
  const key = process.env.MONITOR_KEY;
  if (!key) return res.status(403).json({ error: "MONITOR_KEY n'est pas configuré sur ce serveur." });
  if ((req.headers['x-monitor-key'] || '') !== key) return res.status(401).json({ error: 'Clé de monitoring invalide.' });
  next();
};

// Verify the key the owner typed, so the UI can accept/reject before loading.
router.post('/verify', guard, (req, res) => res.json({ ok: true }));

// Read one client DB and return the summary shown on the dashboard.
const readClient = (file) => new Promise((resolve) => {
  const id = basename(file, '.db');
  const summary = { id, company_name: id, logo: null, features: {}, users: 0, limit: 0, error: null };
  const db = new sqlite3.Database(join(clientsDir(), file), sqlite3.OPEN_READONLY, () => {});
  const get = (q, p = []) => new Promise((r) => db.get(q, p, (e, row) => r(e ? null : row)));
  (async () => {
    try {
      const c = await get('SELECT company_name, logo, features FROM companySettings WHERE id = 1');
      if (c) {
        summary.company_name = c.company_name || id;
        summary.logo = c.logo || null;
        try { summary.features = JSON.parse(c.features || '{}'); } catch { summary.features = {}; }
      }
      const ph = SYSTEM_ROLES.map(() => '?').join(',');
      const u = await get(`SELECT COUNT(*) AS n FROM users WHERE role IS NULL OR role NOT IN (${ph})`, SYSTEM_ROLES);
      summary.users = u?.n || 0;
      const lim = await get("SELECT value FROM settings WHERE key = 'max_users'");
      summary.limit = Number(lim?.value) || 0;
    } catch (e) {
      summary.error = e.message;
    } finally {
      db.close();
      resolve(summary);
    }
  })();
});

// List every client with identity + features + account usage.
router.get('/clients', guard, async (req, res) => {
  try {
    const dir = clientsDir();
    if (!existsSync(dir)) return res.json({ clients: [] });
    const files = readdirSync(dir).filter((f) => f.endsWith('.db'));
    const clients = await Promise.all(files.map(readClient));
    clients.sort((a, b) => a.company_name.localeCompare(b.company_name));
    res.json({ clients });
  } catch (e) {
    console.error('monitoring/clients error:', e);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

// Toggle a feature for one client (writes that client's database).
router.post('/clients/:id/feature', guard, async (req, res) => {
  const id = String(req.params.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const { feature, enabled } = req.body || {};
  if (!id || !feature) return res.status(400).json({ error: 'feature required' });
  const file = join(clientsDir(), `${id}.db`);
  if (!existsSync(file)) return res.status(404).json({ error: 'Client not found' });

  const db = new sqlite3.Database(file, sqlite3.OPEN_READWRITE);
  const all = (q, p = []) => new Promise((r, j) => db.all(q, p, (e, rows) => (e ? j(e) : r(rows))));
  const get = (q, p = []) => new Promise((r, j) => db.get(q, p, (e, row) => (e ? j(e) : r(row))));
  const run = (q, p = []) => new Promise((r, j) => db.run(q, p, function (e) { e ? j(e) : r(this); }));
  try {
    // Tolerate client DBs that predate the features column.
    const cols = await all('PRAGMA table_info(companySettings)');
    if (!cols.some((c) => c.name === 'features')) {
      await run("ALTER TABLE companySettings ADD COLUMN features TEXT DEFAULT '{}'");
    }
    const row = await get('SELECT features FROM companySettings WHERE id = 1');
    let features = {};
    try { features = JSON.parse(row?.features || '{}'); } catch { features = {}; }
    features[feature] = !!enabled;
    await run('UPDATE companySettings SET features = ? WHERE id = 1', [JSON.stringify(features)]);
    res.json({ id, features });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

export default router;
