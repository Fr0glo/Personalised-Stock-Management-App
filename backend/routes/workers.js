import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all workers
router.get('/', async (req, res) => {
  try {
    const workers = await getAll('SELECT * FROM workers ORDER BY F_Name, Surname');
    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// GET single worker
router.get('/:id', async (req, res) => {
  try {
    const worker = await getRow('SELECT * FROM workers WHERE worker_id = ?', [req.params.id]);
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    res.json(worker);
  } catch (error) {
    console.error('Error fetching worker:', error);
    res.status(500).json({ error: 'Failed to fetch worker' });
  }
});

// POST create new worker
router.post('/', async (req, res) => {
  try {
    const { F_Name, Surname, Carte_National, Role } = req.body;
    
    if (!F_Name || !Surname) {
      return res.status(400).json({ error: 'First name and surname are required' });
    }
    
    const result = await runQuery(
      'INSERT INTO workers (F_Name, Surname, Carte_National, Role) VALUES (?, ?, ?, ?)',
      [F_Name, Surname, Carte_National, Role]
    );
    
    const createdWorker = await getRow('SELECT * FROM workers WHERE worker_id = ?', [result.id]);
    res.status(201).json(createdWorker);
  } catch (error) {
    console.error('Error creating worker:', error);
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

// PUT update worker
router.put('/:id', async (req, res) => {
  try {
    const { F_Name, Surname, Carte_National, Role } = req.body;
    
    if (!F_Name || !Surname) {
      return res.status(400).json({ error: 'First name and surname are required' });
    }
    
    const result = await runQuery(
      'UPDATE workers SET F_Name = ?, Surname = ?, Carte_National = ?, Role = ? WHERE worker_id = ?',
      [F_Name, Surname, Carte_National, Role, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    const updatedWorker = await getRow('SELECT * FROM workers WHERE worker_id = ?', [req.params.id]);
    res.json(updatedWorker);
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

// DELETE worker
router.delete('/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM workers WHERE worker_id = ?', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    res.json({ message: 'Worker deleted successfully' });
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({ error: 'Failed to delete worker' });
  }
});

export default router; 