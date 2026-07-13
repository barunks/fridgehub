#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# FamilyHub — start.sh
# Stops existing services, ensures dependencies, starts frontend/backend.
# Usage: ./scripts/start.sh [frontend|backend|all]
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
TARGET="${1:-all}"

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

wait_for_port() {
  local port=$1
  local label=$2
  local max_wait=${3:-15}
  local elapsed=0
  info "Waiting for $label on port $port..."
  while ! nc -z localhost "$port" 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [[ $elapsed -ge $max_wait ]]; then
      err "$label did not start within ${max_wait}s"
      return 1
    fi
  done
  ok "$label is up on port $port (${elapsed}s)"
}

# ─────────────────────────────────────────────────────────────────────────────
header "FamilyHub Start Script"
info "Target: ${BOLD}$TARGET${NC}"
info "Project: $PROJECT_ROOT"

# ─────────────────────────────────────────────────────────────────────────────
header "Phase 1: Stop Existing Services"

case "$TARGET" in
  frontend|fe|front)
    bash "$SCRIPTS_DIR/stop.sh" frontend
    ;;
  backend|be|back)
    bash "$SCRIPTS_DIR/stop.sh" backend
    ;;
  all|both|"")
    bash "$SCRIPTS_DIR/stop.sh" all
    ;;
  *)
    err "Unknown target: $TARGET"
    echo "Usage: $0 [frontend|backend|all]"
    exit 1
    ;;
esac

# ─────────────────────────────────────────────────────────────────────────────
header "Phase 2: Check Dependencies"

# Check MySQL (only needed for backend with MySQL config)
if [[ "$TARGET" == "backend" || "$TARGET" == "back" || "$TARGET" == "be" || "$TARGET" == "all" || "$TARGET" == "both" ]]; then
  info "Checking MySQL..."
  if systemctl is-active --quiet mysql 2>/dev/null; then
    ok "MySQL is running"
  elif systemctl is-active --quiet mysqld 2>/dev/null; then
    ok "MySQL (mysqld) is running"
  elif pgrep -x mysqld >/dev/null 2>&1; then
    ok "MySQL process detected"
  else
    warn "MySQL is not running"
    info "Backend will use SQLite fallback (DATABASE_URL=sqlite:///./familyhub.db)"
    info "To use MySQL, start it with: sudo systemctl start mysql"
  fi

  # Check Redis
  info "Checking Redis..."
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Redis is running"
  elif systemctl is-active --quiet redis 2>/dev/null || systemctl is-active --quiet redis-server 2>/dev/null; then
    ok "Redis service is active"
  else
    warn "Redis is not running — cache will use in-memory fallback"
    info "To start Redis: sudo systemctl start redis-server"
  fi

  # Check Python venv
  info "Checking Python virtual environment..."
  if [[ -d "$PROJECT_ROOT/.venv" ]]; then
    ok "Virtual environment found at .venv/"
  else
    warn "No .venv found — creating one..."
    python3 -m venv "$PROJECT_ROOT/.venv"
    ok "Virtual environment created"
  fi

  # Check backend dependencies
  info "Checking backend dependencies..."
  source "$PROJECT_ROOT/.venv/bin/activate"
  if python3 -c "import fastapi, uvicorn, sqlalchemy" 2>/dev/null; then
    ok "Core backend packages installed"
  else
    warn "Installing backend dependencies..."
    pip install -q -r "$PROJECT_ROOT/backend/requirements.txt"
    ok "Backend dependencies installed"
  fi
fi

# Check Node.js (for frontend)
if [[ "$TARGET" == "frontend" || "$TARGET" == "front" || "$TARGET" == "fe" || "$TARGET" == "all" || "$TARGET" == "both" ]]; then
  info "Checking Node.js..."
  if command -v node >/dev/null 2>&1; then
    ok "Node.js $(node --version) found"
  else
    err "Node.js not found. Install it first."
    exit 1
  fi

  info "Checking frontend dependencies..."
  if [[ -d "$PROJECT_ROOT/frontend/node_modules" ]]; then
    ok "node_modules exists"
  else
    warn "Installing frontend dependencies..."
    cd "$PROJECT_ROOT/frontend" && npm install
    ok "Frontend dependencies installed"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
header "Phase 3: Start Services"

start_backend() {
  info "Starting backend (FastAPI + uvicorn) on port 8000..."
  cd "$PROJECT_ROOT"
  source "$PROJECT_ROOT/.venv/bin/activate"

  # Set environment for local dev
  export PYTHONPATH="$PROJECT_ROOT/backend"
  export DATABASE_URL="${DATABASE_URL:-sqlite:///./familyhub.db}"
  export CACHE_ENABLED="${CACHE_ENABLED:-false}"
  export SECRET_KEY="${SECRET_KEY:-local-dev-secret-key-at-least-32-chars}"
  export SEED_ON_STARTUP="${SEED_ON_STARTUP:-true}"
  export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000}"
  export LOGIN_RATE_LIMIT_PER_MINUTE="${LOGIN_RATE_LIMIT_PER_MINUTE:-100}"

  info "  PYTHONPATH=$PYTHONPATH"
  info "  DATABASE_URL=$DATABASE_URL"
  info "  CACHE_ENABLED=$CACHE_ENABLED"
  info "  CORS_ORIGINS=$CORS_ORIGINS"

  nohup uvicorn app.main:app --reload --port 8000 --host 0.0.0.0 \
    > "$PROJECT_ROOT/logs/backend.log" 2>&1 &
  local pid=$!
  info "Backend PID: $pid"
  echo "$pid" > "$PROJECT_ROOT/logs/backend.pid"

  wait_for_port 8000 "Backend API" 20

  # Quick health check
  local health
  health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
  if [[ "$health" == "200" ]]; then
    ok "Backend health check passed (HTTP 200)"
  else
    warn "Backend health returned HTTP $health (may still be initializing)"
  fi
}

start_frontend() {
  info "Starting frontend (Vite dev server) on port 5173..."
  cd "$PROJECT_ROOT/frontend"

  nohup npm run dev -- --host 0.0.0.0 \
    > "$PROJECT_ROOT/logs/frontend.log" 2>&1 &
  local pid=$!
  info "Frontend PID: $pid"
  echo "$pid" > "$PROJECT_ROOT/logs/frontend.pid"

  wait_for_port 5173 "Frontend" 15
  ok "Frontend dev server running at http://localhost:5173"
}

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

case "$TARGET" in
  frontend|fe|front)
    start_frontend
    ;;
  backend|be|back)
    start_backend
    ;;
  all|both|"")
    start_backend
    echo ""
    start_frontend
    ;;
esac

# ─────────────────────────────────────────────────────────────────────────────
echo ""
header "Summary"
echo -e "  ${BOLD}Backend${NC}:  http://localhost:8000  (API docs: http://localhost:8000/docs)"
echo -e "  ${BOLD}Frontend${NC}: http://localhost:5173"
echo -e "  ${BOLD}Logs${NC}:     $PROJECT_ROOT/logs/"
echo ""
info "View logs:"
echo "    tail -f $PROJECT_ROOT/logs/backend.log"
echo "    tail -f $PROJECT_ROOT/logs/frontend.log"
echo ""
ok "FamilyHub started ✓"
