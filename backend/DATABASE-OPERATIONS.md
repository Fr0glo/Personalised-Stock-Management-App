# Database Operations Runbook

## Overview

The stock management system uses **SQLite** (a single file: `database/stock_management.db`).
All backup, cleanup, and migration tasks run automatically via the built-in scheduler when the server is running.

---

## 1. Backups

### How they run
- **Daily backup**: every day at 2:00 AM — keeps the last 7
- **Weekly backup**: every Sunday at 3:00 AM — keeps the last 4
- Backups are compressed (`.db.gz`) and stored in `database/backups/`
- Old backups are automatically pruned

### Manual backup
```bash
npm run backup            # daily backup now
npm run backup:weekly     # weekly backup now
npm run backup:list       # show all backups
```

### How to restore from backup

**Step 1:** Stop the server
```bash
npm run pm2:stop
```

**Step 2:** List available backups and pick one
```bash
npm run backup:list
```

**Step 3:** Restore (replace the database)
```bash
node database/backup.js restore backup-daily-2026-06-10T20-45-19.db.gz database/stock_management.db
```

**Step 4:** Restart the server
```bash
npm run pm2:start
```

---

## 2. Migrations (schema changes)

Migrations are versioned scripts that modify the database structure safely.

### Check migration status
```bash
npm run migrate:status
```

### Apply pending migrations
```bash
npm run migrate
```

### Roll back the last migration
```bash
npm run migrate:down
```

### Create a new migration
```bash
npm run migrate:create "add phone to workers"
```
This creates a file in `database/migrations/`. Edit it, then run `npm run migrate`.

---

## 3. Cleanup (archiving old data)

The system keeps the live database small by archiving old records. **Core business data (stock, vouchers, workers, users) is never deleted.**

### What gets archived

| Data | After how long | Schedule |
|------|---------------|----------|
| Audit logs | 90 days | Daily at 4:00 AM |
| Completed/cancelled orders | 180 days | Sunday at 5:00 AM |

### How it works
1. Rows older than the cutoff are copied to archive tables (`_archive_auditLogs`, `_archive_orders`)
2. The copy is verified
3. Original rows are deleted
4. All inside a transaction — if anything fails, nothing is deleted

### Preview what would be archived (safe, changes nothing)
```bash
npm run cleanup:dry
```

### Run cleanup manually
```bash
npm run cleanup:daily     # archive old audit logs
npm run cleanup:weekly    # archive old orders too
```

### Change retention periods
Edit `.env` (copy from `.env.example` if it doesn't exist):
```
AUDIT_RETENTION_DAYS=90
ORDER_RETENTION_DAYS=180
```

### Where archives live
- In-database: `_archive_auditLogs`, `_archive_orders`, `_archive_orderItems` tables
- Exported files: `database/archives/` (compressed JSON, created during weekly cleanup)
- Cleanup log: `database/archives/cleanup.log`

---

## 4. Schedule

All jobs run automatically when the server is running (via PM2). No cron or Task Scheduler setup needed.

| Job | When | What |
|-----|------|------|
| Daily backup | 2:00 AM | Compressed copy of the database |
| Weekly backup | Sunday 3:00 AM | Same, with separate retention |
| Daily cleanup | 4:00 AM | Archive old audit logs |
| Weekly cleanup | Sunday 5:00 AM | Archive old orders + export archives |

### Disable the scheduler
Set `SCHEDULER_ENABLED=false` in `.env` and restart the server.

### Jobs can't overlap
A lock file prevents two jobs from running at the same time. If a job takes more than 30 minutes (shouldn't happen), the lock is considered stale and overridden.

---

## 5. If something goes wrong

### Server won't start
```bash
npm run pm2:logs          # check error logs
ls database/stock_management.db   # verify database exists
```

### Database seems corrupted
1. Stop the server: `npm run pm2:stop`
2. List backups: `npm run backup:list`
3. Restore the most recent: `node database/backup.js restore <backup-file> database/stock_management.db`
4. Restart: `npm run pm2:start`

### Cleanup deleted something it shouldn't have
The archived data is still in the archive tables. You can copy it back:
```sql
-- Example: restore archived audit logs
INSERT INTO auditLogs SELECT log_id, action, item_id, user_id, timestamp, quantity_before, quantity_after
FROM _archive_auditLogs WHERE archived_at > '2026-06-01';
```

### A migration failed
```bash
npm run migrate:down      # roll back the last migration
npm run pm2:logs          # check what went wrong
```

---

## 6. File locations

| What | Where |
|------|-------|
| Live database | `backend/database/stock_management.db` |
| Backups | `backend/database/backups/` |
| Archives | `backend/database/archives/` |
| Migrations | `backend/database/migrations/` |
| Server logs | `backend/logs/` |
| Config example | `backend/.env.example` |
