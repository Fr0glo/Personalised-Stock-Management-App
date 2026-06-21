import express from 'express';
import { runQuery, getRow, getAll } from '../database/connection.js';
import { runTransaction, resolveUserId, writeAudit } from '../database/inventory.js';

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
    const { voucher_id, item_id, quantity, unit, place } = req.body;

    console.log('Entry voucher details request:', req.body);

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
    
    // Get added_by and taken_by from entry voucher
    const voucherInfo = await getRow('SELECT place, added_by, taken_by FROM entryVouchers WHERE entry_id = ?', [voucher_id]);
    
    // Use place from request (per-item place) if provided, otherwise use voucher place, otherwise null
    const itemPlace = place || (voucherInfo ? voucherInfo.place : null);
    
    // Use the taken_by worker from the voucher, or default to 1 if not specified
    // Use the voucher's worker; if absent, fall back to any existing worker
    // rather than assuming a hardcoded worker_id of 1.
    const workerId = (voucherInfo && voucherInfo.taken_by)
      || (await getRow('SELECT MIN(worker_id) AS id FROM workers'))?.id
      || null;

    // Add this item to the entry voucher details
    console.log('Inserting entry detail:', {
      entry_id: voucher_id,
      item_id: item_id,
      worker_id: workerId,
      quantity: quantity,
      place: itemPlace
    });
    
    const result = await runQuery(
      'INSERT INTO entryDetails (entry_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
      [voucher_id, item_id, workerId, quantity] // Use the worker from the voucher's taken_by field
    );
    
    console.log('Entry detail inserted with ID:', result.id);

    // Update stock quantity and place (use per-item place if provided)
    await runQuery(
      'UPDATE stockItems SET quantity = ?, place = ? WHERE item_id = ?',
      [quantityAfter, itemPlace, item_id]
    );
    
    // Log audit trail
    await runQuery(
      'INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) VALUES (?, ?, ?, ?, ?)',
      ['entry', item_id, voucherInfo ? voucherInfo.added_by : 1, quantityBefore, quantityAfter]
    );

    console.log('Stock updated:', {
      item_id,
      quantity_before: quantityBefore,
      quantity_added: quantity,
      quantity_after: quantityAfter,
      place: place,
      handled_by_user: voucherInfo ? voucherInfo.added_by : 1
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

// Update entry voucher detail (adjusts stock by the difference, audited)
router.put('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;
    const { quantity, edited_by } = req.body;
    const newQty = Number(quantity);
    if (!Number.isFinite(newQty) || newQty <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    const detail = await getRow('SELECT entry_detail_id, item_id, quantity FROM entryDetails WHERE entry_detail_id = ?', [detailId]);
    if (!detail) return res.status(404).json({ error: 'Entry voucher detail not found' });

    const actorUserId = await resolveUserId(edited_by);
    await runTransaction(async () => {
      // The entry added detail.quantity; it should now add newQty.
      // Stock therefore changes by (new - old).
      if (detail.item_id) {
        const cur = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [detail.item_id]);
        if (cur) {
          const after = Math.max(0, cur.quantity + (newQty - detail.quantity));
          await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, detail.item_id]);
          await writeAudit('adjustment', detail.item_id, actorUserId, cur.quantity, after);
        }
      }
      await runQuery('UPDATE entryDetails SET quantity = ? WHERE entry_detail_id = ?', [newQty, detailId]);
    });

    res.json({ message: 'Entry voucher detail updated successfully' });
  } catch (error) {
    console.error('Error updating entry voucher detail:', error);
    res.status(500).json({ error: 'Failed to update entry voucher detail' });
  }
});

// Delete entry voucher detail (removes the stock it had added, audited)
router.delete('/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;

    const detail = await getRow('SELECT entry_detail_id, item_id, quantity FROM entryDetails WHERE entry_detail_id = ?', [detailId]);
    if (!detail) return res.status(404).json({ error: 'Entry voucher detail not found' });

    const actorUserId = await resolveUserId(req.body?.deleted_by);
    await runTransaction(async () => {
      if (detail.item_id) {
        const cur = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [detail.item_id]);
        if (cur) {
          const after = Math.max(0, cur.quantity - detail.quantity); // undo the entry
          await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, detail.item_id]);
          await writeAudit('entry_reversal', detail.item_id, actorUserId, cur.quantity, after);
        }
      }
      await runQuery('DELETE FROM entryDetails WHERE entry_detail_id = ?', [detailId]);
    });

    res.json({ message: 'Entry voucher detail deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry voucher detail:', error);
    res.status(500).json({ error: 'Failed to delete entry voucher detail' });
  }
});

export default router;
