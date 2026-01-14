import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import resetVouchers from './resetVouchers.js';
import clearStock from './clearStock.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === __filename;

const resetAll = async () => {
  try {
    console.log('🔄 Starting complete reset (vouchers + stock)...\n');
    
    // Reset vouchers
    console.log('Step 1: Resetting vouchers...');
    await resetVouchers();
    console.log('');
    
    // Clear stock
    console.log('Step 2: Clearing stock...');
    await clearStock();
    console.log('');
    
    console.log('🎉 Complete reset finished successfully!');
    console.log('✅ All vouchers cleared');
    console.log('✅ All stock quantities reset to 0');
    console.log('✅ Product catalog preserved');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  }
};

// Run if this file is executed directly
if (isDirectRun) {
  resetAll()
    .then(() => {
      console.log('✅ Reset all finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Reset all failed:', error);
      process.exit(1);
    });
}

export default resetAll;

