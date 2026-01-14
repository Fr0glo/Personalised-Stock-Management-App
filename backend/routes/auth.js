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

    // If found in users table, ensure they have a role
    if (user) {
      // Set default role if not present
      if (!user.role) {
        user.role = 'admin';
      }
    } else {
      // Check for depot workers (Brahim and Mohamad)
      const depotUsers = {
        'brahimbahessi': { password: 'brahimbahessi123', name: 'Brahim Bahssi', id: 9999 },
        'brahimbahessin': { password: 'brahimbahessi123', name: 'Brahim Bahssi', id: 9999 },
        'brahimbahessine': { password: 'brahimbahessi123', name: 'Brahim Bahssi', id: 9999 },
        'mohamadbaadi': { password: 'mohamadbaadi123', name: 'Mohamad Baadi', id: 9998 },
        'mohamedbaadi': { password: 'mohamadbaadi123', name: 'Mohamad Baadi', id: 9998 },
        'mohammadbaadi': { password: 'mohamadbaadi123', name: 'Mohamad Baadi', id: 9998 }
      };

      const depotUser = depotUsers[lowerUsername];
      if (depotUser && password === depotUser.password) {
        // Create user object for depot workers
        user = {
          user_id: depotUser.id,
          username: depotUser.name,
          role: 'depot'
        };
      } else {
        // Check for security staff
        const securityUsers = {
          'security': { password: 'security123', name: 'Security', id: 9997 }
        };

        const securityUser = securityUsers[lowerUsername];
        if (securityUser && password === securityUser.password) {
          // Create user object for security staff
          user = {
            user_id: securityUser.id,
            username: securityUser.name,
            role: 'security'
          };
        }
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

