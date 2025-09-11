import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'stock_management.db');
const db = new sqlite3.Database(dbPath);

const cleanupDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('🧹 Starting database cleanup...');
      
      // Clean up duplicate workers
      db.run(`
        DELETE FROM workers 
        WHERE worker_id NOT IN (
          SELECT MIN(worker_id) 
          FROM workers 
          GROUP BY F_Name, Surname, Carte_National
        )
      `, function(err) {
        if (err) {
          console.error('Error cleaning workers:', err);
        } else {
          console.log(`✅ Removed ${this.changes} duplicate workers`);
        }
      });

      // Clean up duplicate stock items
      db.run(`
        DELETE FROM stockItems 
        WHERE item_id NOT IN (
          SELECT MIN(item_id) 
          FROM stockItems 
          GROUP BY item_name
        )
      `, function(err) {
        if (err) {
          console.error('Error cleaning stock items:', err);
        } else {
          console.log(`✅ Removed ${this.changes} duplicate stock items`);
        }
      });

      // Clean up duplicate users
      db.run(`
        DELETE FROM users 
        WHERE user_id NOT IN (
          SELECT MIN(user_id) 
          FROM users 
          GROUP BY username
        )
      `, function(err) {
        if (err) {
          console.error('Error cleaning users:', err);
        } else {
          console.log(`✅ Removed ${this.changes} duplicate users`);
        }
      });

      // Reset auto-increment counters
      db.run('DELETE FROM sqlite_sequence WHERE name IN ("workers", "stockItems", "users")', function(err) {
        if (err) {
          console.error('Error resetting sequences:', err);
        } else {
          console.log('✅ Reset auto-increment counters');
        }
      });

      // Show current data
      db.all('SELECT COUNT(*) as count FROM workers', (err, rows) => {
        if (err) {
          console.error('Error counting workers:', err);
        } else {
          console.log(`📊 Current workers: ${rows[0].count}`);
        }
      });

      db.all('SELECT COUNT(*) as count FROM stockItems', (err, rows) => {
        if (err) {
          console.error('Error counting stock items:', err);
        } else {
          console.log(`📊 Current stock items: ${rows[0].count}`);
        }
      });

      db.all('SELECT COUNT(*) as count FROM users', (err, rows) => {
        if (err) {
          console.error('Error counting users:', err);
        } else {
          console.log(`📊 Current users: ${rows[0].count}`);
        }
      });

      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🎉 Database cleanup completed!');
          resolve();
        }
      });
    });
  });
};

// Run cleanup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDatabase()
    .then(() => {
      console.log('✅ Cleanup finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export default cleanupDatabase; 