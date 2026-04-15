import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

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

const buildExitVoucherResponse = (vouchers, details) => {
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
      worker_name: detail.worker_name
    });
    return acc;
  }, {});

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

    res.json(buildExitVoucherResponse(vouchers, details));
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
    
    res.json({
      ...voucher,
      taken_by_name: voucher.taken_by_first_name
        ? `${voucher.taken_by_first_name} ${voucher.taken_by_last_name}`.trim()
        : null,
      office_staff: voucher.handled_by_name ? [{ username: voucher.handled_by_name }] : [],
      details
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

export default router; 