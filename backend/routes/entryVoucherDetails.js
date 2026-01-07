import express from 'express';
import { runQuery, getRow, getAll } from '../database/connection.js';

const router = express.Router();

// Get all entry voucher details
router.get('/', async (req, res) => {
  try {
    const details = await getAll('SELECT * FROM entryDetails');
    res.json(details);
  } catch (error) {
    console.error('Error fetching entry voucher details:', error);
    res.status(500).json({ error: 'Failed to fetch entry voucher details' });
  }
});

// Get details for a specific voucher
router.get('/voucher/:voucherId', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const details = await getAll(
      'SELECT ed.*, si.item_name, si.unit FROM entryDetails ed JOIN stockItems si ON ed.item_id = si.item_id WHERE ed.entry_id = ?',
      [voucherId]
    );
    res.json(details);
  } catch (error) {
    console.error('Error fetching voucher details:', error);
    res.status(500).json({ error: 'Failed to fetch voucher details' });
  }
});

// Add item to entry voucher
router.post('/', async (req, res) => {
  try {
    const { voucher_id, item_id, quantity, unit } = req.body;

    console.log('🔍 Entry voucher details request:', req.body);
    console.log('🔍 Validation:', {
      voucher_id: !!voucher_id,
      item_id: !!item_id,
      quantity: !!quantity,
      voucher_id_value: voucher_id,
      item_id_value: item_id,
      quantity_value: quantity
    });

    if (!voucher_id || !item_id || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { voucher_id, item_id, quantity },
        required: ['voucher_id', 'item_id', 'quantity']
      });
    }

    // Get current stock quantity before adding
    const currentStock = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [item_id]);
    const quantityBefore = currentStock ? currentStock.quantity : 0;
    const quantityAfter = quantityBefore + Number(quantity);

    // Insert entry detail
    console.log('🔍 Inserting entry detail:', {
      entry_id: voucher_id,
      item_id: item_id,
      worker_id: 1,
      quantity: quantity
    });
    
    const result = await runQuery(
      'INSERT INTO entryDetails (entry_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
      [voucher_id, item_id, 1, quantity] // Using worker_id = 1 as default
    );
    
    console.log('✅ Entry detail inserted with ID:', result.id);

    // Update stock quantity
    await runQuery(
      'UPDATE stockItems SET quantity = ? WHERE item_id = ?',
      [quantityAfter, item_id]
    );

    // Get voucher details to find who handled it
    const voucher = await getRow('SELECT added_by FROM entryVouchers WHERE entry_id = ?', [voucher_id]);
    
    // Log audit trail
    await runQuery(
      'INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) VALUES (?, ?, ?, ?, ?)',
      ['entry', item_id, voucher ? voucher.added_by : 1, quantityBefore, quantityAfter]
    );

    console.log('📊 Stock updated:', {
      item_id,
      quantity_before: quantityBefore,
      quantity_added: quantity,
      quantity_after: quantityAfter,
      handled_by_user: voucher ? voucher.added_by : 1
    });

    res.status(201).json({
      detail_id: result.id,
      message: 'Item added to entry voucher successfully, stock updated and audit logged'
    });
  } catch (error) {
    console.error('Error adding item to entry voucher:', error);
    res.status(500).json({ error: 'Failed to add item to entry voucher' });
  }
});

// Update entry voucher detail
router.put('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;
    const { quantity, unit } = req.body;

    await runQuery(
      'UPDATE entryDetails SET quantity = ?, unit = ? WHERE detail_id = ?',
      [quantity, unit, detailId]
    );

    res.json({ message: 'Entry voucher detail updated successfully' });
  } catch (error) {
    console.error('Error updating entry voucher detail:', error);
    res.status(500).json({ error: 'Failed to update entry voucher detail' });
  }
});

// Delete entry voucher detail
router.delete('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;

    await runQuery('DELETE FROM entryDetails WHERE detail_id = ?', [detailId]);

    res.json({ message: 'Entry voucher detail deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry voucher detail:', error);
    res.status(500).json({ error: 'Failed to delete entry voucher detail' });
  }
});

export default router;
