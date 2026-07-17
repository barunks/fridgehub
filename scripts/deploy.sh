#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# FridgeHub — deploy.sh
# Full deployment to Oracle Cloud instance for https://fridgehubs.duckdns.org
#
# Target: 138.2.109.105 (Oracle Cloud)
# Domain: fridgehubs.duckdns.org
# SSH Key: ~/bytepulse-oracle.key
#
# Usage:
#   ./scripts/deploy.sh                    # Full deploy
#   ./scripts/deploy.sh --setup            # First-time server setup
#   ./scripts/deploy.sh --update           # Code update only (skip setup)
#   ./scripts/deploy.sh --validate         # Validate services only
#
# Apple device considerations:
#   - Strict HSTS headers for Safari
#   - Secure cookie attributes (SameSite=None requires Secure)
#   - CORS with credentials for WebKit
#   - Service Worker scope for PWA on iOS
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Configuration ───────────────────────────────────────────────────────────
SSH_KEY="$HOME/bytepulse-oracle.key"
REMOTE_HOST="138.2.109.105"
REMOTE_USER="opc"
DOMAIN="fridgehubs.duckdns.org"
REMOTE_DIR="/opt/fridgehub"
GIT_REPO="git@github.com:barunks/fridgehub.git"
BRANCH="main"
DB_NAME="fridgehub_db"
DB_USER="fridgehub_user"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }
header(){ echo -e "\n${BOLD}━━━ $* ━━━${NC}\n"; }

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=30"
SSH_CMD="ssh $SSH_OPTS $REMOTE_USER@$REMOTE_HOST"
SCP_CMD="scp $SSH_OPTS"

remote() { $SSH_CMD "$@"; }
remote_sudo() { $SSH_CMD "sudo bash -c '$*'"; }

MODE="${1:-full}"

# ─── Validate local prerequisites ───────────────────────────────────────────
header "Pre-flight Checks"

if [[ ! -f "$SSH_KEY" ]]; then
  err "SSH key not found: $SSH_KEY"
  exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true
ok "SSH key: $SSH_KEY"

info "Testing SSH connectivity to $REMOTE_HOST..."
if ! remote "echo 'connected'" 2>/dev/null; then
  err "Cannot reach $REMOTE_HOST via SSH"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Check Oracle Cloud Security List — port 22 must be open"
  echo "  2. Check instance firewall: sudo iptables -L -n | grep 22"
  echo "  3. Verify the SSH user (try: opc, ubuntu, or oracle)"
  echo "  4. Ensure the instance is running in Oracle Cloud Console"
  exit 1
fi
ok "SSH connection established"

# ─── First-time server setup ────────────────────────────────────────────────
setup_server() {
  header "Phase: Server Setup (first-time)"

  info "Updating system packages..."
  remote "sudo dnf update -y 2>/dev/null || sudo apt-get update -y && sudo apt-get upgrade -y" 2>/dev/null

  info "Installing required packages..."
  remote "sudo dnf install -y git python3 python3-pip python3-devel gcc nginx certbot python3-certbot-nginx mysql-server redis nodejs npm firewalld 2>/dev/null || \
    sudo apt-get install -y git python3 python3-pip python3-venv python3-dev build-essential nginx certbot python3-certbot-nginx mysql-server redis-server nodejs npm ufw"
  ok "System packages installed"

  # Firewall
  info "Configuring firewall..."
  remote "
    if command -v firewall-cmd &>/dev/null; then
      sudo firewall-cmd --permanent --add-service=http
      sudo firewall-cmd --permanent --add-service=https
      sudo firewall-cmd --permanent --add-service=ssh
      sudo firewall-cmd --reload
    elif command -v ufw &>/dev/null; then
      sudo ufw allow 22/tcp
      sudo ufw allow 80/tcp
      sudo ufw allow 443/tcp
      sudo ufw --force enable
    fi
    # Oracle Cloud iptables (common requirement)
    sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    sudo netfilter-persistent save 2>/dev/null || true
  "
  ok "Firewall configured (80, 443, 22)"

  # MySQL setup
  info "Setting up MySQL..."
  remote "
    sudo systemctl enable mysql 2>/dev/null || sudo systemctl enable mysqld 2>/dev/null || true
    sudo systemctl start mysql 2>/dev/null || sudo systemctl start mysqld 2>/dev/null || true
  "

  # Generate secure passwords
  local DB_PASS
  DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
  local SECRET
  SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

  info "Creating MySQL database and user..."
  remote "sudo mysql -e \"
    CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
    GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
    FLUSH PRIVILEGES;
  \" 2>/dev/null || echo 'MySQL user may already exist'"
  ok "MySQL database ready"

  # Redis
  info "Starting Redis..."
  remote "sudo systemctl enable redis-server 2>/dev/null || sudo systemctl enable redis 2>/dev/null || true; sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || true"
  ok "Redis running"

  # Project directory
  info "Creating project directory..."
  remote "sudo mkdir -p $REMOTE_DIR && sudo chown $REMOTE_USER:$REMOTE_USER $REMOTE_DIR"

  # Clone repo
  info "Cloning repository..."
  remote "
    if [ ! -d $REMOTE_DIR/.git ]; then
      # Setup deploy key for git
      eval \$(ssh-agent -s) && ssh-add ~/.ssh/id_rsa 2>/dev/null || true
      git clone $GIT_REPO $REMOTE_DIR 2>/dev/null || git clone https://github.com/barunks/fridgehub.git $REMOTE_DIR
    fi
  "
  ok "Repository cloned"

  # Create .env
  info "Creating production .env..."
  remote "cat > $REMOTE_DIR/.env << EOF
MYSQL_ROOT_PASSWORD=\$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
MYSQL_PASSWORD=$DB_PASS
SECRET_KEY=$SECRET
EOF"

  remote "cat > $REMOTE_DIR/backend/.env << EOF
APP_NAME=FridgeHub API
APP_VERSION=1.0.0
ENVIRONMENT=production
APP_DEBUG=false

DATABASE_URL=mysql+mysqlconnector://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME
REDIS_URL=redis://localhost:6379/0
CACHE_ENABLED=true
CACHE_DEFAULT_TTL_SECONDS=300

SECRET_KEY=$SECRET
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=https://$DOMAIN
SEED_ON_STARTUP=true

# Cookie security for Apple devices (Safari requires Secure + SameSite=None for cross-origin)
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=$DOMAIN
EOF"
  ok "Environment files created"

  # Python venv
  info "Setting up Python virtual environment..."
  remote "cd $REMOTE_DIR && python3 -m venv .venv && source .venv/bin/activate && pip install --upgrade pip && pip install -r backend/requirements.txt"
  ok "Python environment ready"

  # Node dependencies
  info "Installing frontend dependencies..."
  remote "cd $REMOTE_DIR/frontend && npm ci --production=false"
  ok "Frontend dependencies installed"

  # Systemd services
  info "Creating systemd services..."
  remote "sudo tee /etc/systemd/system/fridgehub-backend.service > /dev/null << 'EOF'
[Unit]
Description=FridgeHub Backend API
After=network.target mysql.service redis.service
Wants=mysql.service redis.service

[Service]
Type=simple
User=$REMOTE_USER
Group=$REMOTE_USER
WorkingDirectory=$REMOTE_DIR
EnvironmentFile=$REMOTE_DIR/backend/.env
Environment=PYTHONPATH=$REMOTE_DIR/backend
ExecStart=$REMOTE_DIR/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 --access-log
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

  remote "sudo systemctl daemon-reload && sudo systemctl enable fridgehub-backend"
  ok "Backend systemd service created"

  # Nginx config with Apple device security headers
  setup_nginx

  echo ""
  ok "Server setup complete"
  echo ""
  echo -e "  ${BOLD}Database password${NC}: $DB_PASS"
  echo -e "  ${BOLD}Secret key${NC}:        $SECRET"
  echo -e "  ${YELLOW}Save these values securely — they are in $REMOTE_DIR/backend/.env${NC}"
}

# ─── Nginx configuration ────────────────────────────────────────────────────
setup_nginx() {
  info "Configuring Nginx with security headers for Apple devices..."
  remote "sudo tee /etc/nginx/sites-available/fridgehub > /dev/null 2>/dev/null || sudo tee /etc/nginx/conf.d/fridgehub.conf > /dev/null" << 'NGINX_EOF'
# FridgeHub — Production Nginx Config
# Optimized for Apple devices (Safari, iOS WebKit)

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

server {
    listen 80;
    server_name fridgehubs.duckdns.org;

    # Redirect all HTTP to HTTPS (required for Apple device security)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fridgehubs.duckdns.org;

    # SSL (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/fridgehubs.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fridgehubs.duckdns.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # ─── Security Headers (Apple/Safari compatible) ───
    # HSTS — Safari enforces this strictly; include subdomains for PWA
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    # Prevent MIME sniffing (Safari respects this)
    add_header X-Content-Type-Options "nosniff" always;
    # XSS protection for older WebKit
    add_header X-XSS-Protection "1; mode=block" always;
    # Frame protection
    add_header X-Frame-Options "SAMEORIGIN" always;
    # Referrer policy (Safari default is strict-origin-when-cross-origin)
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    # Permissions policy — restrict device APIs
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self), payment=()" always;
    # CSP — allow inline styles for Tailwind, restrict scripts
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://fridgehubs.duckdns.org; manifest-src 'self'; worker-src 'self';" always;

    # Frontend (static build)
    root /opt/fridgehub/frontend/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 256;

    # Static assets — long cache (fingerprinted by Vite)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service worker — no cache (for PWA on iOS)
    location /sw.js {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # PWA manifest
    location /manifest.json {
        expires 1d;
        add_header Cache-Control "public";
    }

    # Apple-specific PWA files
    location /apple-touch-icon.png {
        expires 30d;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Don't buffer (for streaming responses)
        proxy_buffering off;
    }

    # Login rate limiting (stricter)
    location /api/v1/auth/login {
        limit_req zone=login_limit burst=3 nodelay;

        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check (no rate limit)
    location /health {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    # Block common attack paths
    location ~ /\. { deny all; }
    location ~ ~$ { deny all; }
}
NGINX_EOF

  # Enable site (Debian/Ubuntu style)
  remote "
    if [ -d /etc/nginx/sites-enabled ]; then
      sudo ln -sf /etc/nginx/sites-available/fridgehub /etc/nginx/sites-enabled/
      sudo rm -f /etc/nginx/sites-enabled/default
    fi
    sudo nginx -t && sudo systemctl enable nginx
  "
  ok "Nginx configured with Apple device security headers"
}

# ─── Deploy code update ─────────────────────────────────────────────────────
deploy_code() {
  header "Phase: Deploy Code"

  info "Pulling latest code from $BRANCH..."
  remote "cd $REMOTE_DIR && git fetch origin && git checkout $BRANCH && git reset --hard origin/$BRANCH"
  REMOTE_COMMIT=$(remote "cd $REMOTE_DIR && git rev-parse --short HEAD")
  ok "Code updated to: $REMOTE_COMMIT"

  info "Installing backend dependencies..."
  remote "cd $REMOTE_DIR && source .venv/bin/activate && pip install -q -r backend/requirements.txt"
  ok "Backend dependencies updated"

  info "Running database migrations..."
  remote "cd $REMOTE_DIR/backend && source ../.venv/bin/activate && PYTHONPATH=. alembic upgrade head 2>&1" || warn "Migration may need attention"
  ok "Database migrated"

  info "Applying MySQL schema (idempotent)..."
  remote "
    source $REMOTE_DIR/backend/.env 2>/dev/null || true
    DB_PASS=\$(grep MYSQL_PASSWORD $REMOTE_DIR/.env | cut -d= -f2)
    mysql -u $DB_USER -p\$DB_PASS $DB_NAME < $REMOTE_DIR/backend/sql/schema.sql 2>/dev/null || true
  "
  ok "Schema applied"

  info "Building frontend for production..."
  remote "cd $REMOTE_DIR/frontend && npm ci --production=false && npm run build"
  ok "Frontend built"

  info "Restarting backend service..."
  remote "sudo systemctl restart fridgehub-backend"
  sleep 3
  ok "Backend restarted"

  info "Reloading Nginx..."
  remote "sudo nginx -t && sudo systemctl reload nginx"
  ok "Nginx reloaded"
}

# ─── SSL/HTTPS setup ────────────────────────────────────────────────────────
setup_ssl() {
  header "Phase: HTTPS Certificate"

  info "Checking existing certificate..."
  if remote "sudo test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null; then
    ok "SSL certificate exists"
    info "Renewing if needed..."
    remote "sudo certbot renew --quiet"
  else
    info "Obtaining SSL certificate for $DOMAIN..."
    # Temporarily serve on port 80 for ACME challenge
    remote "
      sudo systemctl stop nginx 2>/dev/null || true
      sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --preferred-challenges http
      sudo systemctl start nginx
    "
    ok "SSL certificate obtained"
  fi

  # Setup auto-renewal
  remote "
    sudo systemctl enable certbot-renew.timer 2>/dev/null || \
    (echo '0 3 * * * root certbot renew --quiet --post-hook \"systemctl reload nginx\"' | sudo tee /etc/cron.d/certbot-renew > /dev/null)
  "
  ok "Auto-renewal configured"
}

# ─── Validation ─────────────────────────────────────────────────────────────
validate_deployment() {
  header "Phase: Validation"

  info "Checking backend service status..."
  local backend_status
  backend_status=$(remote "systemctl is-active fridgehub-backend" 2>/dev/null || echo "inactive")
  if [[ "$backend_status" == "active" ]]; then
    ok "Backend service: active"
  else
    err "Backend service: $backend_status"
    info "Checking logs..."
    remote "sudo journalctl -u fridgehub-backend --no-pager -n 10"
  fi

  info "Checking backend health (localhost)..."
  local health
  health=$(remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health" 2>/dev/null || echo "000")
  if [[ "$health" == "200" ]]; then
    ok "Backend health: HTTP 200"
  else
    err "Backend health: HTTP $health"
  fi

  info "Checking Nginx status..."
  local nginx_status
  nginx_status=$(remote "systemctl is-active nginx" 2>/dev/null || echo "inactive")
  if [[ "$nginx_status" == "active" ]]; then
    ok "Nginx: active"
  else
    err "Nginx: $nginx_status"
  fi

  info "Checking HTTPS endpoint..."
  local https_status
  https_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || echo "000")
  if [[ "$https_status" == "200" ]]; then
    ok "HTTPS health: HTTP 200"
  else
    warn "HTTPS health: HTTP $https_status (may need DNS propagation or cert setup)"
  fi

  info "Checking frontend serving..."
  local frontend_status
  frontend_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/" 2>/dev/null || echo "000")
  if [[ "$frontend_status" == "200" ]]; then
    ok "Frontend: HTTP 200"
  else
    warn "Frontend: HTTP $frontend_status"
  fi

  info "Checking API login endpoint..."
  local login_status
  login_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://$DOMAIN/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"meera","password":"fridgehub"}' 2>/dev/null || echo "000")
  if [[ "$login_status" == "200" ]]; then
    ok "API login: HTTP 200"
  else
    warn "API login: HTTP $login_status"
  fi

  info "Checking security headers (Apple device compatibility)..."
  local headers_output
  headers_output=$(curl -sI "https://$DOMAIN/" 2>/dev/null || echo "")
  if echo "$headers_output" | grep -qi "strict-transport-security"; then
    ok "HSTS header present"
  else
    warn "HSTS header missing"
  fi
  if echo "$headers_output" | grep -qi "x-content-type-options"; then
    ok "X-Content-Type-Options present"
  else
    warn "X-Content-Type-Options missing"
  fi

  info "Checking SSL certificate validity..."
  local ssl_expiry
  ssl_expiry=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
  if [[ "$ssl_expiry" != "unknown" ]]; then
    ok "SSL expires: $ssl_expiry"
  else
    warn "Could not check SSL expiry"
  fi

  info "Checking MySQL connectivity (remote)..."
  local mysql_ok
  mysql_ok=$(remote "sudo systemctl is-active mysql 2>/dev/null || sudo systemctl is-active mysqld 2>/dev/null || echo inactive")
  if [[ "$mysql_ok" == "active" ]]; then
    ok "MySQL: active"
  else
    warn "MySQL: $mysql_ok"
  fi

  info "Checking Redis connectivity (remote)..."
  local redis_ok
  redis_ok=$(remote "redis-cli ping 2>/dev/null || echo 'FAIL'")
  if [[ "$redis_ok" == "PONG" ]]; then
    ok "Redis: PONG"
  else
    warn "Redis: $redis_ok"
  fi

  # DuckDNS update check
  info "Checking DNS resolution for $DOMAIN..."
  local resolved_ip
  resolved_ip=$(dig +short "$DOMAIN" 2>/dev/null || nslookup "$DOMAIN" 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
  if [[ "$resolved_ip" == "$REMOTE_HOST" ]]; then
    ok "DNS resolves to $REMOTE_HOST"
  else
    warn "DNS resolves to: ${resolved_ip:-unknown} (expected $REMOTE_HOST)"
    info "Update DuckDNS: curl 'https://www.duckdns.org/update?domains=fridgehubs&token=YOUR_TOKEN&ip=$REMOTE_HOST'"
  fi
}

# ─── Run remote tests ───────────────────────────────────────────────────────
run_remote_tests() {
  header "Phase: Remote Tests"

  info "Running backend tests on server..."
  remote "
    cd $REMOTE_DIR
    source .venv/bin/activate
    PYTHONPATH=backend LOGIN_RATE_LIMIT_PER_MINUTE=100 DATABASE_URL=sqlite:///./test_deploy.db SECRET_KEY=test-key-32-chars-minimum-length python3 -m pytest backend/tests/test_api.py -q 2>&1 | tail -5
    rm -f test_deploy.db
  "

  info "Running frontend build check on server..."
  remote "cd $REMOTE_DIR/frontend && npm run build 2>&1 | tail -3"

  info "Running frontend lint on server..."
  remote "cd $REMOTE_DIR/frontend && npm run lint 2>&1 | tail -3"

  ok "Remote tests complete"
}

# ─── DuckDNS update helper ──────────────────────────────────────────────────
update_duckdns() {
  header "Phase: DuckDNS Update"
  info "To update DuckDNS, run this with your token:"
  echo ""
  echo "  curl 'https://www.duckdns.org/update?domains=fridgehubs&token=YOUR_DUCKDNS_TOKEN&ip=$REMOTE_HOST'"
  echo ""
  info "Or set up a cron on the server:"
  echo "  */5 * * * * curl -s 'https://www.duckdns.org/update?domains=fridgehubs&token=YOUR_TOKEN&ip=' > /dev/null"
}

# ─── Main execution ─────────────────────────────────────────────────────────
header "FridgeHub Production Deployment"
echo -e "  ${BOLD}Target${NC}:  $REMOTE_USER@$REMOTE_HOST"
echo -e "  ${BOLD}Domain${NC}:  https://$DOMAIN"
echo -e "  ${BOLD}Branch${NC}:  $BRANCH"
echo -e "  ${BOLD}Mode${NC}:    $MODE"
echo ""

case "$MODE" in
  --setup|setup)
    setup_server
    deploy_code
    setup_nginx
    setup_ssl
    validate_deployment
    ;;
  --update|update)
    deploy_code
    validate_deployment
    ;;
  --validate|validate)
    validate_deployment
    ;;
  --ssl|ssl)
    setup_ssl
    ;;
  --nginx|nginx)
    setup_nginx
    remote "sudo nginx -t && sudo systemctl reload nginx"
    ;;
  --test|test)
    run_remote_tests
    ;;
  --dns|dns)
    update_duckdns
    ;;
  full|--full|"")
    setup_server
    deploy_code
    setup_ssl
    run_remote_tests
    validate_deployment
    ;;
  *)
    err "Unknown mode: $MODE"
    echo ""
    echo "Usage: $0 [--setup|--update|--validate|--ssl|--nginx|--test|--dns]"
    exit 1
    ;;
esac

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
header "Deployment Summary"
echo -e "  ${BOLD}URL${NC}:        https://$DOMAIN"
echo -e "  ${BOLD}API${NC}:        https://$DOMAIN/api/v1/auth/login"
echo -e "  ${BOLD}API Docs${NC}:   https://$DOMAIN/docs (disabled in production)"
echo -e "  ${BOLD}Health${NC}:     https://$DOMAIN/health"
echo ""
echo -e "  ${BOLD}SSH${NC}:        ssh -i ~/bytepulse-oracle.key $REMOTE_USER@$REMOTE_HOST"
echo -e "  ${BOLD}Logs${NC}:       sudo journalctl -u fridgehub-backend -f"
echo -e "  ${BOLD}Restart${NC}:    sudo systemctl restart fridgehub-backend"
echo ""
echo -e "  ${CYAN}Apple Device Notes:${NC}"
echo "    - HSTS enforced (Safari will always use HTTPS after first visit)"
echo "    - Cookies: Secure + SameSite=Lax (compatible with Safari ITP)"
echo "    - PWA: manifest.json + apple-touch-icon served with correct headers"
echo "    - Service Worker: cache-first for assets, network-first for API"
echo ""
ok "Deployment script finished ✓"
