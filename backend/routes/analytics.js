import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';
import { runTransaction, resolveUserId, writeAudit } from '../database/inventory.js';

const router = express.Router();

// YYYY-MM helpers computed in JS to avoid SQLite month-arithmetic pitfalls.
const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Ensure the hors-stock table exists AND has the verification columns, even if
// migrations haven't run. Runs its checks once per process.
let unregisteredEnsured = false;
const ensureUnregisteredTable = async () => {
  if (unregisteredEnsured) return;
  await runQuery(`
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
  const names = (await getAll('PRAGMA table_info(exitUnregisteredItems)')).map(c => c.name);
  if (!names.includes('verified')) await runQuery('ALTER TABLE exitUnregisteredItems ADD COLUMN verified INTEGER DEFAULT 0');
  if (!names.includes('verified_at')) await runQuery('ALTER TABLE exitUnregisteredItems ADD COLUMN verified_at DATETIME');
  if (!names.includes('verified_by')) await runQuery('ALTER TABLE exitUnregisteredItems ADD COLUMN verified_by INTEGER');
  unregisteredEnsured = true;
};

// GET /api/analytics/overview — everything the Analyse dashboard needs.
router.get('/overview', async (req, res) => {
  try {
    await ensureUnregisteredTable();

    const now = new Date();
    const thisMonth = ymOf(now);
    const lastMonth = ymOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(ymOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));

    // ---- Hors-stock ----
    const hsThis = await getRow(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(u.quantity),0) AS qty
      FROM exitUnregisteredItems u JOIN exitVouchers ev ON u.exit_id = ev.exit_id
      WHERE strftime('%Y-%m', ev.date) = ?`, [thisMonth]);
    const hsLast = await getRow(`
      SELECT COUNT(*) AS cnt
      FROM exitUnregisteredItems u JOIN exitVouchers ev ON u.exit_id = ev.exit_id
      WHERE strftime('%Y-%m', ev.date) = ?`, [lastMonth]);

    const trendRows = await getAll(`
      SELECT strftime('%Y-%m', ev.date) AS ym, COUNT(*) AS cnt
      FROM exitUnregisteredItems u JOIN exitVouchers ev ON u.exit_id = ev.exit_id
      GROUP BY ym`);
    const trendMap = Object.fromEntries(trendRows.map(r => [r.ym, r.cnt]));
    const trend = months.map(m => ({ month: m, count: trendMap[m] || 0 }));

    const aVerifier = await getAll(`
      SELECT MIN(u.item_name) AS name,
             SUM(u.quantity) AS total_qty,
             COUNT(*) AS occurrences,
             MAX(ev.date) AS last_date,
             GROUP_CONCAT(DISTINCT ev.voucher_number) AS vouchers,
             GROUP_CONCAT(DISTINCT (w.F_Name || ' ' || w.Surname)) AS takers
      FROM exitUnregisteredItems u
      JOIN exitVouchers ev ON u.exit_id = ev.exit_id
      LEFT JOIN workers w ON u.worker_id = w.worker_id
      WHERE strftime('%Y-%m', ev.date) = ? AND COALESCE(u.verified, 0) = 0
      GROUP BY LOWER(TRIM(u.item_name))
      ORDER BY total_qty DESC`, [thisMonth]);

    const recurrents = await getAll(`
      SELECT MIN(u.item_name) AS name, COUNT(*) AS occurrences, SUM(u.quantity) AS total_qty
      FROM exitUnregisteredItems u
      WHERE COALESCE(u.verified, 0) = 0
      GROUP BY LOWER(TRIM(u.item_name))
      HAVING COUNT(*) > 1
      ORDER BY occurrences DESC, total_qty DESC
      LIMIT 8`);

    // ---- Mouvements (this month) ----
    const entryCount = (await getRow(`SELECT COUNT(*) AS c FROM entryVouchers WHERE strftime('%Y-%m', date) = ?`, [thisMonth])).c;
    const exitCount = (await getRow(`SELECT COUNT(*) AS c FROM exitVouchers WHERE strftime('%Y-%m', date) = ?`, [thisMonth])).c;
    const entryQty = (await getRow(`
      SELECT COALESCE(SUM(ed.quantity),0) AS q FROM entryDetails ed
      JOIN entryVouchers ev ON ed.entry_id = ev.entry_id WHERE strftime('%Y-%m', ev.date) = ?`, [thisMonth])).q;
    const exitQty = (await getRow(`
      SELECT COALESCE(SUM(ed.quantity),0) AS q FROM exitDetails ed
      JOIN exitVouchers ev ON ed.exit_id = ev.exit_id WHERE strftime('%Y-%m', ev.date) = ?`, [thisMonth])).q;
    const topExits = await getAll(`
      SELECT COALESCE(si.item_name, 'Article supprimé') AS item_name, SUM(ed.quantity) AS qty
      FROM exitDetails ed
      JOIN exitVouchers ev ON ed.exit_id = ev.exit_id
      LEFT JOIN stockItems si ON ed.item_id = si.item_id
      WHERE strftime('%Y-%m', ev.date) = ?
      GROUP BY ed.item_id ORDER BY qty DESC LIMIT 5`, [thisMonth]);

    // ---- Valeur du stock ----
    const val = await getRow(`
      SELECT COALESCE(SUM(quantity * COALESCE(price,0)),0) AS total,
             SUM(CASE WHEN price IS NOT NULL AND price > 0 THEN 1 ELSE 0 END) AS priced,
             SUM(CASE WHEN price IS NULL OR price = 0 THEN 1 ELSE 0 END) AS unpriced
      FROM stockItems WHERE COALESCE(is_deleted,0) = 0`);
    const valueByPlace = await getAll(`
      SELECT COALESCE(NULLIF(TRIM(place),''), 'Sans emplacement') AS place,
             COALESCE(SUM(quantity * COALESCE(price,0)),0) AS value
      FROM stockItems WHERE COALESCE(is_deleted,0) = 0
      GROUP BY place HAVING value > 0 ORDER BY value DESC`);

    res.json({
      month: thisMonth,
      horsStock: {
        thisMonthCount: hsThis.cnt, thisMonthQty: hsThis.qty,
        lastMonthCount: hsLast.cnt,
        trend, aVerifier, recurrents
      },
      mouvements: { entryCount, exitCount, entryQty, exitQty, topExits },
      valeur: {
        total: val.total, pricedItems: val.priced, unpricedItems: val.unpriced,
        byPlace: valueByPlace
      }
    });
  } catch (error) {
    console.error('Error building analytics overview:', error);
    res.status(500).json({ error: 'Failed to build analytics overview' });
  }
});

// POST /api/analytics/hors-stock/verify
// After security checks the dépôt: either promote the item into stock with the
// real counted quantity ("we have it"), or just mark it verified ("introuvable").
// Either way, all unverified hors-stock rows for that name drop off the list.
router.post('/hors-stock/verify', async (req, res) => {
  try {
    await ensureUnregisteredTable();
    const { name, promote, quantity, unit, price, place, verified_by } = req.body;
    if (!name || !name.toString().trim()) {
      return res.status(400).json({ error: 'Nom de l\'article requis' });
    }
    const trimmed = name.toString().trim();
    const actorUserId = await resolveUserId(verified_by);
    const placeVal = (place && place.toString().trim()) ? place.toString().trim() : null;

    await runTransaction(async () => {
      if (promote) {
        // Register the item in stock at its real current quantity (a SET, not an add).
        const qty = Math.max(0, Number(quantity) || 0);
        const existing = await getRow(
          'SELECT * FROM stockItems WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))',
          [trimmed]
        );
        if (existing) {
          await runQuery(
            'UPDATE stockItems SET quantity = ?, unit = COALESCE(?, unit), price = COALESCE(?, price), place = COALESCE(?, place), is_deleted = 0 WHERE item_id = ?',
            [qty, unit || null, price ?? null, placeVal, existing.item_id]
          );
          await writeAudit('hors_stock_verify', existing.item_id, actorUserId, existing.quantity, qty);
        } else {
          const r = await runQuery(
            'INSERT INTO stockItems (item_name, quantity, unit, price, place, is_dynamic) VALUES (?,?,?,?,?,1)',
            [trimmed, qty, unit || 'pcs', price ?? null, placeVal]
          );
          await writeAudit('hors_stock_verify', r.id, actorUserId, 0, qty);
        }
      }

      // Mark every unverified hors-stock row for this name as verified.
      await runQuery(
        "UPDATE exitUnregisteredItems SET verified = 1, verified_at = datetime('now'), verified_by = ? WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?)) AND COALESCE(verified,0) = 0",
        [actorUserId, trimmed]
      );
    });

    res.json({ message: promote ? 'Article ajouté au stock et vérifié' : 'Article marqué comme vérifié' });
  } catch (error) {
    console.error('Error verifying hors-stock item:', error);
    res.status(500).json({ error: 'Échec de la vérification', details: error.message });
  }
});

export default router;
