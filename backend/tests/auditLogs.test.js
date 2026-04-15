/**
 * Audit Logs API tests
 *
 * Audit logs are the immutable record of every stock movement.
 * Tests verify:
 *  - GET / returns all logs ordered newest-first
 *  - GET /item/:itemId filters correctly
 *  - GET /user/:userId filters correctly
 *  - Returns an empty array (not 404) when no logs exist for a filter
 *
 * Note: the auditLogs route JOINs stockItems and users, so both must exist.
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../database/connection.js', async () => {
  return await import('./helpers/db.js');
});

import { initTestDb, closeTestDb, seedBaseData, runQuery } from './helpers/db.js';
import auditLogRoutes from '../routes/auditLogs.js';

const app = express();
app.use(express.json());
app.use('/api/audit-logs', auditLogRoutes);

beforeAll(async () => {
  await initTestDb();
  await seedBaseData();

  // Seed a stock item so the JOIN in the route works
  await runQuery(
    "INSERT INTO stockItems (item_id, item_name, quantity, unit) VALUES (1, 'Ciment 25kg', 100, 'sacs')"
  );
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await runQuery('DELETE FROM auditLogs');
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const insertLog = (action, itemId = 1, userId = 1, before = 100, after = 50) =>
  runQuery(
    'INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after) VALUES (?, ?, ?, ?, ?)',
    [action, itemId, userId, before, after]
  );

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/audit-logs', () => {
  it('returns an empty array when no logs exist', async () => {
    const res = await request(app).get('/api/audit-logs');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all logs with item_name and username joined', async () => {
    await insertLog('entry', 1, 1, 0, 100);
    await insertLog('exit', 1, 1, 100, 50);

    const res = await request(app).get('/api/audit-logs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const log = res.body[0];
    expect(log.item_name).toBe('Ciment 25kg');
    expect(log.username).toBe('testuser');
    expect(log.action).toBeDefined();
  });

  it('returns logs ordered newest first (DESC timestamp)', async () => {
    // Insert with explicit timestamps so ordering is deterministic in the in-memory DB
    await runQuery(
      "INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after, timestamp) VALUES ('entry', 1, 1, 0, 50, '2024-01-01 08:00:00')"
    );
    await runQuery(
      "INSERT INTO auditLogs (action, item_id, user_id, quantity_before, quantity_after, timestamp) VALUES ('exit', 1, 1, 50, 20, '2024-01-01 09:00:00')"
    );

    const res = await request(app).get('/api/audit-logs');

    expect(res.status).toBe(200);
    // 'exit' has the later timestamp so it should appear first (DESC)
    expect(res.body[0].action).toBe('exit');
    expect(res.body[1].action).toBe('entry');
  });
});

describe('GET /api/audit-logs/item/:itemId', () => {
  it('returns only logs for the specified item', async () => {
    // Insert a second stock item and logs for both
    await runQuery(
      "INSERT INTO stockItems (item_id, item_name, quantity, unit) VALUES (2, 'Acier 6mm', 50, 'kg')"
    );
    await insertLog('entry', 1, 1, 0, 100);
    await insertLog('entry', 2, 1, 0, 50);

    const res = await request(app).get('/api/audit-logs/item/1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].item_id).toBe(1);
  });

  it('returns an empty array for an item with no logs', async () => {
    const res = await request(app).get('/api/audit-logs/item/999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/audit-logs/user/:userId', () => {
  it('returns only logs created by the specified user', async () => {
    // Create a second user
    await runQuery("INSERT INTO users (user_id, username, role) VALUES (2, 'otheruser', 'staff')");

    await insertLog('entry', 1, 1);  // user 1
    await insertLog('exit', 1, 2);   // user 2

    const res = await request(app).get('/api/audit-logs/user/1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user_id).toBe(1);
  });

  it('returns an empty array for a user with no logs', async () => {
    const res = await request(app).get('/api/audit-logs/user/999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
