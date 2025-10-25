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
    const { voucher_number, date, handled_by, taken_by, notes } = req.body;
    
    if (!handled_by) {
      return res.status(400).json({ error: 'Handled by is required' });
    }
    
    // Create entry voucher
    const voucherResult = await runQuery(
      'INSERT INTO entryVouchers (voucher_number, date, handled_by, taken_by, notes, added_by) VALUES (?, ?, ?, ?, ?, ?)',
      [voucher_number, date, handled_by, taken_by, notes, 1] // Using user_id = 1 as default
    );
    
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