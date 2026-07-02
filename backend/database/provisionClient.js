// Provision a NEW CLIENT instance (subdomain-per-client model).
// Creates an isolated database for the client, runs schema + migrations on it,
// then prints the exact PM2 and Caddy lines to bring the subdomain online.
//
// Usage:  node database/provisionClient.js <client-id> [port]
//   e.g.  node database/provisionClient.js acme 4001
//
// The same code powers every client; only the database (branding + data) differs.
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = join(__dirname, '..');

const clientId = (process.argv[2] || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
const port = process.argv[3] || '4001';
const domain = process.env.DOMAIN || 'stockmanagement.app';

if (!clientId) {
  console.error('Usage: node database/provisionClient.js <client-id> [port]');
  console.error('  <client-id> becomes the subdomain and the DB filename (letters/digits/-).');
  process.exit(1);
}

const clientsDir = join(__dirname, 'clients');
if (!existsSync(clientsDir)) mkdirSync(clientsDir, { recursive: true });
const dbPath = join(clientsDir, `${clientId}.db`);

if (existsSync(dbPath)) {
  console.error(`A database already exists for "${clientId}" (${dbPath}). Aborting.`);
  process.exit(1);
}

const env = { ...process.env, DB_PATH: dbPath };
console.log(`\nProvisioning client "${clientId}"  ->  ${dbPath}`);
console.log('Creating schema...');
execSync('node database/init.js', { cwd: backendDir, env, stdio: 'inherit' });
console.log('Running migrations...');
execSync('node database/migrate.js up', { cwd: backendDir, env, stdio: 'inherit' });

console.log('\n============================================================');
console.log(`  Client "${clientId}" database is ready.`);
console.log('============================================================');
console.log('\n1) Start the instance with PM2 (its own port + database):\n');
console.log(`   DB_PATH="${dbPath}" PORT=${port} pm2 start server.js --name ${clientId}`);
console.log('   pm2 save');
console.log('\n   (Windows PowerShell:  $env:DB_PATH="..."; $env:PORT=' + port + '; pm2 start server.js --name ' + clientId + ')');
console.log('\n2) Point the subdomain at it — add this block to your Caddyfile:\n');
console.log(`   ${clientId}.${domain} {`);
console.log(`       reverse_proxy localhost:${port}`);
console.log('   }');
console.log('\n   then reload Caddy:  caddy reload   (or restart the Caddy service)');
console.log(`\n3) DNS: a wildcard  *.${domain}  A-record pointing to this server`);
console.log('   already covers every client subdomain.');
console.log('\nThe client logs in at  https://' + clientId + '.' + domain + '  as admin/admin123');
console.log('and the setup wizard walks them through their logo, colours and name.\n');
