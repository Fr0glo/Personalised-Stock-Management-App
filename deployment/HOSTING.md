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

1. A cheap VPS, Ubuntu 22.04+. **DigitalOcean** is a good pick if you have the
   GitHub Education **$200 credit** (covers ~year 1 free). Create a **Basic
   Droplet, 2 GB RAM ($12/mo)** — enough for Caddy + several client node
   processes + the frontend build. (Hetzner / OVH / Contabo work identically.)
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
That creates `database/clients/acme.db` (empty, migrated) and prints the two commands to finish:
```bash
DB_PATH="/opt/stock/backend/database/clients/acme.db" PORT=4001 pm2 start server.js --name acme
pm2 save
```
Then add the printed block to the `Caddyfile` and `caddy reload`. Pick the next
free port (4001, 4002, 4003, …) for each new client.

The client opens `https://acme.stockmanagement.app`, logs in as **admin / admin123**,
and the setup wizard walks them through their logo, colours and name. You set
their account limit from your **super admin** login.

## Enable a paid / optional feature for one client

Optional features (e.g. `facture`) ship in the shared code but are **off by
default**. You turn one on for a specific client server-side once they've paid —
the client cannot enable it themselves from the app. From `backend/`:
```bash
npm run set-feature acme facture on     # enable
npm run set-feature acme facture off    # disable
```
It flips the flag in that client's own database (`companySettings.features`).
The client sees the change after a full page refresh. Same code for everyone;
only that client's database differs.

## Update every client at once

The code is shared, so one update covers all clients (each keeps its own data):
```bash
cd /opt/stock && git pull origin main
cd backend && npm install --production && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 restart all
```
Migrations: run once per client DB, e.g. `for db in backend/database/clients/*.db; do DB_PATH="$PWD/$db" node backend/database/migrate.js up; done`.

## Backups

Each client DB is a single file in `backend/database/clients/`. Because it's all
one disk, **off-site backups are non-negotiable.** Use the ready-made script:

```bash
sudo apt install -y sqlite3                       # safe hot-snapshot command
# optional but recommended — off-site copy via rclone (Azure Blob / Backblaze):
curl https://rclone.org/install.sh | sudo bash
rclone config                                     # make a remote, e.g. "offsite"

# nightly at 02:15 (crontab -e):
15 2 * * *  RCLONE_REMOTE="offsite:stock-backups" /opt/stock/deployment/backup-clients.sh >> /var/log/stock-backup.log 2>&1
```

`deployment/backup-clients.sh` makes a WAL-safe snapshot of every client DB,
gzips it, keeps the last 7 days locally, and (if `RCLONE_REMOTE` is set) pushes
the lot off-site. With the GitHub Education **Azure $100 credit**, an **Azure
Blob** remote gives you backups on a *different provider* than the app — so a
DigitalOcean outage can't take your backups with it. Also turn on DigitalOcean's
automated **Droplet snapshots** (~$1/mo) for whole-server restore.

## Notes
- **`DB_PATH`** + **`PORT`** are the only per-client settings; the code is identical.
- The **main domain** (`:4000`) can host a landing page or a demo instance — your choice.
- This is the "separate instance per client" model: total data isolation, no
  cross-client bugs. If you ever reach many dozens of clients and want a single
  shared database with tenant separation, that's a larger multi-tenant rewrite.
