import express from 'express';
import { runQuery, getRow, getAll } from '../database/connection.js';
import { runTransaction, resolveUserId, writeAudit } from '../database/inventory.js';

const router = express.Router();

// Make sure the table for "not found" items exists, even if migrations were not
// run yet. Items recorded here left the depot but are not in the stock.
let unregisteredEnsured = false;
const ensureUnregisteredTable = async () => {
  if (unregisteredEnsured) return;
  await runQuery(`
    CREATE TABLE IF NOT EXISTS exitUnregisteredItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exit_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      worker_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (exit_id) REFERENCES exitVouchers (exit_id),
      FOREIGN KEY (worker_id) REFERENCES workers (worker_id)
    )
  `);
  unregisteredEnsured = true;
};

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
      'SELECT ed.*, si.item_name, si.unit FROM exitDetails ed LEFT JOIN stockItems si ON ed.item_id = si.item_id WHERE ed.voucher_id = ?',
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
    const { voucher_id, item_id, quantity, is_unregistered, item_name } = req.body;

    console.log('Received data for exit voucher detail:', { voucher_id, item_id, quantity, is_unregistered });

    // "Not found" item: it left the depot but is not in the stock. We only record
    // it on the voucher for tracking — no stock check, no stock reduction.
    if (is_unregistered) {
      if (!voucher_id || !item_name || !item_name.toString().trim() || quantity === undefined || quantity <= 0) {
        return res.status(400).json({
          error: 'Missing required fields for unregistered item',
          received: { voucher_id, item_name, quantity },
          required: ['voucher_id', 'item_name', 'quantity > 0']
        });
      }

      await ensureUnregisteredTable();

      // Reuse the worker recorded on the voucher (who took the items).
      const voucher = await getRow('SELECT taken_by FROM exitVouchers WHERE exit_id = ?', [voucher_id]);
      const result = await runQuery(
        'INSERT INTO exitUnregisteredItems (exit_id, item_name, quantity, worker_id) VALUES (?, ?, ?, ?)',
        [voucher_id, item_name.toString().trim(), quantity, voucher?.taken_by || null]
      );

      console.log('Unregistered (not-found) item recorded with ID:', result.id);
      return res.status(201).json({
        detail_id: result.id,
        unregistered: true,
        message: 'Unregistered item recorded on voucher (stock unchanged)'
      });
    }

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

    // Get voucher to map responsible users
    const voucher = await getRow('SELECT handled_by, taken_by FROM exitVouchers WHERE exit_id = ?', [voucher_id]);

    // Add this item to the exit voucher details
    // Note: exitDetails table uses exit_id, which is the same as voucher_id
    const result = await runQuery(
      'INSERT INTO exitDetails (exit_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
      [voucher_id, item_id, voucher?.taken_by || (await getRow('SELECT MIN(worker_id) AS id FROM workers'))?.id || null, quantity]
    );
    
    console.log('Exit detail inserted with ID:', result.id);

    // Calculate stock quantities before and after the reduction
    const quantityBefore = currentStock.quantity;
    const quantityAfter = quantityBefore - Number(quantity);

    // Reduce the stock quantity for this item
    console.log(`Reducing stock: item_id=${item_id}, quantity=${quantity}`);
    const stockResult = await runQuery(
      'UPDATE stockItems SET quantity = quantity - ? WHERE item_id = ?',
      [quantity, item_id]
    );
    console.log('Stock update completed:', stockResult);
    
    // Record this change in the audit log for tracking
    await runQuery(
      'INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) VALUES (?, ?, ?, ?, ?)',
      ['exit', item_id, voucher ? voucher.handled_by : 1, quantityBefore, quantityAfter]
    );

    console.log('Stock reduced successfully:', {
      item_id,
      quantity_before: quantityBefore,
      quantity_removed: quantity,
      quantity_after: quantityAfter,
      handled_by_user: voucher ? voucher.handled_by : 1
    });
    
    // Ensure stock quantity doesn't drop below zero
    const updatedStock = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [item_id]);
    if (updatedStock && updatedStock.quantity < 0) {
      await runQuery('UPDATE stockItems SET quantity = 0 WHERE item_id = ?', [item_id]);
    }

    // Check if this item matches any pending order and mark order as completed
    try {
      const stockItem = await getRow('SELECT item_name FROM stockItems WHERE item_id = ?', [item_id]);
      if (stockItem) {
        // Find pending orders that contain this item
        const matchingOrders = await getAll(`
          SELECT DISTINCT o.order_id
          FROM orders o
          JOIN orderItems oi ON o.order_id = oi.order_id
          WHERE o.status = 'pending' 
            AND LOWER(oi.item_name) = LOWER(?)
        `, [stockItem.item_name]);

        // For each matching order, check if all items have been delivered
        for (const order of matchingOrders) {
          const orderItems = await getAll(
            'SELECT item_name, quantity FROM orderItems WHERE order_id = ?',
            [order.order_id]
          );
          
          // Check if we can find exit vouchers that cover all items in this order
          let allItemsDelivered = true;
          for (const orderItem of orderItems) {
            // Check if there are exit vouchers with enough quantity for this item
            const deliveredQuantity = await getRow(`
              SELECT COALESCE(SUM(ed.quantity), 0) as total_delivered
              FROM exitDetails ed
              JOIN stockItems si ON ed.item_id = si.item_id
              JOIN exitVouchers ev ON ed.exit_id = ev.exit_id
              WHERE LOWER(si.item_name) = LOWER(?)
                AND ev.date >= (SELECT date FROM orders WHERE order_id = ?)
            `, [orderItem.item_name, order.order_id]);
            
            if (!deliveredQuantity || deliveredQuantity.total_delivered < orderItem.quantity) {
              allItemsDelivered = false;
              break;
            }
          }
          
          // If all items are delivered, mark order as completed
          if (allItemsDelivered) {
            await runQuery(
              'UPDATE orders SET status = ? WHERE order_id = ?',
              ['completed', order.order_id]
            );
            console.log(`Order ${order.order_id} marked as completed`);
          }
        }
      }
    } catch (orderError) {
      console.error('Error checking orders:', orderError);
      // Don't fail the voucher creation if order checking fails
    }

    res.status(201).json({
      detail_id: result.lastID,
      message: 'Item added to exit voucher successfully'
    });
  } catch (error) {
    console.error('Error adding item to exit voucher:', error);
    console.error('Error details:', {
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

// Update exit voucher detail (adjusts stock by the difference, audited)
router.put('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;
    const { quantity, edited_by } = req.body;
    const newQty = Number(quantity);
    if (!Number.isFinite(newQty) || newQty <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const detail = await getRow('SELECT exit_detail_id, item_id, quantity FROM exitDetails WHERE exit_detail_id = ?', [detailId]);
    if (!detail) return res.status(404).json({ error: 'Exit voucher detail not found' });

    const actorUserId = await resolveUserId(edited_by);
    await runTransaction(async () => {
      // The exit removed detail.quantity; it should now remove newQty.
      // Stock therefore changes by (old - new).
      if (detail.item_id) {
        const cur = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [detail.item_id]);
        if (cur) {
          const after = Math.max(0, cur.quantity + (detail.quantity - newQty));
          await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, detail.item_id]);
          await writeAudit('adjustment', detail.item_id, actorUserId, cur.quantity, after);
        }
      }
      await runQuery('UPDATE exitDetails SET quantity = ? WHERE exit_detail_id = ?', [newQty, detailId]);
    });

    res.json({ message: 'Exit voucher detail updated successfully' });
  } catch (error) {
    console.error('Error updating exit voucher detail:', error);
    res.status(500).json({ error: 'Failed to update exit voucher detail' });
  }
});

// Delete exit voucher detail (returns its quantity to stock, audited)
router.delete('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;

    const detail = await getRow('SELECT exit_detail_id, item_id, quantity FROM exitDetails WHERE exit_detail_id = ?', [detailId]);
    if (!detail) return res.status(404).json({ error: 'Exit voucher detail not found' });

    const actorUserId = await resolveUserId(req.body?.deleted_by);
    await runTransaction(async () => {
      if (detail.item_id) {
        const cur = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [detail.item_id]);
        if (cur) {
          const after = cur.quantity + detail.quantity; // return to stock
          await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, detail.item_id]);
          await writeAudit('exit_reversal', detail.item_id, actorUserId, cur.quantity, after);
        }
      }
      await runQuery('DELETE FROM exitDetails WHERE exit_detail_id = ?', [detailId]);
    });

    res.json({ message: 'Exit voucher detail deleted successfully' });
  } catch (error) {
    console.error('Error deleting exit voucher detail:', error);
    res.status(500).json({ error: 'Failed to delete exit voucher detail' });
  }
});

export default router;
