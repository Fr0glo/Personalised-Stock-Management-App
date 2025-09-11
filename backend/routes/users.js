import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all users
router.get('/', async (req, res) => {
  try {
    const users = await getAll('SELECT * FROM users ORDER BY username');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    const user = await getRow('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST create new user
router.post('/', async (req, res) => {
  try {
    const { username, role } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = await runQuery(
      'INSERT INTO users (username, role) VALUES (?, ?)',
      [username, role || 'staff']
    );
    
    const createdUser = await getRow('SELECT * FROM users WHERE user_id = ?', [result.id]);
    res.status(201).json(createdUser);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// PUT update user
router.put('/:id', async (req, res) => {
  try {
    const { username, role } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = await runQuery(
      'UPDATE users SET username = ?, role = ? WHERE user_id = ?',
      [username, role, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const updatedUser = await getRow('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE user
router.delete('/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router; 