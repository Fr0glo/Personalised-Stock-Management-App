# Deployment Guide

## Quick Start Improvements

This guide explains the improvements made to the stock management system.

### ✅ Implemented Features

1. **WAL Mode** - Better database performance for concurrent access
2. **Rate Limiting** - Prevents server overload (200 requests per 15 minutes)
3. **Automated Backups** - Daily database backups with 30-day retention
4. **PM2 Configuration** - Process management for production
5. **Simple CORS** - Basic security (internal use)

---

## 1. Database Backups

### Manual Backup
```bash
npm run backup
```
This creates a backup in `backend/database/backups/` with timestamp.

### Automated Daily Backups
To run backups automatically every 24 hours, you can:
- Use a cron job (Linux/Mac)
- Use Task Scheduler (Windows)
- Run the scheduler script: `node database/backupScheduler.js`

### Restore from Backup
```bash
# Stop the server first
# Then copy backup file:
cp backend/database/backups/backup-2024-01-15T10-30-00.db backend/database/stock_management.db
```

---

## 2. PM2 Process Management

### Install PM2 (if not installed)
```bash
npm install -g pm2
```

### Start Application with PM2
```bash
npm run pm2:start
```

### Other PM2 Commands
```bash
npm run pm2:stop      # Stop the application
npm run pm2:restart   # Restart the application
npm run pm2:logs      # View logs
```

### Auto-start on Server Reboot
```bash
pm2 startup
pm2 save
```

---

## 3. Rate Limiting

Rate limiting is automatically enabled. Each IP address can make:
- **200 requests per 15 minutes**
- If exceeded, returns "Too many requests" error
- Prevents accidental loops and abuse

---

## 4. WAL Mode

WAL (Write-Ahead Logging) mode is automatically enabled when the database connects. This provides:
- Better concurrent read/write performance
- Multiple users can read while one writes
- Faster overall database operations

---

## Production Deployment Checklist

### On Office Server (Morocco):

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Initialize Database** (if first time)
   ```bash
   npm run init-db
   ```

3. **Create Logs Directory**
   ```bash
   mkdir logs
   ```

4. **Start with PM2**
   ```bash
   npm run pm2:start
   ```

5. **Set up Auto-start**
   ```bash
   pm2 startup
   pm2 save
   ```

6. **Set up Daily Backups** (choose one):
   
   **Option A: Cron Job (Linux)**
   ```bash
   # Edit crontab
   crontab -e
   
   # Add this line (runs daily at 2 AM):
   0 2 * * * cd /path/to/backend && npm run backup
   ```
   
   **Option B: Task Scheduler (Windows)**
   - Open Task Scheduler
   - Create Basic Task
   - Set to run daily
   - Action: Start a program
   - Program: `node`
   - Arguments: `database/backup.js`
   - Start in: `C:\path\to\backend`

### Remote Updates from London:

1. **SSH into Server**
   ```bash
   ssh user@office-server-ip
   ```

2. **Navigate to Project**
   ```bash
   cd /path/to/stock-management/backend
   ```

3. **Pull Latest Code** (if using Git)
   ```bash
   git pull origin main
   ```

4. **Install New Dependencies** (if any)
   ```bash
   npm install
   ```

5. **Restart Application**
   ```bash
   npm run pm2:restart
   ```

---

## Monitoring

### Check Application Status
```bash
pm2 status
```

### View Logs
```bash
npm run pm2:logs
# Or
pm2 logs stock-management-api
```

### Check Database Size
```bash
ls -lh backend/database/stock_management.db
```

### Check Backup Status
```bash
ls -lh backend/database/backups/
```

---

## Troubleshooting

### Server Won't Start
1. Check if port 5000 is already in use
2. Check logs: `npm run pm2:logs`
3. Verify database exists: `ls backend/database/stock_management.db`

### Database Errors
1. Check database file permissions
2. Verify WAL mode is enabled (check logs)
3. Restore from backup if needed

### Rate Limiting Issues
- If you hit the limit, wait 15 minutes
- Or increase limit in `server.js` (line with `max: 200`)

---

## Notes

- Backups are stored in `backend/database/backups/`
- Old backups (>30 days) are automatically deleted
- PM2 keeps the app running even if it crashes
- Rate limiting protects against accidental overload
- WAL mode improves performance for multiple users

