/**
 * Exit Voucher (Bon de sortie) API tests
 *
 * Tests:
 *  - Creating a voucher with a normal user
 *  - "Security" maps to the special hardcoded user_id 9997
 *  - Missing/invalid handled_by returns 400
 *  - Unknown worker returns 400
 *  - GET returns all vouchers with details array
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../database/connection.js', async () => {
  return await import('./helpers/db.js');
});

import { initTestDb, closeTestDb, seedBaseData, runQuery } from './helpers/db.js';
import exitVoucherRoutes from '../routes/exitVouchers.js';
import exitDetailRoutes from '../routes/exitVoucherDetails.js';

const app = express();
app.use(express.json());
app.use('/api/exit-vouchers/details', exitDetailRoutes);
app.use('/api/exit-vouchers', exitVoucherRoutes);

beforeAll(async () => {
  await initTestDb();
  await seedBaseData();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await runQuery('DELETE FROM exitDetails');
  await runQuery('DELETE FROM exitVouchers');
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/exit-vouchers', () => {
  it('creates a voucher when user and worker are valid', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({
        voucher_number: 'BDS-001',
        handled_by: 'testuser',
        taken_by: 'Ahmed Benzema',
        notes: 'Matinée chantier',
      });

    expect(res.status).toBe(201);
    expect(res.body.voucher_id).toBeDefined();
    expect(res.body.exit_id).toBeDefined();
  });

  it('uses special user_id 9997 when handled_by is "Security"', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({ handled_by: 'Security' });

    expect(res.status).toBe(201);

    // Verify in DB that handled_by is 9997
    const voucher = await runQuery('SELECT handled_by FROM exitVouchers WHERE exit_id = ?', [
      res.body.voucher_id,
    ]);
    // Direct DB check
    const { getRow } = await import('./helpers/db.js');
    const row = await getRow('SELECT handled_by FROM exitVouchers WHERE exit_id = ?', [
      res.body.voucher_id,
    ]);
    expect(row.handled_by).toBe(9997);
  });

  it('is case-insensitive for "security" keyword', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({ handled_by: 'security' }); // lowercase

    expect(res.status).toBe(201);
  });

  it('returns 400 when handled_by is missing', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({ taken_by: 'Ahmed Benzema' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/handled by/i);
  });

  it('returns 400 for an unknown handled_by username', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({ handled_by: 'ghostuser' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 400 for an unknown worker name', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({ handled_by: 'testuser', taken_by: 'Unknown Person' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/worker not found/i);
  });

  it('creates a voucher without taken_by (optional field)', async () => {
    const res = await request(app)
      .post('/api/exit-vouchers')
      .send({ handled_by: 'testuser' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/exit-vouchers', () => {
  it('returns an empty array when no vouchers exist', async () => {
    const res = await request(app).get('/api/exit-vouchers');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns vouchers with details array and staff name', async () => {
    await runQuery(
      'INSERT INTO exitVouchers (exit_id, voucher_number, handled_by) VALUES (1, "BDS-001", 1)'
    );

    const res = await request(app).get('/api/exit-vouchers');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const voucher = res.body[0];
    expect(voucher.voucher_number).toBe('BDS-001');
    expect(Array.isArray(voucher.details)).toBe(true);
    expect(Array.isArray(voucher.office_staff)).toBe(true);
  });
});

describe('GET /api/exit-vouchers/:id', () => {
  it('returns 404 for a non-existent voucher', async () => {
    const res = await request(app).get('/api/exit-vouchers/99999');

    expect(res.status).toBe(404);
  });

  it('returns a single voucher with its details', async () => {
    await runQuery(
      'INSERT INTO exitVouchers (exit_id, handled_by) VALUES (20, 1)'
    );

    const res = await request(app).get('/api/exit-vouchers/20');

    expect(res.status).toBe(200);
    expect(res.body.exit_id).toBe(20);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});
