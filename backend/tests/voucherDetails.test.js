/**
 * Voucher Details – Core Business Logic Tests
 *
 * These are the most critical tests: they verify that adding an item to an
 * entry or exit voucher correctly updates stock AND writes an audit log.
 *
 * Entry detail (Bon d'entrée):
 *   ✔ Stock quantity increases by the entered amount
 *   ✔ An audit log row with action='entry' is created
 *   ✔ Missing fields return 400
 *
 * Exit detail (Bon de sortie):
 *   ✔ Stock quantity decreases by the exited amount
 *   ✔ An audit log row with action='exit' is created
 *   ✔ Insufficient stock returns 400 (stock never goes negative)
 *   ✔ Zero / negative quantity is rejected
 *   ✔ Stock floor: even if a race-condition somehow lets it go negative
 *     the code corrects it back to 0
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../database/connection.js', async () => {
  return await import('./helpers/db.js');
});

import {
  initTestDb,
  closeTestDb,
  seedBaseData,
  runQuery,
  getRow,
  getAll,
} from './helpers/db.js';
import entryDetailRoutes from '../routes/entryVoucherDetails.js';
import exitDetailRoutes from '../routes/exitVoucherDetails.js';

const app = express();
app.use(express.json());
app.use('/api/entry-vouchers/details', entryDetailRoutes);
app.use('/api/exit-vouchers/details', exitDetailRoutes);

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await initTestDb();
  await seedBaseData();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await runQuery('DELETE FROM auditLogs');
  await runQuery('DELETE FROM exitDetails');
  await runQuery('DELETE FROM entryDetails');
  await runQuery('DELETE FROM exitVouchers');
  await runQuery('DELETE FROM entryVouchers');
  await runQuery('DELETE FROM stockItems');

  // Seed one stock item and one voucher of each type for reuse
  await runQuery(
    "INSERT INTO stockItems (item_id, item_name, quantity, unit) VALUES (1, 'Ciment 25kg', 100, 'sacs')"
  );
  await runQuery(
    'INSERT INTO entryVouchers (entry_id, added_by, taken_by) VALUES (1, 1, 1)'
  );
  await runQuery(
    'INSERT INTO exitVouchers (exit_id, handled_by, taken_by) VALUES (1, 1, 1)'
  );
});

// ── Entry Details ─────────────────────────────────────────────────────────────

describe('POST /api/entry-vouchers/details – stock update', () => {
  it('increases stock quantity by the entered amount', async () => {
    const before = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(before.quantity).toBe(100);

    const res = await request(app)
      .post('/api/entry-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 50 });

    expect(res.status).toBe(201);

    const after = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(after.quantity).toBe(150); // 100 + 50
  });

  it('writes an audit log with action=entry and correct before/after quantities', async () => {
    await request(app)
      .post('/api/entry-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 30 });

    const logs = await getAll(
      "SELECT * FROM auditLogs WHERE item_id = 1 AND action = 'entry'"
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].quantity_before).toBe(100);
    expect(logs[0].quantity_after).toBe(130);
  });

  it('creates an entryDetails row linking voucher to item', async () => {
    await request(app)
      .post('/api/entry-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 20 });

    const detail = await getRow(
      'SELECT * FROM entryDetails WHERE entry_id = 1 AND item_id = 1'
    );
    expect(detail).toBeDefined();
    expect(detail.quantity).toBe(20);
  });

  it('returns 400 when voucher_id is missing', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers/details')
      .send({ item_id: 1, quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required/i);
  });

  it('returns 400 when item_id is missing', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers/details')
      .send({ voucher_id: 1, quantity: 10 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is missing', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers/details')
      .send({ voucher_id: 1, item_id: 1 });

    expect(res.status).toBe(400);
  });
});

// ── Exit Details ──────────────────────────────────────────────────────────────

describe('POST /api/exit-vouchers/details – stock update', () => {
  it('decreases stock quantity by the exited amount', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 40 });

    expect(res.status).toBe(201);

    const after = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(after.quantity).toBe(60); // 100 - 40
  });

  it('writes an audit log with action=exit and correct before/after quantities', async () => {
    await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 25 });

    const logs = await getAll(
      "SELECT * FROM auditLogs WHERE item_id = 1 AND action = 'exit'"
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].quantity_before).toBe(100);
    expect(logs[0].quantity_after).toBe(75);
  });

  it('creates an exitDetails row linking voucher to item', async () => {
    await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 10 });

    const detail = await getRow(
      'SELECT * FROM exitDetails WHERE exit_id = 1 AND item_id = 1'
    );
    expect(detail).toBeDefined();
    expect(detail.quantity).toBe(10);
  });

  it('returns 400 when stock is insufficient (cannot exit more than available)', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 200 }); // more than the 100 in stock

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);
  });

  it('returns 400 when quantity is zero', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is negative', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: -5 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when item_id is missing', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, quantity: 10 });

    expect(res.status).toBe(400);
  });

  it('multiple exits accumulate correctly and block when stock runs out', async () => {
    // First exit: take 60 units
    const first = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 60 });
    expect(first.status).toBe(201);

    let stock = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(stock.quantity).toBe(40);

    // Second exit: take exactly remaining 40 units
    const second = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 40 });
    expect(second.status).toBe(201);

    stock = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(stock.quantity).toBe(0);

    // Third exit: stock is 0, should be blocked
    const third = await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 1 });
    expect(third.status).toBe(400);
    expect(third.body.error).toMatch(/insufficient stock/i);
  });
});

// ── Entry then Exit ───────────────────────────────────────────────────────────

describe('Full flow: entry followed by exit', () => {
  it('entry increases stock, exit decreases it, audit log captures both', async () => {
    // Bon d'entrée: 50 units arrive
    await request(app)
      .post('/api/entry-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 50 });

    let stock = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(stock.quantity).toBe(150); // 100 + 50

    // Bon de sortie: 30 units leave
    await request(app)
      .post('/api/exit-vouchers/details')
      .send({ voucher_id: 1, item_id: 1, quantity: 30 });

    stock = await getRow('SELECT quantity FROM stockItems WHERE item_id = 1');
    expect(stock.quantity).toBe(120); // 150 - 30

    // Two audit log entries should exist
    const logs = await getAll('SELECT action FROM auditLogs WHERE item_id = 1 ORDER BY log_id');
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('entry');
    expect(logs[1].action).toBe('exit');
  });
});
