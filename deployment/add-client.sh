#!/usr/bin/env bash
# add-client.sh — onboard a new client end to end, in one command:
#   1) create + migrate an isolated database
#   2) start the app under PM2 (its own database + port)
#   3) add the Caddy site block and reload (auto-HTTPS), with rollback if invalid
#
# Usage:  sudo /opt/stock/deployment/add-client.sh <name> <port>
#   e.g.  sudo /opt/stock/deployment/add-client.sh acme 4003
#
# Safe to re-run: existing DB / PM2 process / Caddy block are detected and reused.
set -euo pipefail

STOCK_DIR="${STOCK_DIR:-/opt/stock}"
DOMAIN="${DOMAIN:-stockmanagement.app}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"

name="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')"
port="${2:-}"

if [ -z "$name" ] || [ -z "$port" ]; then
  echo "Usage: sudo $0 <name> <port>     e.g. sudo $0 acme 4003"
  exit 1
fi
if ! printf '%s' "$port" | grep -qE '^[0-9]+$'; then
  echo "Port must be a number (e.g. 4003)."; exit 1
fi

db="$STOCK_DIR/backend/database/clients/$name.db"
host="$name.$DOMAIN"
echo "==> Onboarding '$name'  ->  $host  (port $port)"

# 1) Database ---------------------------------------------------------------
if [ -f "$db" ]; then
  echo "    DB already exists ($db) — reusing it."
else
  ( cd "$STOCK_DIR/backend" && npm run provision-client "$name" "$port" )
fi

# 2) PM2 process ------------------------------------------------------------
if pm2 describe "$name" >/dev/null 2>&1; then
  echo "    PM2 process '$name' exists — restarting with current env."
  DB_PATH="$db" PORT="$port" pm2 restart "$name" --update-env
else
  ( cd "$STOCK_DIR/backend" && DB_PATH="$db" PORT="$port" pm2 start server.js --name "$name" )
fi
pm2 save

# 3) Caddy block ------------------------------------------------------------
if grep -qF "$host {" "$CADDYFILE"; then
  echo "    Caddy block for $host already present — leaving it."
else
  cp "$CADDYFILE" "$CADDYFILE.bak"
  printf '\n%s {\n    reverse_proxy localhost:%s\n}\n' "$host" "$port" >> "$CADDYFILE"
  if caddy validate --config "$CADDYFILE" >/dev/null 2>&1; then
    systemctl reload caddy
    echo "    Caddy updated + reloaded."
  else
    echo "    !! Caddyfile became invalid — reverting, no change made."
    mv "$CADDYFILE.bak" "$CADDYFILE"
    exit 1
  fi
fi

echo "==> Live:  https://$host   (login  admin / admin123)"
