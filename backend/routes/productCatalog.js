import express from 'express';
import { getAll, getRow, runQuery } from '../database/connection.js';

const router = express.Router();

// GET all products from catalog with optional search
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    let query = 'SELECT * FROM productCatalog';
    let params = [];

    // Add search functionality
    if (search && search.length >= 2) {
      query += ' WHERE item_name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY item_name';
    
    // Limit results for performance
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const products = await getAll(query, params);
    res.json(products);
  } catch (error) {
    console.error('Error fetching product catalog:', error);
    res.status(500).json({ error: 'Failed to fetch product catalog' });
  }
});

// GET single product from catalog
router.get('/:id', async (req, res) => {
  try {
    const product = await getRow('SELECT * FROM productCatalog WHERE catalog_id = ?', [req.params.id]);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found in catalog' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product from catalog:', error);
    res.status(500).json({ error: 'Failed to fetch product from catalog' });
  }
});

// POST add new product to catalog
router.post('/', async (req, res) => {
  try {
    const { item_name, default_unit, default_price, notes } = req.body;
    
    if (!item_name) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    
    const result = await runQuery(
      'INSERT INTO productCatalog (item_name, default_unit, default_price, notes) VALUES (?, ?, ?, ?)',
      [item_name, default_unit || 'pcs', default_price, notes]
    );
    
    const createdProduct = await getRow('SELECT * FROM productCatalog WHERE catalog_id = ?', [result.lastID]);
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error adding product to catalog:', error);
    res.status(500).json({ error: 'Failed to add product to catalog' });
  }
});

// PUT update product in catalog
router.put('/:id', async (req, res) => {
  try {
    const { item_name, default_unit, default_price, notes } = req.body;
    
    if (!item_name) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    
    const result = await runQuery(
      'UPDATE productCatalog SET item_name = ?, default_unit = ?, default_price = ?, notes = ? WHERE catalog_id = ?',
      [item_name, default_unit, default_price, notes, req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found in catalog' });
    }
    
    const updatedProduct = await getRow('SELECT * FROM productCatalog WHERE catalog_id = ?', [req.params.id]);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product in catalog:', error);
    res.status(500).json({ error: 'Failed to update product in catalog' });
  }
});

// DELETE product from catalog
router.delete('/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM productCatalog WHERE catalog_id = ?', [req.params.id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found in catalog' });
    }
    
    res.json({ message: 'Product removed from catalog successfully' });
  } catch (error) {
    console.error('Error deleting product from catalog:', error);
    res.status(500).json({ error: 'Failed to delete product from catalog' });
  }
});

export default router;
