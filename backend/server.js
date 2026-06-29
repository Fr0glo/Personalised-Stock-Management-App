import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { startScheduler } from './database/scheduler.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workerRoutes from './routes/workers.js';
import stockItemRoutes from './routes/stockItems.js';
import productCatalogRoutes from './routes/productCatalog.js';
import entryVoucherRoutes from './routes/entryVouchers.js';
import exitVoucherRoutes from './routes/exitVouchers.js';
import entryVoucherDetailsRoutes from './routes/entryVoucherDetails.js';
import exitVoucherDetailsRoutes from './routes/exitVoucherDetails.js';
import auditLogRoutes from './routes/auditLogs.js';
import orderRoutes from './routes/orders.js';
import analyticsRoutes from './routes/analytics.js';
import settingsRoutes from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Rate limiting helps prevent server overload from a runaway client.
// Generous limit for an internal LAN app: each page load and admin edit
// fires several API calls, so the previous 200/15min tripped during normal use.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Maximum requests per IP in the time window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Set up middleware for all requests
app.use('/api/', limiter); // Apply rate limiting to API routes
app.use(cors()); // Allow frontend to connect to the API
app.use(express.json()); // Parse incoming JSON data
app.use(express.urlencoded({ extended: true })); // Parse form data

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/stock-items', stockItemRoutes);
app.use('/api/product-catalog', productCatalogRoutes);
app.use('/api/entry-vouchers/details', entryVoucherDetailsRoutes);
app.use('/api/exit-vouchers/details', exitVoucherDetailsRoutes);
app.use('/api/entry-vouchers', entryVoucherRoutes);
app.use('/api/exit-vouchers', exitVoucherRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Stock Management API is running',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production
const frontendPath = join(__dirname, '..', 'frontend', 'dist');
if (existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(join(frontendPath, 'index.html'));
  });
} else {
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Simple error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Network access: http://<server-ip>:${PORT}`);
  startScheduler();
});