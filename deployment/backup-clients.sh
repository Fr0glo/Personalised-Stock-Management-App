#!/usr/bin/env bash
#
# backup-clients.sh — nightly off-site backup of every client database.
#
# Each client's data lives in a single SQLite file:
#   /opt/stock/backend/database/clients/<client>.db
# This script makes a SAFE hot snapshot of each one (works even while the app is
# running, because SQLite is in WAL mode), gzips it, keeps a few days locally,
# and optionally pushes the whole backup folder off-site with rclone
# (Azure Blob Storage, Backblaze B2, S3 — whatever remote you configure).
#
# ── Setup (once, on the VPS) ─────────────────────────────────────────────────
#   sudo apt install -y sqlite3            # the .backup command
#   # For off-site copies, install + configure rclone with ONE remote:
#   sudo -v ; curl https://rclone.org/install.sh | sudo bash
#   rclone config                          # create a remote, e.g. "offsite"
#                                          #  - Azure Blob:  type = azureblob
#                                          #  - Backblaze:   type = b2
#   # then set RCLONE_REMOTE below (e.g. offsite:stock-backups)
#
# ── Run it nightly (cron) ────────────────────────────────────────────────────
#   crontab -e   and add:
#   15 2 * * *  /opt/stock/deployment/backup-clients.sh >> /var/log/stock-backup.log 2>&1
#   (runs every night at 02:15; logs to /var/log/stock-backup.log)
#
set -euo pipefail

# ── Config (override via environment if you like) ────────────────────────────
CLIENTS_DIR="${CLIENTS_DIR:-/opt/stock/backend/database/clients}"
BACKUP_DIR="${BACKUP_DIR:-/opt/stock/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"                 # how many days of local backups to keep
RCLONE_REMOTE="${RCLONE_REMOTE:-}"          # e.g. "offsite:stock-backups" — blank = local only

STAMP="$(date +%F_%H%M)"                    # 2026-07-02_0215
DEST="${BACKUP_DIR}/${STAMP}"
mkdir -p "$DEST"

echo "[$(date +%F' '%T)] Backing up client databases from ${CLIENTS_DIR}"

shopt -s nullglob
dbs=("${CLIENTS_DIR}"/*.db)
if [ ${#dbs[@]} -eq 0 ]; then
  echo "  No client databases found in ${CLIENTS_DIR} — nothing to do."
  exit 0
fi

for db in "${dbs[@]}"; do
  name="$(basename "$db" .db)"
  tmp="${DEST}/${name}.db"
  # Safe online snapshot (consistent even mid-write); falls back to a file copy.
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$db" ".backup '${tmp}'"
  else
    echo "  ! sqlite3 not installed — doing a plain file copy for ${name} (less safe)"
    cp "$db" "$tmp"
  fi
  gzip -f "$tmp"
  echo "  ✓ ${name}  ->  ${tmp}.gz"
done

# ── Push off-site (if a remote is configured) ────────────────────────────────
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
  echo "  Uploading to ${RCLONE_REMOTE} ..."
  rclone copy "$DEST" "${RCLONE_REMOTE}/${STAMP}" --transfers 4
  echo "  ✓ Off-site copy complete."
elif [ -n "$RCLONE_REMOTE" ]; then
  echo "  ! RCLONE_REMOTE set but rclone not installed — skipped off-site upload."
else
  echo "  (No RCLONE_REMOTE set — local backups only. Set it for off-site safety.)"
fi

# ── Prune old local backups ──────────────────────────────────────────────────
find "$BACKUP_DIR" -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true
echo "[$(date +%F' '%T)] Done. Kept last ${KEEP_DAYS} days locally in ${BACKUP_DIR}."
