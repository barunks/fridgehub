#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FamilyHub — SSL Auto-Renewal
# Run by cron on the VPS: 0 3 * * * /opt/familyhub/deploy/renew-ssl.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REMOTE_DIR="/opt/familyhub"
COMPOSE="docker compose -f $REMOTE_DIR/deploy/docker-compose.prod.yml"
LOG="/var/log/familyhub-ssl-renew.log"

echo "[$(date)] Starting SSL renewal check" >> "$LOG"

$COMPOSE run --rm certbot renew --quiet >> "$LOG" 2>&1

# Reload nginx only if cert was actually renewed
if grep -q "Congratulations" "$LOG" 2>/dev/null; then
  echo "[$(date)] Certificate renewed — reloading nginx" >> "$LOG"
  $COMPOSE exec nginx nginx -s reload >> "$LOG" 2>&1
else
  echo "[$(date)] No renewal needed" >> "$LOG"
fi

echo "[$(date)] Done" >> "$LOG"
