// Reset an instance for a NEW CLIENT.
// Wipes all business data (stock, catalogue, personnel, bons, commandes,
// audit logs, company branding) and office logins, keeping only the system
// accounts. Leaves the client with: admin/admin123 (fresh), the owner login,
// an empty database, and the first-run setup wizard.
//
// Usage: npm run reset-client   (asks for confirmation)
//        npm run reset-client -- --yes   (no prompt)
import sqlite3 from 'sqlite3';
import readline from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'stock_management.db');

const db = new sqlite3.Database(DB_PATH);
const run = (sql, params = []) => new Promise((resolve) => {
  db.run(sql, params, function (err) {
    // Tables that don't exist yet are fine to skip
    if (err && !/no such table/i.test(err.message)) console.error('  !', err.message);
    resolve();
  });
});

const wipe = async () => {
  console.log('Resetting this instance for a new client...');

  // Business data
  const tables = [
    'entryDetails', 'exitDetails', 'exitUnregisteredItems',
    'entryVouchers', 'exitVouchers',
    'orderItems', 'orders', 'bonCommande',
    'auditLogs', 'stockItems', 'productCatalog', 'workers'
  ];
  for (const t of tables) await run(`DELETE FROM ${t}`);
  // Restart the auto-increment counters (BC-0001, ids from 1, ...)
  for (const t of tables) await run(`DELETE FROM sqlite_sequence WHERE name = ?`, [t]);

  // Office logins created by the previous client (system accounts stay)
  await run("DELETE FROM users WHERE role NOT IN ('superadmin', 'owner', 'security', 'depot')");
  // Extra admin accounts too — keep only the canonical client admin (9996)
  await run("DELETE FROM users WHERE role = 'superadmin' AND user_id != 9996");

  // Fresh admin credentials for the new client
  await run("UPDATE users SET username = 'admin', password = 'admin123', max_users = 0, first_login = 0 WHERE role = 'superadmin'");

  // Branding back to blank -> the setup wizard shows again on first login
  await run(`UPDATE companySettings SET
    company_name = '', logo = NULL, address = '', phone = '', ice = '',
    email = '', tagline = '', color_primary = '#14246B',
    color_accent = '#F1581A', bon_template = 'classic', setup_done = 0
    WHERE id = 1`);

  // Admin button PIN + account limit back to defaults
  await run("UPDATE settings SET value = '3739' WHERE key = 'admin_pin'");
  await run("UPDATE settings SET value = '0' WHERE key = 'max_users'");

  await new Promise((r) => db.close(r));
  console.log('Done. Instance is clean:');
  console.log('  - admin / admin123 (client) — setup wizard will run on first login');
  console.log('  - owner login kept');
  console.log('  - stock, personnel, bons, commandes, branding: empty');
};

if (process.argv.includes('--yes')) {
  wipe();
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('This ERASES all business data on this instance. Type OUI to continue: ', (answer) => {
    rl.close();
    if (answer.trim().toUpperCase() === 'OUI') wipe();
    else console.log('Cancelled — nothing was changed.');
  });
}
