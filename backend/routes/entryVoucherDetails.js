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

    if (!voucher_id || !item_id || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await runQuery(
      'INSERT INTO entryDetails (entry_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
      [voucher_id, item_id, 1, quantity] // Using worker_id = 1 as default
    );

    res.status(201).json({
      detail_id: result.lastID,
      message: 'Item added to entry voucher successfully'
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
