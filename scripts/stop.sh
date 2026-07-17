#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# FridgeHub — stop.sh
# Gracefully stops frontend and/or backend services, frees ports, cleans up.
# Usage: ./scripts/stop.sh [frontend|backend|all]
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

kill_port() {
  local port=$1
  local label=$2
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    info "Port ${BOLD}$port${NC} ($label) is occupied by PID(s): $pids"
    echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    local remaining
    remaining=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$remaining" ]]; then
      warn "Force-killing remaining PID(s): $remaining"
      echo "$remaining" | xargs -r kill -9 2>/dev/null || true
    fi
    ok "Port $port ($label) freed"
  else
    ok "Port $port ($label) already free"
  fi
}

kill_by_pattern() {
  local pattern=$1
  local label=$2
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    info "Found $label process(es): $pids"
    echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
    sleep 1
    local remaining
    remaining=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [[ -n "$remaining" ]]; then
      warn "Force-killing remaining $label PID(s): $remaining"
      echo "$remaining" | xargs -r kill -9 2>/dev/null || true
    fi
    ok "$label stopped"
  else
    ok "No $label processes running"
  fi
}

stop_backend() {
  header "Stopping Backend"

  info "Checking uvicorn / FastAPI processes..."
  kill_by_pattern "uvicorn app.main:app" "uvicorn (backend)"
  kill_by_pattern "uvicorn.*8000" "uvicorn (port 8000)"

  info "Checking port 8000..."
  kill_port 8000 "backend API"

  info "Checking Celery workers..."
  kill_by_pattern "celery.*fridgehub\|celery.*app.tasks" "celery worker"

  # Clean up .pyc and __pycache__ if requested
  if [[ -d "$PROJECT_ROOT/backend/__pycache__" ]]; then
    info "Cleaning __pycache__..."
    find "$PROJECT_ROOT/backend" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    ok "Python cache cleaned"
  fi

  ok "Backend stopped"
}

stop_frontend() {
  header "Stopping Frontend"

  info "Checking Vite dev server processes..."
  kill_by_pattern "vite.*--port\|vite.*dev" "vite dev server"
  kill_by_pattern "node.*vite" "node/vite"

  info "Checking port 5173..."
  kill_port 5173 "frontend dev"

  info "Checking port 4173..."
  kill_port 4173 "frontend preview"

  ok "Frontend stopped"
}

# ─────────────────────────────────────────────────────────────────────────────
header "FridgeHub Stop Script"
info "Target: ${BOLD}$TARGET${NC}"
info "Project: $PROJECT_ROOT"
echo ""

case "$TARGET" in
  frontend|fe|front)
    stop_frontend
    ;;
  backend|be|back)
    stop_backend
    ;;
  all|both|"")
    stop_frontend
    stop_backend
    ;;
  *)
    err "Unknown target: $TARGET"
    echo "Usage: $0 [frontend|backend|all]"
    exit 1
    ;;
esac

echo ""
header "Summary"
info "Port 5173 (frontend): $(lsof -ti :5173 2>/dev/null && echo 'STILL IN USE' || echo 'free')"
info "Port 8000 (backend):  $(lsof -ti :8000 2>/dev/null && echo 'STILL IN USE' || echo 'free')"
ok "Stop complete ✓"
