import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

let workersSchemaEnsured = false;

const ensureWorkersSchema = async () => {
  if (workersSchemaEnsured) return;
  try {
    const columns = await getAll('PRAGMA table_info(workers)');
    const columnNames = columns.map(col => col.name);
    if (!columnNames.includes('is_deleted')) {
      await runQuery('ALTER TABLE workers ADD COLUMN is_deleted INTEGER DEFAULT 0');
    }
    workersSchemaEnsured = true;
  } catch (error) {
    console.error('Error ensuring workers schema:', error);
  }
};

// GET all workers (only non-deleted, for personnel list and dropdowns)
router.get('/', async (req, res) => {
  try {
    await ensureWorkersSchema();
    const workers = await getAll(
      'SELECT * FROM workers WHERE COALESCE(is_deleted, 0) = 0 ORDER BY F_Name, Surname'
    );
    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// GET single worker (returns 404 if worker was soft-deleted)
router.get('/:id', async (req, res) => {
  try {
    await ensureWorkersSchema();
    const worker = await getRow(
      'SELECT * FROM workers WHERE worker_id = ? AND COALESCE(is_deleted, 0) = 0',
      [req.params.id]
    );
    
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

// DELETE worker (soft delete: hide from personnel list but keep name on past vouchers)
router.delete('/:id', async (req, res) => {
  try {
    await ensureWorkersSchema();
    const worker = await getRow(
      'SELECT * FROM workers WHERE worker_id = ? AND COALESCE(is_deleted, 0) = 0',
      [req.params.id]
    );
    
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Soft delete: mark as deleted so they disappear from personnel list,
    // but keep the row so vouchers still show their name (JOIN still finds them)
    const result = await runQuery(
      'UPDATE workers SET is_deleted = 1 WHERE worker_id = ?',
      [req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }
    
    res.json({ 
      message: 'Worker removed from personnel (name kept on past vouchers)',
      deletedWorker: `${worker.F_Name} ${worker.Surname}`
    });
  } catch (error) {
    console.error('Error deleting worker:', error);

    // Handle SQLite \"database is locked\" / busy errors more gracefully
    const message = error?.message || '';
    const code = error?.code || '';
    if (code === 'SQLITE_BUSY' || /locked/i.test(message)) {
      try {
        // Check if the worker is already marked as deleted
        const workerRow = await getRow(
          'SELECT F_Name, Surname, is_deleted FROM workers WHERE worker_id = ?',
          [req.params.id]
        );

        if (workerRow && workerRow.is_deleted === 1) {
          return res.json({
            message: 'Worker removed from personnel (name kept on past vouchers)',
            deletedWorker: `${workerRow.F_Name} ${workerRow.Surname}`,
            note: 'Completed despite transient database lock'
          });
        }
      } catch (checkError) {
        console.error('Error checking worker after delete lock:', checkError);
      }

      return res.status(503).json({
        error: 'Base de données momentanément occupée. Veuillez réessayer la suppression dans quelques secondes.'
      });
    }

    res.status(500).json({ 
      error: 'Failed to delete worker',
      details: error.message 
    });
  }
});

export default router; 