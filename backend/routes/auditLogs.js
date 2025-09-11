import express from 'express';
import { getAll, getRow } from '../database/connection.js';

const router = express.Router();

// GET all audit logs
router.get('/', async (req, res) => {
  try {
    const logs = await getAll(`
      SELECT al.*, si.item_name, u.username 
      FROM auditLogs al
      JOIN stockItems si ON al.item_id = si.item_id
      JOIN users u ON al.user_id = u.user_id
      ORDER BY al.timestamp DESC
    `);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET audit logs for specific item
router.get('/item/:itemId', async (req, res) => {
  try {
    const logs = await getAll(`
      SELECT al.*, si.item_name, u.username 
      FROM auditLogs al
      JOIN stockItems si ON al.item_id = si.item_id
      JOIN users u ON al.user_id = u.user_id
      WHERE al.item_id = ?
      ORDER BY al.timestamp DESC
    `, [req.params.itemId]);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching item audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch item audit logs' });
  }
});

// GET audit logs for specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const logs = await getAll(`
      SELECT al.*, si.item_name, u.username 
      FROM auditLogs al
      JOIN stockItems si ON al.item_id = si.item_id
      JOIN users u ON al.user_id = u.user_id
      WHERE al.user_id = ?
      ORDER BY al.timestamp DESC
    `, [req.params.userId]);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch user audit logs' });
  }
});

export default router; 