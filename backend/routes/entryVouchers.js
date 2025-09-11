import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all entry vouchers
router.get('/', async (req, res) => {
  try {
    const vouchers = await getAll(`
      SELECT ev.*, u.username as added_by_name 
      FROM entryVouchers ev 
      JOIN users u ON ev.added_by = u.user_id 
      ORDER BY ev.date DESC
    `);
    res.json(vouchers);
  } catch (error) {
    console.error('Error fetching entry vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch entry vouchers' });
  }
});

// GET single entry voucher with details
router.get('/:id', async (req, res) => {
  try {
    const voucher = await getRow(`
      SELECT ev.*, u.username as added_by_name 
      FROM entryVouchers ev 
      JOIN users u ON ev.added_by = u.user_id 
      WHERE ev.entry_id = ?
    `, [req.params.id]);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Entry voucher not found' });
    }
    
    // Get voucher details
    const details = await getAll(`
      SELECT ed.*, si.item_name, w.F_Name, w.Surname 
      FROM entryDetails ed
      JOIN stockItems si ON ed.item_id = si.item_id
      JOIN workers w ON ed.worker_id = w.worker_id
      WHERE ed.entry_id = ?
    `, [req.params.id]);
    
    res.json({ ...voucher, details });
  } catch (error) {
    console.error('Error fetching entry voucher:', error);
    res.status(500).json({ error: 'Failed to fetch entry voucher' });
  }
});

// POST create new entry voucher
router.post('/', async (req, res) => {
  try {
    const { added_by, details } = req.body;
    
    if (!added_by || !details || !Array.isArray(details)) {
      return res.status(400).json({ error: 'Added by and details array are required' });
    }
    
    // Create entry voucher
    const voucherResult = await runQuery(
      'INSERT INTO entryVouchers (added_by) VALUES (?)',
      [added_by]
    );
    
    const entryId = voucherResult.id;
    
    // Add details
    for (const detail of details) {
      const { item_id, worker_id, quantity } = detail;
      
      if (!item_id || !worker_id || !quantity) {
        return res.status(400).json({ error: 'Item ID, worker ID, and quantity are required for each detail' });
      }
      
      await runQuery(
        'INSERT INTO entryDetails (entry_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
        [entryId, item_id, worker_id, quantity]
      );
      
      // Update stock quantity
      await runQuery(
        'UPDATE stockItems SET quantity = quantity + ? WHERE item_id = ?',
        [quantity, item_id]
      );
    }
    
    const createdVoucher = await getRow('SELECT * FROM entryVouchers WHERE entry_id = ?', [entryId]);
    res.status(201).json(createdVoucher);
  } catch (error) {
    console.error('Error creating entry voucher:', error);
    res.status(500).json({ error: 'Failed to create entry voucher' });
  }
});

export default router; 