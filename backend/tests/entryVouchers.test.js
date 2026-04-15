/**
 * Entry Voucher (Bon d'entrée) API tests
 *
 * Tests:
 *  - Creating a voucher requires a valid handled_by username
 *  - Worker name lookup is case-insensitive and handles "Firstname Lastname" order
 *  - Unknown user or unknown worker returns descriptive 400 error
 *  - GET returns all vouchers with joined staff/worker names
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../database/connection.js', async () => {
  return await import('./helpers/db.js');
});

import { initTestDb, closeTestDb, clearTables, seedBaseData, runQuery } from './helpers/db.js';
import entryVoucherRoutes from '../routes/entryVouchers.js';
import entryDetailRoutes from '../routes/entryVoucherDetails.js';

const app = express();
app.use(express.json());
// Mount details BEFORE the parameterised /:id route to avoid swallowing the path
app.use('/api/entry-vouchers/details', entryDetailRoutes);
app.use('/api/entry-vouchers', entryVoucherRoutes);

beforeAll(async () => {
  await initTestDb();
  await seedBaseData();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await runQuery('DELETE FROM entryDetails');
  await runQuery('DELETE FROM entryVouchers');
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/entry-vouchers', () => {
  it('creates a voucher when user and worker are valid', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({
        voucher_number: 'BDE-001',
        handled_by: 'testuser',
        taken_by: 'Ahmed Benzema',
        place: 'Zone A',
        notes: 'Livraison matin',
      });

    expect(res.status).toBe(201);
    expect(res.body.voucher_id).toBeDefined();
    expect(res.body.message).toMatch(/created/i);
  });

  it('creates a voucher without a taken_by (optional field)', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({ handled_by: 'testuser' });

    expect(res.status).toBe(201);
    expect(res.body.voucher_id).toBeDefined();
  });

  it('returns 400 when handled_by is missing', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({ taken_by: 'Ahmed Benzema' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/handled by/i);
  });

  it('returns 400 for an unknown handled_by username', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({ handled_by: 'nobody' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 400 for an unknown worker name', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({ handled_by: 'testuser', taken_by: 'Inconnu Fantome' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/worker not found/i);
  });

  it('looks up worker case-insensitively (lowercase input)', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({ handled_by: 'testuser', taken_by: 'ahmed benzema' });

    expect(res.status).toBe(201);
  });

  it('looks up worker with reversed name order (Lastname Firstname)', async () => {
    const res = await request(app)
      .post('/api/entry-vouchers')
      .send({ handled_by: 'testuser', taken_by: 'Benzema Ahmed' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/entry-vouchers', () => {
  it('returns an empty array when no vouchers exist', async () => {
    const res = await request(app).get('/api/entry-vouchers');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns vouchers with details array and staff name', async () => {
    // Create one voucher directly
    await runQuery(
      'INSERT INTO entryVouchers (entry_id, voucher_number, added_by, taken_by) VALUES (1, "BDE-001", 1, 1)'
    );

    const res = await request(app).get('/api/entry-vouchers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const voucher = res.body[0];
    expect(voucher.voucher_number).toBe('BDE-001');
    expect(Array.isArray(voucher.details)).toBe(true);
    expect(Array.isArray(voucher.office_staff)).toBe(true);
  });
});

describe('GET /api/entry-vouchers/:id', () => {
  it('returns 404 for a non-existent voucher', async () => {
    const res = await request(app).get('/api/entry-vouchers/99999');

    expect(res.status).toBe(404);
  });

  it('returns a single voucher with its details', async () => {
    await runQuery(
      'INSERT INTO entryVouchers (entry_id, added_by) VALUES (10, 1)'
    );

    const res = await request(app).get('/api/entry-vouchers/10');

    expect(res.status).toBe(200);
    expect(res.body.entry_id).toBe(10);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});
