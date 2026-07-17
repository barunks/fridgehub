#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FamilyHub — VastSpace VPS Deploy Script
#
# Usage:
#   ./deploy/deploy.sh --setup      # First-time server setup + deploy
#   ./deploy/deploy.sh --update     # Pull latest code and redeploy
#   ./deploy/deploy.sh --ssl        # Issue / renew SSL certificate only
#   ./deploy/deploy.sh --validate   # Check all services are healthy
#   ./deploy/deploy.sh --logs       # Tail live logs
#
# Requirements (local machine):
#   - SSH access to VPS: ssh root@YOUR_VPS_IP
#   - Domain DNS A record pointing to VPS IP
#   - .env filled from deploy/.env.production
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"

# ── Load .env ────────────────────────────────────────────────────────────────
ENV_FILE="$PROJECT_ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env not found. Copy deploy/.env.production to .env and fill in values."
  exit 1
fi
set -a; source "$ENV_FILE"; set +a

DOMAIN="${DOMAIN:?DOMAIN not set in .env}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL not set in .env}"

# ── SSH config ───────────────────────────────────────────────────────────────
# Set these or pass via environment
REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
REMOTE_DIR="${REMOTE_DIR:-/opt/familyhub}"
GIT_REPO="${GIT_REPO:-git@github.com:barunks/familyhub.git}"
BRANCH="${BRANCH:-main}"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()   { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()     { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()   { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()    { echo -e "${RED}[ERR ]${NC}  $*"; }
header() { echo -e "\n${BOLD}━━━ $* ━━━${NC}\n"; }

# ── Validate config ──────────────────────────────────────────────────────────
if [[ -z "$REMOTE_HOST" ]]; then
  err "REMOTE_HOST not set. Add it to .env or run: REMOTE_HOST=1.2.3.4 ./deploy/deploy.sh"
  exit 1
fi

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=30"
SSH_CMD="ssh $SSH_OPTS $REMOTE_USER@$REMOTE_HOST"

remote()      { $SSH_CMD "$@"; }
remote_tty()  { ssh -t $SSH_OPTS $REMOTE_USER@$REMOTE_HOST "$@"; }

MODE="${1:---update}"

# ─────────────────────────────────────────────────────────────────────────────
# PHASE: Server setup (run once on a fresh VPS)
# ─────────────────────────────────────────────────────────────────────────────
setup_server() {
  header "Phase 1: Server Setup"

  info "Testing SSH connection to $REMOTE_HOST..."
  if ! remote "echo connected" &>/dev/null; then
    err "Cannot SSH to $REMOTE_USER@$REMOTE_HOST"
    echo "  Check: ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST"
    exit 1
  fi
  ok "SSH connected"

  info "Updating system packages..."
  remote "apt-get update -qq && apt-get upgrade -y -qq"
  ok "System updated"

  info "Installing Docker and dependencies..."
  remote "
    apt-get install -y -qq curl git ufw
    if ! command -v docker &>/dev/null; then
      curl -fsSL https://get.docker.com | sh
    fi
    if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
      apt-get install -y -qq docker-compose-plugin
    fi
    systemctl enable docker
    systemctl start docker
  "
  ok "Docker installed"

  info "Configuring firewall (UFW)..."
  remote "
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw --force enable
  "
  ok "Firewall: 22, 80, 443 open"

  info "Creating project directory $REMOTE_DIR..."
  remote "mkdir -p $REMOTE_DIR && chown $REMOTE_USER:$REMOTE_USER $REMOTE_DIR 2>/dev/null || true"

  info "Cloning repository..."
  remote "
    if [ ! -d $REMOTE_DIR/.git ]; then
      git clone $GIT_REPO $REMOTE_DIR
    else
      cd $REMOTE_DIR && git fetch origin && git reset --hard origin/$BRANCH
    fi
  "
  ok "Repository ready at $REMOTE_DIR"

  info "Copying .env to server..."
  scp $SSH_OPTS "$ENV_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/.env"
  ok ".env deployed"

  ok "Server setup complete"
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE: SSL certificate (Let's Encrypt via Certbot)
# ─────────────────────────────────────────────────────────────────────────────
setup_ssl() {
  header "Phase 2: SSL Certificate"

  info "Checking DNS — $DOMAIN should resolve to $REMOTE_HOST..."
  RESOLVED=$(dig +short "$DOMAIN" 2>/dev/null || nslookup "$DOMAIN" 2>/dev/null | awk '/Address:/{print $2}' | tail -1 || echo "unknown")
  if [[ "$RESOLVED" == "$REMOTE_HOST" ]]; then
    ok "DNS: $DOMAIN → $REMOTE_HOST"
  else
    warn "DNS resolves to: ${RESOLVED:-unknown} (expected $REMOTE_HOST)"
    warn "Make sure your domain A record points to $REMOTE_HOST before continuing"
    read -rp "Continue anyway? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
  fi

  info "Deploying HTTP-only nginx config for ACME challenge..."
  remote "
    cd $REMOTE_DIR
    # Temporarily use HTTP-only config so certbot can verify
    docker compose -f deploy/docker-compose.prod.yml up -d nginx 2>/dev/null || true
  "

  info "Issuing SSL certificate for $DOMAIN..."
  remote "
    docker compose -f $REMOTE_DIR/deploy/docker-compose.prod.yml run --rm certbot \
      certonly --webroot \
      --webroot-path=/var/www/certbot \
      --email $CERTBOT_EMAIL \
      --agree-tos \
      --no-eff-email \
      -d $DOMAIN
  "
  ok "SSL certificate issued for $DOMAIN"

  info "Setting up auto-renewal cron..."
  remote "
    (crontab -l 2>/dev/null; echo '0 3 * * * cd $REMOTE_DIR && docker compose -f deploy/docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f deploy/docker-compose.prod.yml exec nginx nginx -s reload') | sort -u | crontab -
  "
  ok "Auto-renewal cron set (daily at 3am)"
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE: Deploy / update
# ─────────────────────────────────────────────────────────────────────────────
deploy_code() {
  header "Phase 3: Deploy Code"

  info "Pulling latest code from $BRANCH..."
  remote "
    cd $REMOTE_DIR
    git fetch origin
    git checkout $BRANCH
    git reset --hard origin/$BRANCH
  "
  COMMIT=$(remote "cd $REMOTE_DIR && git rev-parse --short HEAD")
  ok "Code at commit: $COMMIT"

  info "Syncing .env..."
  scp $SSH_OPTS "$ENV_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/.env"

  info "Injecting domain into Nginx config..."
  remote "
    sed -i 's/DOMAIN_PLACEHOLDER/$DOMAIN/g' $REMOTE_DIR/deploy/nginx/conf.d/familyhub.conf
  "

  info "Building and starting all services..."
  remote "
    cd $REMOTE_DIR
    docker compose -f deploy/docker-compose.prod.yml pull --quiet 2>/dev/null || true
    docker compose -f deploy/docker-compose.prod.yml build --no-cache
    docker compose -f deploy/docker-compose.prod.yml up -d --remove-orphans
  "
  ok "All services started"

  info "Waiting for backend health check..."
  for i in {1..12}; do
    STATUS=$(remote "docker inspect --format='{{.State.Health.Status}}' familyhub-backend 2>/dev/null || echo starting")
    if [[ "$STATUS" == "healthy" ]]; then
      ok "Backend is healthy"
      break
    fi
    echo "  Waiting... ($i/12) status: $STATUS"
    sleep 5
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE: Validate
# ─────────────────────────────────────────────────────────────────────────────
validate() {
  header "Phase 4: Validation"

  info "Checking running containers..."
  remote "docker compose -f $REMOTE_DIR/deploy/docker-compose.prod.yml ps"

  info "Checking backend health..."
  HEALTH=$(remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health 2>/dev/null || echo 000")
  [[ "$HEALTH" == "200" ]] && ok "Backend health: HTTP 200" || err "Backend health: HTTP $HEALTH"

  info "Checking HTTPS endpoint..."
  HTTPS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || echo "000")
  [[ "$HTTPS" == "200" ]] && ok "HTTPS health: HTTP 200" || warn "HTTPS health: HTTP $HTTPS"

  info "Checking frontend..."
  FRONT=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
  [[ "$FRONT" == "200" ]] && ok "Frontend: HTTP 200" || warn "Frontend: HTTP $FRONT"

  info "Checking SSL certificate..."
  SSL_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
  ok "SSL expires: $SSL_EXPIRY"

  info "Checking security headers..."
  HEADERS=$(curl -sI "https://$DOMAIN/" 2>/dev/null || echo "")
  echo "$HEADERS" | grep -qi "strict-transport-security" && ok "HSTS header present" || warn "HSTS missing"
  echo "$HEADERS" | grep -qi "x-content-type-options"   && ok "X-Content-Type-Options present" || warn "X-Content-Type-Options missing"

  info "Checking MySQL..."
  MYSQL=$(remote "docker exec familyhub-mysql mysqladmin ping -uroot -p\$MYSQL_ROOT_PASSWORD --silent 2>/dev/null && echo ok || echo fail")
  [[ "$MYSQL" == "ok" ]] && ok "MySQL: healthy" || err "MySQL: $MYSQL"

  info "Checking Redis..."
  REDIS=$(remote "docker exec familyhub-redis redis-cli ping 2>/dev/null || echo FAIL")
  [[ "$REDIS" == "PONG" ]] && ok "Redis: PONG" || err "Redis: $REDIS"

  echo ""
  header "Deployment Summary"
  echo -e "  ${BOLD}App URL${NC}:     https://$DOMAIN"
  echo -e "  ${BOLD}API${NC}:         https://$DOMAIN/api/v1/auth/login"
  echo -e "  ${BOLD}Health${NC}:      https://$DOMAIN/health"
  echo -e "  ${BOLD}SSH${NC}:         ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST"
  echo -e "  ${BOLD}Logs${NC}:        ./deploy/deploy.sh --logs"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# PHASE: Logs
# ─────────────────────────────────────────────────────────────────────────────
show_logs() {
  header "Live Logs"
  remote_tty "cd $REMOTE_DIR && docker compose -f deploy/docker-compose.prod.yml logs -f --tail=50"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
header "FamilyHub — VastSpace Deployment"
echo -e "  ${BOLD}Domain${NC}:  https://$DOMAIN"
echo -e "  ${BOLD}Server${NC}:  $REMOTE_USER@$REMOTE_HOST"
echo -e "  ${BOLD}Branch${NC}:  $BRANCH"
echo -e "  ${BOLD}Mode${NC}:    $MODE"
echo ""

case "$MODE" in
  --setup)
    setup_server
    deploy_code
    setup_ssl
    deploy_code   # restart nginx with SSL certs now available
    validate
    ;;
  --update)
    deploy_code
    validate
    ;;
  --ssl)
    setup_ssl
    ;;
  --validate)
    validate
    ;;
  --logs)
    show_logs
    ;;
  *)
    err "Unknown mode: $MODE"
    echo ""
    echo "Usage: $0 [--setup|--update|--ssl|--validate|--logs]"
    exit 1
    ;;
esac

ok "Done ✓"
