import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

let usersSchemaEnsured = false;

const ensureUsersSchema = async () => {
  if (usersSchemaEnsured) return;
  try {
    const columns = await getAll('PRAGMA table_info(users)');
    const columnNames = columns.map(col => col.name);
    if (!columnNames.includes('is_deleted')) {
      await runQuery('ALTER TABLE users ADD COLUMN is_deleted INTEGER DEFAULT 0');
    }
    usersSchemaEnsured = true;
  } catch (error) {
    console.error('Error ensuring users schema:', error);
  }
};

// GET all users (only non-deleted)
router.get('/', async (req, res) => {
  try {
    await ensureUsersSchema();
    const users = await getAll(
      'SELECT * FROM users WHERE COALESCE(is_deleted, 0) = 0 ORDER BY username'
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    await ensureUsersSchema();
    const user = await getRow(
      'SELECT * FROM users WHERE user_id = ? AND COALESCE(is_deleted, 0) = 0',
      [req.params.id]
    );

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
    await ensureUsersSchema();
    const { username, role, password } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const result = await runQuery(
      'INSERT INTO users (username, role, password) VALUES (?, ?, ?)',
      [username.trim(), role || 'office', password]
    );

    const createdUser = await getRow('SELECT user_id, username, role FROM users WHERE user_id = ?', [result.id]);
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

// PUT update user (username required; role and password optional — only changed if sent)
router.put('/:id', async (req, res) => {
  try {
    await ensureUsersSchema();
    const { username, role, password } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const existing = await getRow('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    await runQuery(
      'UPDATE users SET username = ?, role = ?, password = ? WHERE user_id = ?',
      [
        username.trim(),
        role !== undefined ? role : existing.role,
        (password !== undefined && password !== '') ? password : existing.password,
        req.params.id
      ]
    );

    const updatedUser = await getRow('SELECT user_id, username, role FROM users WHERE user_id = ?', [req.params.id]);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
});

// DELETE user (soft delete: hide from lists but keep name on past vouchers)
router.delete('/:id', async (req, res) => {
  try {
    await ensureUsersSchema();
    const user = await getRow(
      'SELECT * FROM users WHERE user_id = ? AND COALESCE(is_deleted, 0) = 0',
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await runQuery('UPDATE users SET is_deleted = 1 WHERE user_id = ?', [req.params.id]);

    res.json({
      message: 'User removed from personnel (name kept on past vouchers)',
      deletedUser: user.username
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router; 