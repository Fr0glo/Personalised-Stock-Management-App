import express from 'express';
import { getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// Simple key/value settings table. Holds the admin PIN (the "3739" code used to
// unlock admin editing on Stock / Personnel / Les Bons) so it can be changed
// from the admin page instead of being hardcoded.
let settingsEnsured = false;
const DEFAULT_ADMIN_PIN = '3739';

const ensureSettings = async () => {
  if (settingsEnsured) return;
  await runQuery(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const row = await getRow("SELECT value FROM settings WHERE key = 'admin_pin'");
  if (!row) {
    await runQuery("INSERT INTO settings (key, value) VALUES ('admin_pin', ?)", [DEFAULT_ADMIN_PIN]);
  }
  // Max office logins for this install (0 = unlimited). The seller sets it when
  // provisioning a client; the client can't raise it themselves.
  const lim = await getRow("SELECT value FROM settings WHERE key = 'max_users'");
  if (!lim) {
    await runQuery("INSERT INTO settings (key, value) VALUES ('max_users', '0')");
  }
  settingsEnsured = true;
};

const getAdminPin = async () => {
  await ensureSettings();
  const row = await getRow("SELECT value FROM settings WHERE key = 'admin_pin'");
  return row ? row.value : DEFAULT_ADMIN_PIN;
};

// POST /api/settings/verify-pin  { pin } -> { valid }
// Lets the admin-editing screens check a typed PIN without ever exposing it.
router.post('/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body;
    const current = await getAdminPin();
    res.json({ valid: String(pin) === String(current) });
  } catch (error) {
    console.error('Error verifying admin PIN:', error);
    res.status(500).json({ error: 'Failed to verify PIN' });
  }
});

// PUT /api/settings/admin-pin  { pin }  -> updates the admin PIN (4 digits)
router.put('/admin-pin', async (req, res) => {
  try {
    await ensureSettings();
    const { pin } = req.body;
    if (!/^\d{4}$/.test(String(pin || ''))) {
      return res.status(400).json({ error: 'Le code doit comporter 4 chiffres.' });
    }
    await runQuery("UPDATE settings SET value = ? WHERE key = 'admin_pin'", [String(pin)]);
    res.json({ message: 'Code admin mis à jour' });
  } catch (error) {
    console.error('Error updating admin PIN:', error);
    res.status(500).json({ error: 'Failed to update admin PIN' });
  }
});

// GET /api/settings/limits -> { max_users } (0 = unlimited)
router.get('/limits', async (req, res) => {
  try {
    await ensureSettings();
    const row = await getRow("SELECT value FROM settings WHERE key = 'max_users'");
    res.json({ max_users: Number(row?.value) || 0 });
  } catch (error) {
    console.error('Error fetching limits:', error);
    res.status(500).json({ error: 'Failed to fetch limits' });
  }
});

// PUT /api/settings/limits { max_users } -> set the office-login cap (provisioning)
router.put('/limits', async (req, res) => {
  try {
    await ensureSettings();
    const n = Math.max(0, parseInt(req.body?.max_users, 10) || 0);
    await runQuery("UPDATE settings SET value = ? WHERE key = 'max_users'", [String(n)]);
    res.json({ max_users: n });
  } catch (error) {
    console.error('Error updating limits:', error);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});

export default router;
