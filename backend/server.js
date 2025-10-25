import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import routes
import userRoutes from './routes/users.js';
import workerRoutes from './routes/workers.js';
import stockItemRoutes from './routes/stockItems.js';
import productCatalogRoutes from './routes/productCatalog.js';
import entryVoucherRoutes from './routes/entryVouchers.js';
import exitVoucherRoutes from './routes/exitVouchers.js';
import entryVoucherDetailsRoutes from './routes/entryVoucherDetails.js';
import exitVoucherDetailsRoutes from './routes/exitVoucherDetails.js';
import auditLogRoutes from './routes/auditLogs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Essential middleware only
app.use(cors());  // Allow frontend to connect
app.use(express.json());  // Parse JSON requests
app.use(express.urlencoded({ extended: true }));  // Parse form data

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/stock-items', stockItemRoutes);
app.use('/api/product-catalog', productCatalogRoutes);
app.use('/api/entry-vouchers', entryVoucherRoutes);
app.use('/api/exit-vouchers', exitVoucherRoutes);
app.use('/api/entry-vouchers/details', entryVoucherDetailsRoutes);
app.use('/api/exit-vouchers/details', exitVoucherDetailsRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Stock Management API is running',
    timestamp: new Date().toISOString()
  });
});

// Simple error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
});