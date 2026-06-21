import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';
import { runTransaction, resolveUserId, applyExitItem, applyExitUnregistered, reverseExitVoucher } from '../database/inventory.js';

const router = express.Router();

let exitSchemaEnsured = false;

const ensureExitVoucherSchema = async () => {
  if (exitSchemaEnsured) return;

  const columns = await getAll('PRAGMA table_info(exitVouchers)');
  const columnNames = columns.map(col => col.name);

  const addColumnIfMissing = async (name, definition) => {
    if (!columnNames.includes(name)) {
      await runQuery(`ALTER TABLE exitVouchers ADD COLUMN ${name} ${definition}`);
    }
  };

  await addColumnIfMissing('voucher_number', 'TEXT');
  await addColumnIfMissing('taken_by', 'INTEGER');
  await addColumnIfMissing('notes', 'TEXT');
  await addColumnIfMissing('place', 'TEXT');

  exitSchemaEnsured = true;
};

// Make sure the "not found" items table exists even before migrations run.
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
  unregisteredEnsured = true;
};

const buildExitVoucherResponse = (vouchers, details, unregistered = []) => {
  const detailsMap = details.reduce((acc, detail) => {
    if (!acc[detail.exit_id]) {
      acc[detail.exit_id] = [];
    }
    acc[detail.exit_id].push({
      exit_detail_id: detail.exit_detail_id,
      item_id: detail.item_id,
      item_name: detail.item_name || 'Article indisponible',
      quantity: detail.quantity,
      worker_id: detail.worker_id,
      worker_name: detail.worker_name,
      is_unregistered: false
    });
    return acc;
  }, {});

  // Append "not found" items so they show on the voucher, flagged.
  unregistered.forEach(item => {
    if (!detailsMap[item.exit_id]) {
      detailsMap[item.exit_id] = [];
    }
    detailsMap[item.exit_id].push({
      exit_detail_id: `u_${item.id}`,
      item_id: null,
      item_name: item.item_name,
      quantity: item.quantity,
      worker_id: item.worker_id,
      worker_name: item.worker_name,
      is_unregistered: true
    });
  });

  return vouchers.map(voucher => ({
    ...voucher,
    taken_by_name: voucher.taken_by_first_name
      ? `${voucher.taken_by_first_name} ${voucher.taken_by_last_name}`.trim()
      : null,
    office_staff: voucher.handled_by_name ? [{ username: voucher.handled_by_name }] : [],
    details: detailsMap[voucher.exit_id] || []
  }));
};

// GET all exit vouchers
router.get('/', async (req, res) => {
  try {
    await ensureExitVoucherSchema();

    const vouchers = await getAll(`
      SELECT ev.*,
             CASE 
               WHEN ev.handled_by = 9997 THEN 'Security'
               ELSE COALESCE(u.username, 'Utilisateur supprimé')
             END as handled_by_name,
             w.F_Name as taken_by_first_name,
             w.Surname as taken_by_last_name
      FROM exitVouchers ev 
      LEFT JOIN users u ON ev.handled_by = u.user_id 
      LEFT JOIN workers w ON ev.taken_by = w.worker_id
      ORDER BY ev.date DESC
    `);

    const details = await getAll(`
      SELECT ed.exit_detail_id,
             ed.exit_id,
             ed.item_id,
             ed.quantity,
             ed.worker_id,
             COALESCE(si.item_name, 'Article supprimé') AS item_name,
             COALESCE(w.F_Name || ' ' || w.Surname, '') AS worker_name
      FROM exitDetails ed
      LEFT JOIN stockItems si ON ed.item_id = si.item_id
      LEFT JOIN workers w ON ed.worker_id = w.worker_id
    `);

    await ensureUnregisteredTable();
    const unregistered = await getAll(`
      SELECT u.id,
             u.exit_id,
             u.item_name,
             u.quantity,
             u.worker_id,
             COALESCE(w.F_Name || ' ' || w.Surname, '') AS worker_name
      FROM exitUnregisteredItems u
      LEFT JOIN workers w ON u.worker_id = w.worker_id
    `);

    res.json(buildExitVoucherResponse(vouchers, details, unregistered));
  } catch (error) {
    console.error('Error fetching exit vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch exit vouchers' });
  }
});

// GET single exit voucher with details
router.get('/:id', async (req, res) => {
  try {
    await ensureExitVoucherSchema();

    const voucher = await getRow(`
      SELECT ev.*,
             COALESCE(u.username, 'Utilisateur supprimé') as handled_by_name,
             w.F_Name as taken_by_first_name,
             w.Surname as taken_by_last_name
      FROM exitVouchers ev 
      LEFT JOIN users u ON ev.handled_by = u.user_id 
      LEFT JOIN workers w ON ev.taken_by = w.worker_id
      WHERE ev.exit_id = ?
    `, [req.params.id]);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Exit voucher not found' });
    }
    
    // Get voucher details
    const details = await getAll(`
      SELECT ed.exit_detail_id,
             ed.exit_id,
             ed.item_id,
             ed.quantity,
             ed.worker_id,
             COALESCE(si.item_name, 'Article supprimé') AS item_name,
             COALESCE(w.F_Name || ' ' || w.Surname, '') AS worker_name
      FROM exitDetails ed
      LEFT JOIN stockItems si ON ed.item_id = si.item_id
      LEFT JOIN workers w ON ed.worker_id = w.worker_id
      WHERE ed.exit_id = ?
    `, [req.params.id]);

    await ensureUnregisteredTable();
    const unregistered = await getAll(`
      SELECT u.id,
             u.exit_id,
             u.item_name,
             u.quantity,
             u.worker_id,
             COALESCE(w.F_Name || ' ' || w.Surname, '') AS worker_name
      FROM exitUnregisteredItems u
      LEFT JOIN workers w ON u.worker_id = w.worker_id
      WHERE u.exit_id = ?
    `, [req.params.id]);

    const mergedDetails = [
      ...details.map(d => ({ ...d, is_unregistered: false })),
      ...unregistered.map(u => ({
        exit_detail_id: `u_${u.id}`,
        exit_id: u.exit_id,
        item_id: null,
        item_name: u.item_name,
        quantity: u.quantity,
        worker_id: u.worker_id,
        worker_name: u.worker_name,
        is_unregistered: true
      }))
    ];

    res.json({
      ...voucher,
      taken_by_name: voucher.taken_by_first_name
        ? `${voucher.taken_by_first_name} ${voucher.taken_by_last_name}`.trim()
        : null,
      office_staff: voucher.handled_by_name ? [{ username: voucher.handled_by_name }] : [],
      details: mergedDetails
    });
  } catch (error) {
    console.error('Error fetching exit voucher:', error);
    res.status(500).json({ error: 'Failed to fetch exit voucher' });
  }
});

// POST create new exit voucher
router.post('/', async (req, res) => {
  try {
    const { voucher_number, date, handled_by, taken_by, place, notes } = req.body;

    await ensureExitVoucherSchema();

    if (!handled_by) {
      return res.status(400).json({ error: 'Handled by is required' });
    }

    console.log('Creating exit voucher with data:', {
      voucher_number, date, handled_by, taken_by, notes
    });

    // Find the user ID for the person who handled this voucher
    // Security users have a special ID and might not be in the users table yet
    let handledByUserId = null;
    
    if (handled_by.toLowerCase() === 'security') {
      // Security user uses a special ID - create the user record if it doesn't exist
      let securityUser = await getRow('SELECT user_id FROM users WHERE user_id = ?', [9997]);
      if (!securityUser) {
        await runQuery(
          'INSERT INTO users (user_id, username, role) VALUES (?, ?, ?)',
          [9997, 'Security', 'security']
        );
      }
      handledByUserId = 9997;
    } else {
      // Look up the regular user by their username
      const handledByUser = await getRow('SELECT user_id FROM users WHERE username = ?', [handled_by]);
      if (!handledByUser) {
        return res.status(400).json({ error: 'Invalid handled_by user' });
      }
      handledByUserId = handledByUser.user_id;
    }

    // Find the worker ID for the person who took the items (case-insensitive, trim spaces)
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

    // Preferred path: the whole voucher + its items are created atomically in a
    // single transaction. If any item fails (e.g. insufficient stock), the whole
    // thing rolls back — no partial voucher, no half-applied stock changes.
    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (items) {
      try {
        const voucherId = await runTransaction(async () => {
          const vr = await runQuery(
            'INSERT INTO exitVouchers (voucher_number, date, handled_by, taken_by, place, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [voucher_number || null, date || new Date().toISOString(), handledByUserId, takenByWorkerId, place || null, notes || null]
          );
          const vid = vr.id;
          for (const it of items) {
            if (it.is_unregistered) {
              await applyExitUnregistered({ voucherId: vid, item_name: it.item_name, quantity: Number(it.quantity), workerId: takenByWorkerId });
            } else {
              await applyExitItem({ voucherId: vid, item_id: it.item_id, quantity: Number(it.quantity), workerId: takenByWorkerId, actorUserId: handledByUserId });
            }
          }
          return vid;
        });
        return res.status(201).json({ voucher_id: voucherId, exit_id: voucherId, message: 'Exit voucher created successfully' });
      } catch (txError) {
        console.error('Transactional exit voucher creation failed:', txError.message);
        return res.status(400).json({ error: 'Failed to create exit voucher', details: txError.message });
      }
    }

    // Try to create the voucher, handling foreign key issues if they come up
    let voucherResult;
    try {
      voucherResult = await runQuery(
        'INSERT INTO exitVouchers (voucher_number, date, handled_by, taken_by, place, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [
          voucher_number || null,
          date || new Date().toISOString(),
          handledByUserId,
          takenByWorkerId,
          place || null,
          notes || null
        ]
      );
    } catch (fkError) {
      // Sometimes foreign key constraints can cause issues, so we temporarily disable them
      if (fkError.message.includes('FOREIGN KEY') || fkError.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        console.log('Foreign key constraint issue detected, attempting workaround...');
        await runQuery('PRAGMA foreign_keys = OFF');
        try {
          voucherResult = await runQuery(
            'INSERT INTO exitVouchers (voucher_number, date, handled_by, taken_by, place, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [
              voucher_number || null,
              date || new Date().toISOString(),
              handledByUserId,
              takenByWorkerId,
              place || null,
              notes || null
            ]
          );
        } finally {
          // Always re-enable foreign keys after the insert
          await runQuery('PRAGMA foreign_keys = ON');
        }
      } else {
        throw fkError;
      }
    }

    console.log('Exit voucher created with ID:', voucherResult.id);

    res.status(201).json({
      voucher_id: voucherResult.id,
      exit_id: voucherResult.id, // Also include exit_id for clarity
      message: 'Exit voucher created successfully'
    });
  } catch (error) {
    console.error('Error creating exit voucher:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to create exit voucher',
      details: error.message 
    });
  }
});

// DELETE single exit voucher
router.delete('/:id', async (req, res) => {
  try {
    const voucher = await getRow('SELECT * FROM exitVouchers WHERE exit_id = ?', [req.params.id]);
    if (!voucher) return res.status(404).json({ error: 'Bon introuvable' });

    await ensureUnregisteredTable();
    // Deleting an exit voucher returns its items to stock (reverse the exit),
    // then removes the voucher — all atomically.
    const actorUserId = (await resolveUserId(req.body?.deleted_by)) ?? voucher.handled_by;
    await runTransaction(async () => {
      await reverseExitVoucher(req.params.id, actorUserId);
      await runQuery('DELETE FROM exitDetails WHERE exit_id = ?', [req.params.id]);
      await runQuery('DELETE FROM exitUnregisteredItems WHERE exit_id = ?', [req.params.id]);
      await runQuery('DELETE FROM exitVouchers WHERE exit_id = ?', [req.params.id]);
    });
    res.json({ message: 'Bon supprimé' });
  } catch (error) {
    console.error('Error deleting exit voucher:', error);
    res.status(500).json({ error: 'Failed to delete exit voucher' });
  }
});

// DELETE all exit vouchers
router.delete('/', async (req, res) => {
  try {
    await ensureUnregisteredTable();
    await runQuery('DELETE FROM exitDetails', []);
    await runQuery('DELETE FROM exitUnregisteredItems', []);
    await runQuery('DELETE FROM exitVouchers', []);
    res.json({ message: 'Tous les bons de sortie supprimés' });
  } catch (error) {
    console.error('Error resetting exit vouchers:', error);
    res.status(500).json({ error: 'Failed to reset exit vouchers' });
  }
});

export default router; 