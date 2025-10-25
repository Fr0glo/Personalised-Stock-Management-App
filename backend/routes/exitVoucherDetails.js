import express from 'express';
import { runQuery, getRow, getAll } from '../database/connection.js';

const router = express.Router();

// Get all exit voucher details
router.get('/', async (req, res) => {
  try {
    const details = await getAll('SELECT * FROM exitDetails');
    res.json(details);
  } catch (error) {
    console.error('Error fetching exit voucher details:', error);
    res.status(500).json({ error: 'Failed to fetch exit voucher details' });
  }
});

// Get details for a specific voucher
router.get('/voucher/:voucherId', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const details = await getAll(
      'SELECT ed.*, si.item_name, si.unit FROM exitDetails ed JOIN stockItems si ON ed.item_id = si.item_id WHERE ed.voucher_id = ?',
      [voucherId]
    );
    res.json(details);
  } catch (error) {
    console.error('Error fetching voucher details:', error);
    res.status(500).json({ error: 'Failed to fetch voucher details' });
  }
});

// Add item to exit voucher
router.post('/', async (req, res) => {
  try {
    const { voucher_id, item_id, quantity } = req.body;

    console.log('🔍 Received data:', { voucher_id, item_id, quantity });
    console.log('🔍 Data types:', {
      voucher_id_type: typeof voucher_id,
      item_id_type: typeof item_id,
      quantity_type: typeof quantity
    });
    console.log('🔍 Data values:', {
      voucher_id_value: voucher_id,
      item_id_value: item_id,
      quantity_value: quantity
    });

    if (!voucher_id || !item_id || quantity === undefined || quantity <= 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { voucher_id, item_id, quantity },
        required: ['voucher_id', 'item_id', 'quantity > 0'],
        validation: {
          voucher_id_valid: !!voucher_id,
          item_id_valid: !!item_id,
          quantity_valid: quantity !== undefined && quantity > 0
        }
      });
    }

    // First, check if enough stock is available
    const currentStock = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [item_id]);
    
    if (!currentStock || currentStock.quantity < quantity) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${currentStock?.quantity || 0}, Requested: ${quantity}` 
      });
    }

    // Insert into exitDetails
    const result = await runQuery(
      'INSERT INTO exitDetails (exit_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
      [voucher_id, item_id, 1, quantity] // Using worker_id = 1 as default
    );

    // Reduce stock quantity
    console.log(`🔍 Reducing stock: item_id=${item_id}, quantity=${quantity}`);
    const stockResult = await runQuery(
      'UPDATE stockItems SET quantity = quantity - ? WHERE item_id = ?',
      [quantity, item_id]
    );
    console.log(`📊 Stock update result:`, stockResult);
    
    // Check if stock quantity is now 0 or negative, and delete the item if so
    const updatedStock = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [item_id]);
    if (updatedStock && updatedStock.quantity <= 0) {
      console.log(`🗑️ Deleting item with zero/negative stock: item_id=${item_id}`);
      await runQuery('DELETE FROM stockItems WHERE item_id = ?', [item_id]);
      console.log(`✅ Item deleted from stock`);
    }

    res.status(201).json({
      detail_id: result.lastID,
      message: 'Item added to exit voucher successfully'
    });
  } catch (error) {
    console.error('❌ Error adding item to exit voucher:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to add item to exit voucher',
      details: error.message 
    });
  }
});

// Update exit voucher detail
router.put('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;
    const { quantity, unit } = req.body;

    await runQuery(
      'UPDATE exitDetails SET quantity = ?, unit = ? WHERE detail_id = ?',
      [quantity, unit, detailId]
    );

    res.json({ message: 'Exit voucher detail updated successfully' });
  } catch (error) {
    console.error('Error updating exit voucher detail:', error);
    res.status(500).json({ error: 'Failed to update exit voucher detail' });
  }
});

// Delete exit voucher detail
router.delete('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;

    await runQuery('DELETE FROM exitDetails WHERE detail_id = ?', [detailId]);

    res.json({ message: 'Exit voucher detail deleted successfully' });
  } catch (error) {
    console.error('Error deleting exit voucher detail:', error);
    res.status(500).json({ error: 'Failed to delete exit voucher detail' });
  }
});

export default router;
