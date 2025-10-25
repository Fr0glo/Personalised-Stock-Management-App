import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all exit vouchers
router.get('/', async (req, res) => {
  try {
    const vouchers = await getAll(`
      SELECT ev.*, u.username as handled_by_name 
      FROM exitVouchers ev 
      JOIN users u ON ev.handled_by = u.user_id 
      ORDER BY ev.date DESC
    `);
    res.json(vouchers);
  } catch (error) {
    console.error('Error fetching exit vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch exit vouchers' });
  }
});

// GET single exit voucher with details
router.get('/:id', async (req, res) => {
  try {
    const voucher = await getRow(`
      SELECT ev.*, u.username as handled_by_name 
      FROM exitVouchers ev 
      JOIN users u ON ev.handled_by = u.user_id 
      WHERE ev.exit_id = ?
    `, [req.params.id]);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Exit voucher not found' });
    }
    
    // Get voucher details
    const details = await getAll(`
      SELECT ed.*, si.item_name, w.F_Name, w.Surname 
      FROM exitDetails ed
      JOIN stockItems si ON ed.item_id = si.item_id
      JOIN workers w ON ed.worker_id = w.worker_id
      WHERE ed.exit_id = ?
    `, [req.params.id]);
    
    res.json({ ...voucher, details });
  } catch (error) {
    console.error('Error fetching exit voucher:', error);
    res.status(500).json({ error: 'Failed to fetch exit voucher' });
  }
});

// POST create new exit voucher
router.post('/', async (req, res) => {
  try {
    const { voucher_number, date, handled_by, taken_by, notes } = req.body;
    
    if (!handled_by) {
      return res.status(400).json({ error: 'Handled by is required' });
    }
    
    // Create exit voucher
    console.log('🔍 Creating exit voucher with data:', {
      voucher_number, date, handled_by, taken_by, notes
    });
    
    const voucherResult = await runQuery(
      'INSERT INTO exitVouchers (voucher_number, date, handled_by, taken_by, notes) VALUES (?, ?, ?, ?, ?)',
      [voucher_number, date, 1, taken_by, notes] // Using user_id = 1 as default for handled_by
    );
    
    console.log('✅ Exit voucher created with result:', voucherResult);
    console.log('✅ Exit voucher ID:', voucherResult.id);
    
    if (!voucherResult.id) {
      console.error('❌ No ID returned from database insert');
      return res.status(500).json({ error: 'Failed to get voucher ID' });
    }
    
    res.status(201).json({ 
      voucher_id: voucherResult.id, 
      message: 'Exit voucher created successfully' 
    });
  } catch (error) {
    console.error('Error creating exit voucher:', error);
    res.status(500).json({ error: 'Failed to create exit voucher' });
  }
});

export default router; 