import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const dbPath = join(__dirname, 'stock_management.db');

const addIndexes = () => {
  return new Promise((resolvePromise, reject) => {
    console.log('📊 Adding database indexes for performance...');

    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Indexes for faster searches
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_stockItems_item_name ON stockItems(item_name)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating index on stockItems.item_name:', err.message);
        } else {
          console.log('✅ Created index on stockItems.item_name');
        }
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_stockItems_quantity ON stockItems(quantity)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating index on stockItems.quantity:', err.message);
        } else {
          console.log('✅ Created index on stockItems.quantity');
        }
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_productCatalog_item_name ON productCatalog(item_name)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating index on productCatalog.item_name:', err.message);
        } else {
          console.log('✅ Created index on productCatalog.item_name');
        }
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_entryVouchers_date ON entryVouchers(date)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating index on entryVouchers.date:', err.message);
        } else {
          console.log('✅ Created index on entryVouchers.date');
        }
      });

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_exitVouchers_date ON exitVouchers(date)
      `, (err) => {
        if (err) {
          console.error('❌ Error creating index on exitVouchers.date:', err.message);
        } else {
          console.log('✅ Created index on exitVouchers.date');
        }

        db.close((closeErr) => {
          if (closeErr) {
            reject(closeErr);
          } else {
            console.log('🎉 Database indexes added successfully!');
            console.log('💡 These indexes will speed up searches with large datasets (1000+ products)');
            resolvePromise();
          }
        });
      });
    });
  });
};

// Run if this file is executed directly
if (isDirectRun) {
  addIndexes()
    .then(() => {
      console.log('✅ Index creation finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Index creation failed:', error);
      process.exit(1);
    });
}

export default addIndexes;



