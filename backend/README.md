# Stock Management Backend

A Node.js + Express + SQLite backend for the Stock Management System.

## Quick Start

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Initialize the database:**
```bash
npm run init-db
```

3. **Start the development server:**
```bash
npm run dev
```

4. **Test the API:**
```bash
curl http://localhost:5000/api/health
```

## API Endpoints

### Health Check
- `GET /api/health` - Check if server is running

### Users (Office Staff)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Workers (People who handle stock)
- `GET /api/workers` - Get all workers
- `GET /api/workers/:id` - Get single worker
- `POST /api/workers` - Create new worker
- `PUT /api/workers/:id` - Update worker
- `DELETE /api/workers/:id` - Delete worker

### Stock Items
- `GET /api/stock-items` - Get all stock items
- `GET /api/stock-items/:id` - Get single stock item
- `POST /api/stock-items` - Create new stock item
- `PUT /api/stock-items/:id` - Update stock item
- `DELETE /api/stock-items/:id` - Delete stock item

### Entry Vouchers (Bon d'entrée)
- `GET /api/entry-vouchers` - Get all entry vouchers
- `GET /api/entry-vouchers/:id` - Get entry voucher with details
- `POST /api/entry-vouchers` - Create new entry voucher

### Exit Vouchers (Bon de sortie)
- `GET /api/exit-vouchers` - Get all exit vouchers
- `GET /api/exit-vouchers/:id` - Get exit voucher with details
- `POST /api/exit-vouchers` - Create new exit voucher

### Audit Logs
- `GET /api/audit-logs` - Get all audit logs
- `GET /api/audit-logs/item/:itemId` - Get logs for specific item
- `GET /api/audit-logs/user/:userId` - Get logs for specific user

## Sample Data

The database comes with sample data:
- 3 users (admin, staff1, staff2)
- 3 workers (Ahmed, Mohammed, Ali)
- 5 stock items (Ciment, Briques, Acier, Sable, Gravier)
- Sample vouchers and audit logs

## Testing with Postman

1. Import the API endpoints into Postman
2. Test each endpoint
3. Check the responses

## Database Schema

Based on your ERD:
- `users` - Office staff
- `workers` - People who handle stock
- `stockItems` - Products/inventory
- `entryVouchers` & `entryDetails` - Bon d'entrée system
- `exitVouchers` & `exitDetails` - Bon de sortie system
- `auditLogs` - Activity tracking 