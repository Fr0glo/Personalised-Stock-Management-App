import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// Bon de Commande = internal requisition/order document (no prices). Each one
// gets a unique auto-incrementing number BC-XXXX and is kept for history.
let ensured = false;
const ensureTable = async () => {
  if (ensured) return;
  await runQuery(`
    CREATE TABLE IF NOT EXISTS bonCommande (
      bc_id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE,
      demande_par TEXT,
      items_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensured = true;
};

const nextNumero = async () => {
  const last = await getRow("SELECT numero FROM bonCommande WHERE numero LIKE 'BC-%' ORDER BY bc_id DESC LIMIT 1");
  let n = 1;
  if (last && last.numero) {
    const parsed = parseInt(last.numero.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(parsed)) n = parsed + 1;
  }
  return `BC-${String(n).padStart(4, '0')}`;
};

const rowToBon = (row) => ({
  bc_id: row.bc_id,
  numero: row.numero,
  demande_par: row.demande_par,
  created_at: row.created_at,
  items: (() => { try { return JSON.parse(row.items_json) || []; } catch { return []; } })()
});

// GET all bons de commande (newest first) — for the history page
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const rows = await getAll('SELECT * FROM bonCommande ORDER BY bc_id DESC');
    res.json(rows.map(rowToBon));
  } catch (error) {
    console.error('Error fetching bons de commande:', error);
    res.status(500).json({ error: 'Failed to fetch bons de commande' });
  }
});

// GET single bon de commande
router.get('/:id', async (req, res) => {
  try {
    await ensureTable();
    const row = await getRow('SELECT * FROM bonCommande WHERE bc_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Bon de commande introuvable' });
    res.json(rowToBon(row));
  } catch (error) {
    console.error('Error fetching bon de commande:', error);
    res.status(500).json({ error: 'Failed to fetch bon de commande' });
  }
});

// POST create a new bon de commande
router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const { demande_par, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article est requis' });
    }

    // Keep only the document fields (no prices)
    const cleanItems = items
      .map(it => ({
        article: (it.article || it.item_name || '').toString().trim(),
        qte: Number(it.qte ?? it.quantity) || 0,
        unite: (it.unite || it.unit || '').toString().trim() || 'U'
      }))
      .filter(it => it.article);

    if (cleanItems.length === 0) {
      return res.status(400).json({ error: 'Au moins un article valide est requis' });
    }

    const numero = await nextNumero();
    const result = await runQuery(
      'INSERT INTO bonCommande (numero, demande_par, items_json) VALUES (?, ?, ?)',
      [numero, (demande_par || '').toString().trim() || 'Inconnu', JSON.stringify(cleanItems)]
    );

    const row = await getRow('SELECT * FROM bonCommande WHERE bc_id = ?', [result.id]);
    res.status(201).json(rowToBon(row));
  } catch (error) {
    console.error('Error creating bon de commande:', error);
    res.status(500).json({ error: 'Failed to create bon de commande', details: error.message });
  }
});

// DELETE a bon de commande (admin cleanup)
router.delete('/:id', async (req, res) => {
  try {
    await ensureTable();
    await runQuery('DELETE FROM bonCommande WHERE bc_id = ?', [req.params.id]);
    res.json({ message: 'Bon de commande supprimé' });
  } catch (error) {
    console.error('Error deleting bon de commande:', error);
    res.status(500).json({ error: 'Failed to delete bon de commande' });
  }
});

export default router;
