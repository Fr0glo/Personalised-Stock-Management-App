import express from 'express';
import { getRow } from '../database/connection.js';

const router = express.Router();

// POST login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Normalize username for lookup
    const lowerUsername = username.toLowerCase().trim();
    
    // Check if user exists in users table (office staff)
    let user = await getRow(
      'SELECT * FROM users WHERE LOWER(username) = ? AND password = ?',
      [lowerUsername, password]
    );

    // If not found in users, check security staff (workers with specific usernames)
    if (!user) {
      // Check for security staff usernames (exact match, case-insensitive)
      const securityUsers = {
        'brahimbahessi': { password: 'brahimbahessi123', name: 'Brahim Bahssi' },
        'mohamadbaadi': { password: 'mohamadbaadi123', name: 'Mohamad Baadi' }
      };

      if (securityUsers[lowerUsername] && password === securityUsers[lowerUsername].password) {
        // Create user object for security staff (they don't need to exist in workers table for login)
        user = {
          user_id: lowerUsername === 'brahimbahessi' ? 9999 : 9998, // Temporary IDs
          username: securityUsers[lowerUsername].name,
          role: 'security'
        };
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: 'Login successful',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// POST logout (optional, mainly for clearing session on server if needed)
router.post('/logout', async (req, res) => {
  res.json({ message: 'Logout successful' });
});

export default router;

