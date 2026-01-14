import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all orders (pending orders for security page, or all orders if status param provided)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    // Build query - if status is specified and not 'all', filter by it, otherwise return all orders
    let whereClause = '';
    if (status && status !== 'all') {
      whereClause = `WHERE o.status = '${status}'`;
    }
    
    // First get all orders (or filtered by status)
    const orders = await getAll(`
      SELECT 
        o.order_id,
        o.date,
        o.status,
        o.created_by,
        COALESCE(u.username, 'Utilisateur supprimé') as created_by_name
      FROM orders o
      LEFT JOIN users u ON o.created_by = u.user_id
      ${whereClause}
      ORDER BY o.date DESC
    `);

    // Then get items for each order
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const items = await getAll(
        `SELECT item_name as name, quantity, unit, place
         FROM orderItems
         WHERE order_id = ?`,
        [order.order_id]
      );

      return {
        id: order.order_id,
        date: order.date,
        status: order.status,
        created_by: order.created_by_name,
        items: items || []
      };
    }));

    res.json(ordersWithItems);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST create new order
router.post('/', async (req, res) => {
  try {
    const { items, created_by } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    if (!created_by) {
      return res.status(400).json({ error: 'Created by is required' });
    }

    // Get user_id from username
    const user = await getRow('SELECT user_id FROM users WHERE username = ?', [created_by]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    // Create order
    const orderResult = await runQuery(
      'INSERT INTO orders (date, status, created_by) VALUES (?, ?, ?)',
      [new Date().toISOString(), 'pending', user.user_id]
    );

    const orderId = orderResult.id;

    // Get place from stock items for each order item
    for (const item of items) {
      // Get place from stock item if it exists
      const stockItem = await getRow('SELECT place FROM stockItems WHERE item_name = ? LIMIT 1', [item.item_name]);
      const place = stockItem ? stockItem.place : null;
      
      await runQuery(
        'INSERT INTO orderItems (order_id, item_name, quantity, unit, place) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.item_name, item.orderQuantity || item.quantity, item.unit, place]
      );
    }

    res.status(201).json({
      order_id: orderId,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PATCH update order status
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await runQuery(
      'UPDATE orders SET status = ? WHERE order_id = ?',
      [status, orderId]
    );

    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;

