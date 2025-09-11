# Stock Management System

## Overview
A simple full-stack stock management app with:
- Stock items listing and status
- Orders with validation
- Vouchers (entry/exit) with detailed logs
- Personnel list with each worker's voucher history

Built for a small depot workflow: add stock via entry vouchers; remove via exit vouchers; track who handled and who received items.

## Tech Stack
- Backend: Node.js, Express, SQLite (via `sqlite3`)
- Frontend: React (Vite) + Tailwind CSS
- Icons: `lucide-react`


## Key Pages (Frontend)
- **Dashboard**: Stock overview (count)
- **Stock**: Item cards, search/filter, statuses
- **Orders**: Add/remove items to an order, quantity input, validation, floating confirm
- **Vouchers**: List entry/exit vouchers, search, filter by worker (actual receiver), modal details
- **Personnel**: Worker directory, search, modal with voucher history (entry/exit, items, dates)

## APIs (Backend)
Base URL: `http://localhost:5000/api`

### Stock Items
- `GET /stock-items` → list items
- `GET /stock-items/:id` → item by id
- `POST /stock-items` → create item
- `PUT /stock-items/:id` → update item
- `DELETE /stock-items/:id` → delete item

### Entry Vouchers
- `GET /entry-vouchers` → list
- `GET /entry-vouchers/:id` → voucher with `details[]` (item_name, worker name, quantity)
- `POST /entry-vouchers` → `{ added_by, details: [{ item_id, worker_id, quantity }] }`

### Exit Vouchers
- `GET /exit-vouchers` → list
- `GET /exit-vouchers/:id` → voucher with `details[]`
- `POST /exit-vouchers` → `{ handled_by, details: [{ item_id, worker_id, quantity }] }` with stock checks

### Workers
- `GET /workers` → list workers
- `GET /workers/:id` → worker by id
- `POST/PUT/DELETE` available for admin flows

### Users
- `GET /users` → list users (for admin)
- Used for login in the auth section below

## Running Locally
### Backend:
```bash
cd backend
npm install
node database/init.js  # creates tables and seeds sample data
node server.js
```

### Frontend:
```bash
cd frontend
npm install
npm run dev  # Vite
```

---
