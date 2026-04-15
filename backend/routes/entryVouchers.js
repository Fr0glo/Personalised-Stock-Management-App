import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

let entrySchemaEnsured = false;

const ensureEntryVoucherSchema = async () => {
  if (entrySchemaEnsured) return;

  const columns = await getAll('PRAGMA table_info(entryVouchers)');
  const columnNames = columns.map(col => col.name);

  const addColumnIfMissing = async (name, definition) => {
    if (!columnNames.includes(name)) {
      await runQuery(`ALTER TABLE entryVouchers ADD COLUMN ${name} ${definition}`);
    }
  };

  await addColumnIfMissing('voucher_number', 'TEXT');
  await addColumnIfMissing('taken_by', 'INTEGER');
  await addColumnIfMissing('notes', 'TEXT');
  await addColumnIfMissing('place', 'TEXT');

  entrySchemaEnsured = true;
};

const buildVoucherResponse = (vouchers, details) => {
  const detailsMap = details.reduce((acc, detail) => {
    if (!acc[detail.entry_id]) {
      acc[detail.entry_id] = [];
    }
    acc[detail.entry_id].push({
      entry_detail_id: detail.entry_detail_id,
      item_id: detail.item_id,
      item_name: detail.item_name,
      quantity: detail.quantity,
      worker_id: detail.worker_id,
      worker_name: detail.worker_name
    });
    return acc;
  }, {});

  return vouchers.map(voucher => ({
    ...voucher,
    taken_by_name: voucher.taken_by_first_name
      ? `${voucher.taken_by_first_name} ${voucher.taken_by_last_name}`.trim()
      : null,
    office_staff: voucher.added_by_name ? [{ username: voucher.added_by_name }] : [],
    details: detailsMap[voucher.entry_id] || []
  }));
};

// GET all entry vouchers
router.get('/', async (req, res) => {
  try {
    await ensureEntryVoucherSchema();

    const vouchers = await getAll(`
      SELECT ev.*, 
             CASE 
               WHEN ev.added_by = 9997 THEN 'Security'
               ELSE COALESCE(u.username, 'Utilisateur supprimé')
             END as added_by_name,
             w.F_Name as taken_by_first_name,
             w.Surname as taken_by_last_name
      FROM entryVouchers ev 
      LEFT JOIN users u ON ev.added_by = u.user_id 
      LEFT JOIN workers w ON ev.taken_by = w.worker_id
      ORDER BY ev.date DESC
    `);

    const details = await getAll(`
      SELECT ed.entry_detail_id,
             ed.entry_id,
             ed.item_id,
             ed.quantity,
             ed.worker_id,
             COALESCE(si.item_name, 'Article supprimé') AS item_name,
             COALESCE(w.F_Name || ' ' || w.Surname, '') AS worker_name
      FROM entryDetails ed
      LEFT JOIN stockItems si ON ed.item_id = si.item_id
      LEFT JOIN workers w ON ed.worker_id = w.worker_id
    `);

    res.json(buildVoucherResponse(vouchers, details));
  } catch (error) {
    console.error('Error fetching entry vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch entry vouchers' });
  }
});

// GET single entry voucher with details
router.get('/:id', async (req, res) => {
  try {
    await ensureEntryVoucherSchema();

    const voucher = await getRow(`
      SELECT ev.*, 
             COALESCE(u.username, 'Utilisateur supprimé') as added_by_name,
             w.F_Name as taken_by_first_name,
             w.Surname as taken_by_last_name
      FROM entryVouchers ev 
      LEFT JOIN users u ON ev.added_by = u.user_id 
      LEFT JOIN workers w ON ev.taken_by = w.worker_id
      WHERE ev.entry_id = ?
    `, [req.params.id]);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Entry voucher not found' });
    }
    
    // Get voucher details
    const details = await getAll(`
      SELECT ed.entry_detail_id,
             ed.entry_id,
             ed.quantity,
             ed.item_id,
             COALESCE(si.item_name, 'Article supprimé') AS item_name,
             ed.worker_id,
             COALESCE(w.F_Name || ' ' || w.Surname, '') AS worker_name
      FROM entryDetails ed
      LEFT JOIN stockItems si ON ed.item_id = si.item_id
      LEFT JOIN workers w ON ed.worker_id = w.worker_id
      WHERE ed.entry_id = ?
    `, [req.params.id]);
    
    res.json({
      ...voucher,
      taken_by_name: voucher.taken_by_first_name
        ? `${voucher.taken_by_first_name} ${voucher.taken_by_last_name}`.trim()
        : null,
      office_staff: voucher.added_by_name ? [{ username: voucher.added_by_name }] : [],
      details
    });
  } catch (error) {
    console.error('Error fetching entry voucher:', error);
    res.status(500).json({ error: 'Failed to fetch entry voucher' });
  }
});

// POST create new entry voucher
router.post('/', async (req, res) => {
  try {
    const { voucher_number, date, handled_by, taken_by, place, notes } = req.body;
    
    await ensureEntryVoucherSchema();

    console.log('Creating entry voucher with data:', req.body);
    
    if (!handled_by) {
      return res.status(400).json({ error: 'Handled by is required' });
    }
    
    // Look up the user ID from the username
    const handledByUser = await getRow('SELECT user_id FROM users WHERE username = ?', [handled_by]);
    if (!handledByUser) {
      return res.status(400).json({ error: 'Invalid handled_by user' });
    }
    
    // Look up the worker ID from the worker's name (case-insensitive, trim spaces)
    let takenByWorkerId = null;
    if (taken_by && typeof taken_by === 'string' && taken_by.trim()) {
      const nameParts = taken_by.trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts.shift()?.trim() || '';
      const lastName = nameParts.join(' ').trim() || null;
      let worker = null;
      if (lastName) {
        worker = await getRow(
          `SELECT worker_id FROM workers 
           WHERE LOWER(TRIM(F_Name)) = LOWER(?) AND LOWER(TRIM(Surname)) = LOWER(?)`,
          [firstName, lastName]
        );
        if (!worker) {
          worker = await getRow(
            `SELECT worker_id FROM workers 
             WHERE LOWER(TRIM(F_Name)) = LOWER(?) AND LOWER(TRIM(Surname)) = LOWER(?)`,
            [lastName, firstName]
          );
        }
      }
      if (!worker && firstName) {
        worker = await getRow(
          `SELECT worker_id FROM workers WHERE LOWER(TRIM(F_Name)) = LOWER(?) LIMIT 1`,
          [firstName]
        );
      }
      if (worker) {
        takenByWorkerId = worker.worker_id;
      } else {
        return res.status(400).json({
          error: 'Worker not found',
          details: `No personnel found for "${taken_by.trim()}". Check spelling or add them in Personnel.`
        });
      }
    }
    
    console.log('Converted user and worker names to IDs:', {
      handled_by_user_id: handledByUser.user_id,
      taken_by_worker_id: takenByWorkerId
    });
    
    // Create the entry voucher record in the database
    const voucherResult = await runQuery(
      'INSERT INTO entryVouchers (voucher_number, date, added_by, taken_by, place, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [
        voucher_number || null,
        date || new Date().toISOString(),
        handledByUser.user_id,
        takenByWorkerId,
        place || null,
        notes || null
      ]
    );
    
    console.log('Entry voucher created with ID:', voucherResult.id);
    
    res.status(201).json({ 
      voucher_id: voucherResult.id, 
      message: 'Entry voucher created successfully' 
    });
  } catch (error) {
    console.error('Error creating entry voucher:', error);
    res.status(500).json({ error: 'Failed to create entry voucher' });
  }
});

export default router; 