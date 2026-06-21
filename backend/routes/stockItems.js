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

// Resolve who made an edit to a valid users.user_id. Accepts a user_id or a
// username. Returns null if it can't be matched (we then skip the audit log
// rather than fail the edit, since auditLogs.user_id is a required foreign key).
const resolveUserId = async (editedBy) => {
  if (editedBy === undefined || editedBy === null || editedBy === '') return null;
  if (typeof editedBy === 'number' || /^\d+$/.test(String(editedBy))) {
    const byId = await getRow('SELECT user_id FROM users WHERE user_id = ?', [Number(editedBy)]);
    if (byId) return byId.user_id;
  }
  const byName = await getRow('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)', [String(editedBy)]);
  return byName ? byName.user_id : null;
};

// Record a manual stock adjustment in the audit log. Never throws — a failure
// to log must not block the stock edit itself.
const logAdjustment = async (itemId, userId, before, after) => {
  if (!userId) {
    console.warn(`Stock adjustment on item ${itemId} not audited: editor user could not be resolved.`);
    return;
  }
  if (before === after) return; // nothing changed
  try {
    await runQuery(
      'INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) VALUES (?, ?, ?, ?, ?)',
      ['adjustment', itemId, userId, before, after]
    );
  } catch (err) {
    console.error('Failed to write stock adjustment audit log:', err.message);
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
    
    const { item_name, quantity, unit, notes, catalog_id, price } = req.body;

    if (!item_name) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const trimmedName = item_name.trim();

    // Check if the item already exists, matching case-insensitively and ignoring
    // surrounding spaces — so "Ciment" / "ciment" / " Ciment " are the same item.
    // We also match soft-deleted rows so a previously removed item is brought
    // back instead of leaving its stock hidden on a ghost row.
    const existingItem = await getRow(
      'SELECT * FROM stockItems WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))',
      [trimmedName]
    );

    if (existingItem) {
      const wasDeleted = !!existingItem.is_deleted;
      // If it was soft-deleted, its quantity was zeroed on delete, so start from
      // the quantity being added. Otherwise add to the current stock (merge).
      const newQuantity = wasDeleted
        ? (quantity || 0)
        : existingItem.quantity + (quantity || 0);

      await runQuery(
        'UPDATE stockItems SET quantity = ?, unit = ?, notes = ?, price = COALESCE(?, price), is_deleted = 0 WHERE item_id = ?',
        [
          newQuantity,
          unit || existingItem.unit,
          notes !== undefined ? notes : existingItem.notes,
          price ?? null,
          existingItem.item_id
        ]
      );

      const updatedItem = await getRow('SELECT * FROM stockItems WHERE item_id = ?', [existingItem.item_id]);
      res.json(updatedItem);
    } else {
      // Create new stock item (store the trimmed name)
      const result = await runQuery(
        'INSERT INTO stockItems (item_name, quantity, unit, notes, price, is_dynamic) VALUES (?, ?, ?, ?, ?, ?)',
        [trimmedName, quantity || 0, unit || 'pcs', notes, price ?? null, 1]
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
    
    const { item_name, quantity, unit, notes, is_dynamic, edited_by, price } = req.body;

    if (!item_name) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    // Capture the quantity before the change so we can audit any adjustment.
    const before = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [req.params.id]);

    // price is optional: COALESCE keeps the existing value when none is sent.
    const result = await runQuery(
      'UPDATE stockItems SET item_name = ?, quantity = ?, unit = ?, notes = ?, is_dynamic = ?, price = COALESCE(?, price) WHERE item_id = ?',
      [item_name, quantity, unit, notes, is_dynamic, price ?? null, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    if (before) {
      const userId = await resolveUserId(edited_by);
      await logAdjustment(Number(req.params.id), userId, before.quantity, Number(quantity));
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
    const { quantity, edited_by } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Capture the quantity before the change so we can audit the adjustment.
    const before = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [req.params.id]);

    const result = await runQuery(
      'UPDATE stockItems SET quantity = ? WHERE item_id = ?',
      [quantity, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Stock item not found' });
    }

    if (before) {
      const userId = await resolveUserId(edited_by);
      await logAdjustment(Number(req.params.id), userId, before.quantity, Number(quantity));
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