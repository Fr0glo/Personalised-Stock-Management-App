/**
 * Stock Items API tests
 *
 * Tests CRUD operations and business rules:
 *  - Only non-deleted, non-zero-quantity items returned by default
 *  - POSTing an existing item name merges (adds) quantity
 *  - Soft delete sets is_deleted=1 and quantity=0 (voucher history intact)
 *  - Quantity endpoint rejects negative values
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Replace the real SQLite file DB with our in-memory test DB
vi.mock('../database/connection.js', async () => {
  return await import('./helpers/db.js');
});

// Import AFTER mock is declared (Vitest hoists vi.mock so this is safe)
import { initTestDb, closeTestDb, clearTables, seedBaseData, runQuery } from './helpers/db.js';
import stockItemRoutes from '../routes/stockItems.js';

// Minimal Express app for this test file
const app = express();
app.use(express.json());
app.use('/api/stock-items', stockItemRoutes);

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await initTestDb();
  await seedBaseData();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  // Remove only stock items between tests; keep users/workers
  await runQuery('DELETE FROM stockItems');
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const insertItem = (name, quantity = 10, unit = 'pcs', isDeleted = 0) =>
  runQuery(
    'INSERT INTO stockItems (item_name, quantity, unit, is_deleted) VALUES (?, ?, ?, ?)',
    [name, quantity, unit, isDeleted]
  );

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/stock-items', () => {
  it('returns only items with quantity > 0 by default', async () => {
    await insertItem('Ciment 25kg', 100);
    await insertItem('Briques', 0);       // should be excluded

    const res = await request(app).get('/api/stock-items');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].item_name).toBe('Ciment 25kg');
  });

  it('includes zero-quantity items when includeZero=true', async () => {
    await insertItem('Ciment 25kg', 100);
    await insertItem('Briques', 0);

    const res = await request(app).get('/api/stock-items?includeZero=true');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('excludes soft-deleted items', async () => {
    await insertItem('Acier 6mm', 50);
    await insertItem('Deleted Item', 20, 'pcs', 1); // is_deleted = 1

    const res = await request(app).get('/api/stock-items?includeZero=true');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].item_name).toBe('Acier 6mm');
  });

  it('filters by search term (case-insensitive)', async () => {
    await insertItem('Ciment 25kg', 100);
    await insertItem('Acier 6mm', 50);

    const res = await request(app).get('/api/stock-items?search=ciment');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].item_name).toBe('Ciment 25kg');
  });
});

describe('GET /api/stock-items/:id', () => {
  it('returns a single stock item', async () => {
    const { id } = await insertItem('Sable', 20, 'm3');

    const res = await request(app).get(`/api/stock-items/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.item_name).toBe('Sable');
    expect(res.body.quantity).toBe(20);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await request(app).get('/api/stock-items/99999');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/stock-items', () => {
  it('creates a new stock item', async () => {
    const res = await request(app)
      .post('/api/stock-items')
      .send({ item_name: 'Gravier', quantity: 15, unit: 'm3' });

    expect(res.status).toBe(201);
    expect(res.body.item_name).toBe('Gravier');
    expect(res.body.quantity).toBe(15);
  });

  it('merges quantity when item already exists (same name)', async () => {
    await insertItem('Gravier', 10, 'm3');

    const res = await request(app)
      .post('/api/stock-items')
      .send({ item_name: 'Gravier', quantity: 5, unit: 'm3' });

    expect(res.status).toBe(200); // update, not create
    expect(res.body.quantity).toBe(15); // 10 + 5
  });

  it('rejects request with no item_name', async () => {
    const res = await request(app)
      .post('/api/stock-items')
      .send({ quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/item name/i);
  });
});

describe('PUT /api/stock-items/:id/quantity', () => {
  it('updates the stock quantity', async () => {
    const { id } = await insertItem('Peinture', 30, 'L');

    const res = await request(app)
      .put(`/api/stock-items/${id}/quantity`)
      .send({ quantity: 50 });

    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(50);
  });

  it('rejects negative quantity', async () => {
    const { id } = await insertItem('Peinture', 30, 'L');

    const res = await request(app)
      .put(`/api/stock-items/${id}/quantity`)
      .send({ quantity: -5 });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/stock-items/:id (soft delete)', () => {
  it('soft-deletes item: sets is_deleted=1 and quantity=0', async () => {
    const { id } = await insertItem('Old Item', 50);

    const res = await request(app).delete(`/api/stock-items/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);

    // Confirm item is no longer visible
    const check = await request(app).get(`/api/stock-items/${id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting a non-existent item', async () => {
    const res = await request(app).delete('/api/stock-items/99999');

    expect(res.status).toBe(404);
  });

  it('returns 404 when trying to delete an already-deleted item', async () => {
    const { id } = await insertItem('Deleted', 10, 'pcs', 1); // already deleted

    const res = await request(app).delete(`/api/stock-items/${id}`);

    expect(res.status).toBe(404);
  });
});
