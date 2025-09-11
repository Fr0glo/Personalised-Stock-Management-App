import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'stock_management.db');
const db = new sqlite3.Database(dbPath);

// Import from CSV file
const importFromCSV = (filePath, tableName) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    const csvData = fs.readFileSync(filePath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    console.log(`📁 Importing ${lines.length - 1} records to ${tableName}`);
    console.log(`📋 Headers: ${headers.join(', ')}`);

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length === headers.length) {
        const placeholders = headers.map(() => '?').join(', ');
        const query = `INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${placeholders})`;
        
        db.run(query, values, function(err) {
          if (err) {
            console.error(`❌ Error importing row ${i}:`, err.message);
          }
        });
      }
    }

    console.log(`✅ Import completed for ${tableName}`);
    resolve();
  });
};

// Import stock items from CSV
const importStockItems = (filePath) => {
  return new Promise((resolve, reject) => {
    console.log('📦 Importing stock items...');
    
    const csvData = fs.readFileSync(filePath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Expected CSV format: item_name,quantity,unit,notes
    for (let i = 1; i < lines.length; i++) {
      const [item_name, quantity, unit, notes] = lines[i].split(',').map(v => v.trim());
      
      if (item_name && quantity) {
        db.run(
          'INSERT INTO stockItems (item_name, quantity, unit, notes) VALUES (?, ?, ?, ?)',
          [item_name, parseInt(quantity) || 0, unit || 'pcs', notes || '']
        );
      }
    }
    
    console.log(`✅ Imported ${lines.length - 1} stock items`);
    resolve();
  });
};

// Import workers from CSV
const importWorkers = (filePath) => {
  return new Promise((resolve, reject) => {
    console.log('👥 Importing workers...');
    
    const csvData = fs.readFileSync(filePath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    // Expected CSV format: F_Name,Surname,Carte_National,Role
    for (let i = 1; i < lines.length; i++) {
      const [F_Name, Surname, Carte_National, Role] = lines[i].split(',').map(v => v.trim());
      
      if (F_Name && Surname) {
        db.run(
          'INSERT INTO workers (F_Name, Surname, Carte_National, Role) VALUES (?, ?, ?, ?)',
          [F_Name, Surname, Carte_National || '', Role || '']
        );
      }
    }
    
    console.log(`✅ Imported ${lines.length - 1} workers`);
    resolve();
  });
};

// Import from JSON file
const importFromJSON = (filePath, tableName) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📁 Importing ${jsonData.length} records to ${tableName}`);

    jsonData.forEach((record, index) => {
      const columns = Object.keys(record);
      const values = Object.values(record);
      const placeholders = columns.map(() => '?').join(', ');
      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      db.run(query, values, function(err) {
        if (err) {
          console.error(`❌ Error importing record ${index}:`, err.message);
        }
      });
    });

    console.log(`✅ Import completed for ${tableName}`);
    resolve();
  });
};

// Main import function
const runImport = async () => {
  try {
    console.log('🚀 Starting data import...');
    
    // Import stock items if file exists
    const stockItemsFile = join(__dirname, 'import', 'stock_items.csv');
    if (fs.existsSync(stockItemsFile)) {
      await importStockItems(stockItemsFile);
    } else {
      console.log('⚠️  stock_items.csv not found in database/import/ folder');
    }
    
    // Import workers if file exists
    const workersFile = join(__dirname, 'import', 'workers.csv');
    if (fs.existsSync(workersFile)) {
      await importWorkers(workersFile);
    } else {
      console.log('⚠️  workers.csv not found in database/import/ folder');
    }
    
    // Import users if file exists
    const usersFile = join(__dirname, 'import', 'users.csv');
    if (fs.existsSync(usersFile)) {
      await importFromCSV(usersFile, 'users');
    } else {
      console.log('⚠️  users.csv not found in database/import/ folder');
    }
    
    console.log('🎉 Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  } finally {
    db.close();
  }
};

// Create import folder if it doesn't exist
const importFolder = join(__dirname, 'import');
if (!fs.existsSync(importFolder)) {
  fs.mkdirSync(importFolder);
  console.log('📁 Created database/import/ folder');
}

// Run import if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runImport()
    .then(() => {
      console.log('✅ Import finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}

export { importFromCSV, importFromJSON, importStockItems, importWorkers }; 