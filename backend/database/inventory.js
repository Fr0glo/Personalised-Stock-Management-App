// Centralised inventory operations: every stock change goes through here so it
// happens exactly once, is audited, and can run inside a transaction.
import { getRow, getAll, runQuery } from './connection.js';

// Run `work` inside a single SQL transaction. Commits on success, rolls back on
// any error. (Safe for this app: stock is edited by ~1 person at a time.)
export const runTransaction = async (work) => {
  await runQuery('BEGIN');
  try {
    const result = await work();
    await runQuery('COMMIT');
    return result;
  } catch (err) {
    try { await runQuery('ROLLBACK'); } catch (_) { /* ignore rollback errors */ }
    throw err;
  }
};

// Resolve an actor (user_id or username) to a valid users.user_id. Null if unknown.
export const resolveUserId = async (who) => {
  if (who === undefined || who === null || who === '') return null;
  if (typeof who === 'number' || /^\d+$/.test(String(who))) {
    const byId = await getRow('SELECT user_id FROM users WHERE user_id = ?', [Number(who)]);
    if (byId) return byId.user_id;
  }
  const byName = await getRow('SELECT user_id FROM users WHERE LOWER(username) = LOWER(?)', [String(who)]);
  return byName ? byName.user_id : null;
};

// Write an audit row. Never throws; skips quietly if no valid user/item
// (auditLogs.user_id and item_id are required foreign keys).
export const writeAudit = async (action, itemId, userId, before, after) => {
  if (!userId || !itemId) return;
  try {
    await runQuery(
      'INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) VALUES (?,?,?,?,?)',
      [action, itemId, userId, before, after]
    );
  } catch (err) {
    console.error('Audit write failed:', err.message);
  }
};

// Create or merge a stock item by name (case-insensitive, reactivates a
// soft-deleted item). Increases stock by `quantity` EXACTLY ONCE. Returns the row.
export const upsertStockItem = async ({ item_name, quantity = 0, unit, notes, place }) => {
  const trimmedName = (item_name || '').trim();
  const existing = await getRow(
    'SELECT * FROM stockItems WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))',
    [trimmedName]
  );

  if (existing) {
    const wasDeleted = !!existing.is_deleted;
    const newQty = wasDeleted ? (quantity || 0) : existing.quantity + (quantity || 0);
    await runQuery(
      'UPDATE stockItems SET quantity = ?, unit = ?, notes = ?, place = COALESCE(?, place), is_deleted = 0 WHERE item_id = ?',
      [newQty, unit || existing.unit, notes !== undefined ? notes : existing.notes, place ?? null, existing.item_id]
    );
    return { item: await getRow('SELECT * FROM stockItems WHERE item_id = ?', [existing.item_id]), existed: true };
  }

  const result = await runQuery(
    'INSERT INTO stockItems (item_name, quantity, unit, notes, place, is_dynamic) VALUES (?,?,?,?,?,1)',
    [trimmedName, quantity || 0, unit || 'pcs', notes ?? null, place ?? null]
  );
  return { item: await getRow('SELECT * FROM stockItems WHERE item_id = ?', [result.id]), existed: false };
};

const ensureUnregisteredTable = async () => {
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
};

// Mark an exit voucher's order(s) completed if everything ordered has now gone out.
const checkOrderCompletion = async (item_id) => {
  try {
    const stockItem = await getRow('SELECT item_name FROM stockItems WHERE item_id = ?', [item_id]);
    if (!stockItem) return;
    const matchingOrders = await getAll(`
      SELECT DISTINCT o.order_id FROM orders o
      JOIN orderItems oi ON o.order_id = oi.order_id
      WHERE o.status = 'pending' AND LOWER(oi.item_name) = LOWER(?)
    `, [stockItem.item_name]);
    for (const order of matchingOrders) {
      const orderItems = await getAll('SELECT item_name, quantity FROM orderItems WHERE order_id = ?', [order.order_id]);
      let allDelivered = true;
      for (const oi of orderItems) {
        const delivered = await getRow(`
          SELECT COALESCE(SUM(ed.quantity), 0) AS total
          FROM exitDetails ed
          JOIN stockItems si ON ed.item_id = si.item_id
          JOIN exitVouchers ev ON ed.exit_id = ev.exit_id
          WHERE LOWER(si.item_name) = LOWER(?)
            AND ev.date >= (SELECT date FROM orders WHERE order_id = ?)
        `, [oi.item_name, order.order_id]);
        if (!delivered || delivered.total < oi.quantity) { allDelivered = false; break; }
      }
      if (allDelivered) {
        await runQuery('UPDATE orders SET status = ? WHERE order_id = ?', ['completed', order.order_id]);
      }
    }
  } catch (err) {
    console.error('Order completion check failed:', err.message);
  }
};

// Apply one real stock item leaving the depot: validate stock, record the
// detail, reduce stock once, audit, and check order completion.
// Throws if there isn't enough stock (caller's transaction then rolls back).
export const applyExitItem = async ({ voucherId, item_id, quantity, workerId, actorUserId }) => {
  if (!item_id || !quantity || quantity <= 0) throw new Error('Article ou quantité invalide');
  const current = await getRow('SELECT quantity, item_name FROM stockItems WHERE item_id = ?', [item_id]);
  if (!current || current.quantity < quantity) {
    throw new Error(`Stock insuffisant pour "${current?.item_name || item_id}" (disponible: ${current?.quantity || 0}, demandé: ${quantity})`);
  }
  await runQuery(
    'INSERT INTO exitDetails (exit_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
    [voucherId, item_id, workerId, quantity]
  );
  const before = current.quantity;
  const after = before - Number(quantity);
  await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, item_id]);
  await writeAudit('exit', item_id, actorUserId, before, after);
  await checkOrderCompletion(item_id);
};

// Record an item that left the depot but is not in stock (no stock change).
export const applyExitUnregistered = async ({ voucherId, item_name, quantity, workerId }) => {
  const name = (item_name || '').toString().trim();
  if (!name || !quantity || quantity <= 0) throw new Error('Article non trouvé invalide');
  await ensureUnregisteredTable();
  await runQuery(
    'INSERT INTO exitUnregisteredItems (exit_id, item_name, quantity, worker_id) VALUES (?, ?, ?, ?)',
    [voucherId, name, quantity, workerId || null]
  );
};

// Apply one item arriving into the depot: create/merge the stock item (the ONE
// place stock increases on entry), record the detail, and audit.
export const applyEntryItem = async ({ voucherId, item_name, quantity, unit, notes, place, workerId, actorUserId }) => {
  if (!item_name || !quantity || quantity <= 0) throw new Error('Article ou quantité invalide');
  const before = (await getRow('SELECT quantity FROM stockItems WHERE LOWER(TRIM(item_name)) = LOWER(TRIM(?))', [item_name.trim()]))?.quantity || 0;
  const { item } = await upsertStockItem({ item_name, quantity, unit, notes, place });
  await runQuery(
    'INSERT INTO entryDetails (entry_id, item_id, worker_id, quantity) VALUES (?, ?, ?, ?)',
    [voucherId, item.item_id, workerId, quantity]
  );
  await writeAudit('entry', item.item_id, actorUserId, before, item.quantity);
  return item;
};

// Put stock back when an exit voucher is removed (items returned to stock).
export const reverseExitVoucher = async (voucherId, actorUserId) => {
  const details = await getAll('SELECT item_id, quantity FROM exitDetails WHERE exit_id = ?', [voucherId]);
  for (const d of details) {
    if (!d.item_id) continue;
    const cur = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [d.item_id]);
    if (!cur) continue;
    const after = cur.quantity + d.quantity;
    await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, d.item_id]);
    await writeAudit('exit_reversal', d.item_id, actorUserId, cur.quantity, after);
  }
};

// Take stock back out when an entry voucher is removed (added stock undone).
export const reverseEntryVoucher = async (voucherId, actorUserId) => {
  const details = await getAll('SELECT item_id, quantity FROM entryDetails WHERE entry_id = ?', [voucherId]);
  for (const d of details) {
    if (!d.item_id) continue;
    const cur = await getRow('SELECT quantity FROM stockItems WHERE item_id = ?', [d.item_id]);
    if (!cur) continue;
    const after = Math.max(0, cur.quantity - d.quantity);
    await runQuery('UPDATE stockItems SET quantity = ? WHERE item_id = ?', [after, d.item_id]);
    await writeAudit('entry_reversal', d.item_id, actorUserId, cur.quantity, after);
  }
};
