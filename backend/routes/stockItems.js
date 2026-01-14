import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// Ensure stockItems schema has is_deleted column
let stockSchemaEnsured = false;

const ensureStockItemsSchema = async () => {
  if (stockSchemaEnsured) return;

  try {
    const columns = await getAll('PRAGMA table_info(stockItems)');
    const columnNames = columns.map(col => col.name);

    if (!columnNames.includes('is_deleted')) {
      await runQuery('ALTER TABLE stockItems ADD COLUMN is_deleted INTEGER DEFAULT 0');
    }

    if (!columnNames.includes('place')) {
      await runQuery('ALTER TABLE stockItems ADD COLUMN place TEXT');
    }

    stockSchemaEnsured = true;
  } catch (error) {
    console.error('Error ensuring stockItems schema:', error);
    // Continue anyway - COALESCE will handle missing column
  }
};

// GET all stock items (only items with actual stock by default)
router.get('/', async (req, res) => {
  try {
    await ensureStockItemsSchema();
    
    const { search, limit = 100, includeZero = false, includePending = false } = req.query; // Default limit of 100 for performance
    // Exclude soft-deleted items from normal queries
    let query = includeZero === 'true' 
      ? 'SELECT si.* FROM stockItems si WHERE COALESCE(si.is_deleted, 0) = 0' 
      : 'SELECT si.* FROM stockItems si WHERE si.quantity > 0 AND COALESCE(si.is_deleted, 0) = 0';
    let params = [];

    // Add search functionality
    if (search) {
      query += ' AND si.item_name LIKE ?';
      params.push(`%${search}%`);
    }

    // If includePending is true, calculate pending quantities from orders
    if (includePending === 'true') {
      query = `
        SELECT 
          si.*,
          COALESCE(SUM(CASE WHEN o.status = 'pending' THEN oi.quantity ELSE 0 END), 0) as pending_quantity
        FROM stockItems si
        LEFT JOIN orderItems oi ON LOWER(oi.item_name) = LOWER(si.item_name)
        LEFT JOIN orders o ON oi.order_id = o.order_id AND o.status = 'pending'
        WHERE COALESCE(si.is_deleted, 0) = 0
        ${includeZero === 'true' ? '' : 'AND si.quantity > 0'}
        ${search ? 'AND si.item_name LIKE ?' : ''}
        GROUP BY si.item_id
      `;
      if (search) {
        params.push(`%${search}%`);
      }
    }

    query += ' ORDER BY si.item_name';
    
    // Add limit for performance (prevents loading thousands of items)
    if (limit && parseInt(limit) > 0) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

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
    await ensureStockItemsSchema();
    
    const stockItem = await getRow('SELECT * FROM stockItems WHERE item_id = ? AND COALESCE(is_deleted, 0) = 0', [req.params.id]);
    
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
    await ensureStockItemsSchema();
    
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
      
      const createdItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [result.id]);
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
    await ensureStockItemsSchema();
    
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

// DELETE stock item (soft delete - preserves voucher history and audit logs)
router.delete('/:id', async (req, res) => {
  try {
    await ensureStockItemsSchema();
    
    // Check if item exists and is not already deleted
    const item = await getRow('SELECT * FROM stockItems WHERE item_id = ? AND COALESCE(is_deleted, 0) = 0', [req.params.id]);
    
    if (!item) {
      return res.status(404).json({ error: 'Stock item not found or already deleted' });
    }

    // Use soft delete: mark item as deleted instead of actually deleting it
    // This preserves voucher history and audit logs

    // Mark item as deleted (soft delete)
    const result = await runQuery(
      'UPDATE stockItems SET is_deleted = 1, quantity = 0 WHERE item_id = ?',
      [req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }
    
    res.json({ 
      message: 'Stock item deleted successfully (preserving voucher history and audit logs)',
      deletedItem: item.item_name
    });
  } catch (error) {
    console.error('Error deleting stock item:', error);
    res.status(500).json({ 
      error: 'Failed to delete stock item',
      details: error.message 
    });
  }
});

export default router; 