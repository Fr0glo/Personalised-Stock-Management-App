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
    const { handled_by, details } = req.body;
    
    if (!handled_by || !details || !Array.isArray(details)) {
      return res.status(400).json({ error: 'Handled by and details array are required' });
    }
    
    // Create exit voucher
    const voucherResult = await runQuery(
      'INSERT INTO exitVouchers (handled_by) VALUES (?)',
      [handled_by]
    );
    
    const exitId = voucherResult.id;
    
    // Add details
    for (const detail of details) {
      const { item_id, worker_id, quantity } = detail;
      
      if (!item_id || !worker_id || !quantity) {
        return res.status(400).json({ error: 'Item ID, worker ID, and quantity are required for each detail' });
      }
      
      // Check if enough stock is available
      const currentStock = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [item_id]);
      
      if (!currentStock || currentStock.quantity < quantity) {
        return res.status(400).json({ error: `Insufficient stock for item ID ${item_id}. Available: ${currentStock?.quantity || 0}, Requested: ${quantity}` });
      }
      
      await runQuery(
        'INSERT INTO exitDetails (exit_id, worker_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [exitId, worker_id, item_id, quantity]
      );
      
      // Update stock quantity
      await runQuery(
        'UPDATE stockItems SET quantity = quantity - ? WHERE item_id = ?',
        [quantity, item_id]
      );
    }
    
    const createdVoucher = await getRow('SELECT * FROM exitVouchers WHERE exit_id = ?', [exitId]);
    res.status(201).json(createdVoucher);
  } catch (error) {
    console.error('Error creating exit voucher:', error);
    res.status(500).json({ error: 'Failed to create exit voucher' });
  }
});

export default router; 