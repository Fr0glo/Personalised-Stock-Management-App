import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting helps prevent server overload from too many requests
// Each IP address can make up to 200 requests every 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Maximum requests per IP in the time window
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
app.use('/api/entry-vouchers', entryVoucherRoutes);
app.use('/api/exit-vouchers', exitVoucherRoutes);
app.use('/api/entry-vouchers/details', entryVoucherDetailsRoutes);
app.use('/api/exit-vouchers/details', exitVoucherDetailsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/orders', orderRoutes);

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
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});