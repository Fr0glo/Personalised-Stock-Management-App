import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all stock items (only items with actual stock)
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM stockItems WHERE quantity > 0';
    let params = [];

    // Add search functionality
    if (search) {
      query += ' AND item_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY item_name';

    const stockItems = await getAll(query, params);
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

// POST create new stock item (from catalog or new)
router.post('/', async (req, res) => {
  try {
    const { item_name, quantity, unit, notes, catalog_id } = req.body;
    
    if (!item_name) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    
    // Check if item already exists in stock
    const existingItem = await getRow('SELECT * FROM stockItems WHERE item_name = ?', [item_name]);
    
    if (existingItem) {
      // Update existing stock
      const newQuantity = existingItem.quantity + (quantity || 0);
      await runQuery(
        'UPDATE stockItems SET quantity = ?, unit = ?, notes = ? WHERE item_id = ?',
        [newQuantity, unit || existingItem.unit, notes || existingItem.notes, existingItem.item_id]
      );
      
      const updatedItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [existingItem.item_id]);
      res.json(updatedItem);
    } else {
      // Create new stock item
      const result = await runQuery(
        'INSERT INTO stockItems (item_name, quantity, unit, notes, is_dynamic) VALUES (?, ?, ?, ?, ?)',
        [item_name, quantity || 0, unit || 'pcs', notes, 1]
      );
      
      const createdItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [result.lastID]);
      res.status(201).json(createdItem);
    }
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

// PUT update stock quantity only
router.put('/:id/quantity', async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }
    
    const result = await runQuery(
      'UPDATE stockItems SET quantity = ? WHERE item_id = ?',
      [quantity, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    
    const updatedItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [req.params.id]);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating stock quantity:', error);
    res.status(500).json({ error: 'Failed to update stock quantity' });
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