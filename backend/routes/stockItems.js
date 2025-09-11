import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all stock items
router.get('/', async (req, res) => {
  try {
    const stockItems = await getAll('SELECT * FROM stockItems ORDER BY item_name');
    res.json(stockItems);
  } catch (error) {
    console.error('Error fetching stock items:', error);
    res.status(500).json({ error: 'Failed to fetch stock items' });
  }
});

// GET single stock item
router.get('/:id', async (req, res) => {
  try {
    const stockItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [req.params.id]);
    
    if (!stockItem) {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    
    res.json(stockItem);
  } catch (error) {
    console.error('Error fetching stock item:', error);
    res.status(500).json({ error: 'Failed to fetch stock item' });
  }
});

// POST create new stock item
router.post('/', async (req, res) => {
  try {
    const { item_name, quantity, unit, notes, is_dynamic } = req.body;
    
    if (!item_name) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    
    const result = await runQuery(
      'INSERT INTO stockItems (item_name, quantity, unit, notes, is_dynamic) VALUES (?, ?, ?, ?, ?)',
      [item_name, quantity || 0, unit || 'pcs', notes, is_dynamic !== undefined ? is_dynamic : 1]
    );
    
    const createdItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [result.id]);
    res.status(201).json(createdItem);
  } catch (error) {
    console.error('Error creating stock item:', error);
    res.status(500).json({ error: 'Failed to create stock item' });
  }
});

// PUT update stock item
router.put('/:id', async (req, res) => {
  try {
    const { item_name, quantity, unit, notes, is_dynamic } = req.body;
    
    if (!item_name) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    
    const result = await runQuery(
      'UPDATE stockItems SET item_name = ?, quantity = ?, unit = ?, notes = ?, is_dynamic = ? WHERE item_id = ?',
      [item_name, quantity, unit, notes, is_dynamic, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    
    const updatedItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [req.params.id]);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating stock item:', error);
    res.status(500).json({ error: 'Failed to update stock item' });
  }
});

// DELETE stock item
router.delete('/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM stockItems WHERE item_id = ?', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    
    res.json({ message: 'Stock item deleted successfully' });
  } catch (error) {
    console.error('Error deleting stock item:', error);
    res.status(500).json({ error: 'Failed to delete stock item' });
  }
});

export default router; 