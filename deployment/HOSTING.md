# Hosting — a subdomain per client

Each client gets their own address, e.g. `acme.votre-domaine.com`, with their
own logo, colours and data. Behind the scenes it's **one server, one shared
codebase, one database per client**, and a reverse proxy that sends each
subdomain to that client's instance.

```
                          ┌────────────────────────── your VPS ──────────────────────────┐
  acme.domaine.com  ─┐    │  Caddy (HTTPS + routing)                                      │
  beta.domaine.com  ─┼──▶ │    acme.* → :4001 → node server.js  (DB: clients/acme.db)     │
  demo.domaine.com  ─┘    │    beta.* → :4002 → node server.js  (DB: clients/beta.db)     │
  domaine.com       ────▶ │    (main) → :4000 → node server.js  (landing / owner)         │
                          └───────────────────────────────────────────────────────────────┘
```

Same code for everyone; only the **database** (branding + stock + accounts)
differs. Update once → every client gets it. Delete/edit a client = one DB +
one process.

---

## One-time server setup

1. A cheap VPS (Hetzner / OVH / Contabo), Ubuntu, ~$5–8/mo.
2. A domain, with a **wildcard DNS A-record**: `*.votre-domaine.com` → the VPS IP
   (and `votre-domaine.com` → the VPS IP for the main site).
3. Install once:
   ```bash
   # Node 20 LTS (stable driver builds), git, build tools
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs git
   sudo npm install -g pm2
   # Caddy (auto-HTTPS reverse proxy)
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   # ...follow caddyserver.com/docs/install for the apt repo, then:
   sudo apt install -y caddy
   ```
4. Get the code + build the frontend once:
   ```bash
   cd /opt && git clone <your-repo> stock && cd stock
   cd backend && npm install --production && cd ..
   cd frontend && npm install && npm run build && cd ..
   ```
5. Put `deployment/Caddyfile` at `/etc/caddy/Caddyfile` (edit the domain), then
   `sudo systemctl reload caddy`.

## Add a client (per sale)

From `backend/`:
```bash
npm run provision-client acme 4001
```
That creates `clients/acme.db` (empty, migrated) and prints the two commands to finish:
```bash
DB_PATH="/opt/stock/backend/clients/acme.db" PORT=4001 pm2 start server.js --name acme
pm2 save
```
Then add the printed block to the `Caddyfile` and `caddy reload`. Pick the next
free port (4001, 4002, 4003, …) for each new client.

The client opens `https://acme.votre-domaine.com`, logs in as **admin / admin123**,
and the setup wizard walks them through their logo, colours and name. You set
their account limit from your **super admin** login.

## Update every client at once

The code is shared, so one update covers all clients (each keeps its own data):
```bash
cd /opt/stock && git pull origin main
cd backend && npm install --production && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 restart all
```
Migrations: run once per client DB, e.g. `for db in backend/clients/*.db; do DB_PATH="$PWD/$db" node backend/database/migrate.js up; done`.

## Backups

Each client DB is a single file in `backend/clients/`. Nightly, gzip them and
copy off-site (e.g. Backblaze B2). One line backs them all up:
```bash
for db in backend/clients/*.db; do gzip -c "$db" > "/backups/$(basename $db)-$(date +%F).gz"; done
```

## Notes
- **`DB_PATH`** + **`PORT`** are the only per-client settings; the code is identical.
- The **main domain** (`:4000`) can host a landing page or a demo instance — your choice.
- This is the "separate instance per client" model: total data isolation, no
  cross-client bugs. If you ever reach many dozens of clients and want a single
  shared database with tenant separation, that's a larger multi-tenant rewrite.
