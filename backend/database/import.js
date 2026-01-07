import fs from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const dbPath = join(__dirname, 'stock_management.db');
const db = new sqlite3.Database(dbPath);

// Import products.csv with headers: id, title, default price, default unite
const importProductsFromCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) {
        console.log('⚠️  products.csv not found:', filePath);
        return resolve();
      }

      console.log('📦 Importing products.csv → stockItems & productCatalog ...');
      const csvData = fs.readFileSync(filePath, 'utf8');
      const lines = csvData.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        console.log('⚠️  products.csv has no data');
        return resolve();
      }

      // normalize headers (lowercase + trim)
      const headerRow = lines[0].split(',').map(h => h.trim().toLowerCase());
      const idxTitle = headerRow.findIndex(h => h === 'title');
      const idxPrice = headerRow.findIndex(h => h === 'default price');
      const idxUnit  = headerRow.findIndex(h => h === 'default unite');

      if (idxTitle === -1) {
        console.log('❌ products.csv missing "title" header');
        return resolve();
      }

      // Use transaction for better performance and reliability
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stockStmt = db.prepare(
          'INSERT INTO stockItems (item_name, quantity, unit, notes) VALUES (?, ?, ?, ?)'
        );
        const catalogStmt = db.prepare(
          'INSERT INTO productCatalog (item_name, default_unit, default_price, notes) VALUES (?, ?, ?, ?)'
        );

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(v => v.trim());
          // skip empty
          if (!cols[idxTitle]) continue;

          const itemName = cols[idxTitle];
          const unit = idxUnit !== -1 ? cols[idxUnit] : 'pcs';
          const priceRaw = idxPrice !== -1 ? cols[idxPrice] : '';
          const notes = priceRaw ? `price: ${priceRaw}` : '';
          const price = priceRaw ? parseFloat(priceRaw) || null : null;

          // Insert into stockItems with zero initial quantity (acts as template until used)
          stockStmt.run([itemName, 0, unit, notes]);

          // Insert into productCatalog for Bon d'entrée search
          catalogStmt.run([itemName, unit, price, notes]);
        }

        stockStmt.finalize((stockErr) => {
          if (stockErr) {
            console.error('❌ Error finalizing stockItems statement:', stockErr.message);
            db.run('ROLLBACK');
            return reject(stockErr);
          }
          catalogStmt.finalize((catalogErr) => {
            if (catalogErr) {
              console.error('❌ Error finalizing productCatalog statement:', catalogErr.message);
              db.run('ROLLBACK');
              return reject(catalogErr);
            }
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('❌ Error committing transaction:', commitErr.message);
                return reject(commitErr);
              }
              console.log('✅ Transaction committed successfully');
              console.log('✅ products.csv import completed');
              resolve();
            });
          });
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};

// Clear existing stock items and catalog entries
const clearStockItems = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM stockItems', (err) => {
        if (err) {
          console.error('❌ Error clearing stock items:', err.message);
          return reject(err);
        } else {
          console.log('🗑️  Cleared existing stock items');
        }
      });
      db.run('DELETE FROM productCatalog', (err) => {
        if (err) {
          console.error('❌ Error clearing product catalog:', err.message);
          return reject(err);
        } else {
          console.log('🗑️  Cleared existing product catalog items');
          resolve();
        }
      });
    });
  });
};

// Main import function
const runImport = async () => {
  try {
    console.log('🚀 Starting import process...');
    
    // Clear existing stock items first (uncomment the next line if you want to replace all data)
    await clearStockItems();
    
    // Import products.csv if present
    const productsFile = join(__dirname, 'import', 'products.csv');
    if (fs.existsSync(productsFile)) {
      await importProductsFromCSV(productsFile);
    } else {
      console.log('⚠️  products.csv not found in database/import/');
    }
    
    console.log('✅ Import process completed!');
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    db.close();
  }
};

// Run if this file is executed directly
const currentFile = fileURLToPath(import.meta.url);
if (currentFile === process.argv[1]) {
  runImport()
    .then(() => {
      console.log('🎉 All done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Error:', err);
      process.exit(1);
    });
}