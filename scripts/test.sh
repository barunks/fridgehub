#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# FamilyHub — test.sh
# Runs frontend and/or backend test suites.
# Usage: ./scripts/test.sh [frontend|backend|all]
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

BACKEND_PASS=0
BACKEND_FAIL=0
FRONTEND_BUILD_PASS=0
FRONTEND_LINT_PASS=0
FRONTEND_E2E_PASS=0

run_backend_tests() {
  header "Backend Tests"

  info "Activating virtual environment..."
  source "$PROJECT_ROOT/.venv/bin/activate"

  info "Running pytest (backend/tests/test_api.py)..."
  echo ""

  export PYTHONPATH="$PROJECT_ROOT/backend"
  export LOGIN_RATE_LIMIT_PER_MINUTE=100
  export DATABASE_URL="sqlite:///./test_familyhub.db"
  export SECRET_KEY="test-secret-key-at-least-32-characters"
  export CACHE_ENABLED=false

  if python3 -m pytest "$PROJECT_ROOT/backend/tests/test_api.py" -v --tb=short 2>&1; then
    BACKEND_PASS=1
    ok "Backend tests PASSED"
  else
    BACKEND_FAIL=1
    err "Backend tests FAILED"
  fi

  # Alembic smoke test
  echo ""
  info "Running Alembic migration smoke test..."
  cd "$PROJECT_ROOT/backend"
  local alembic_db="$PROJECT_ROOT/backend/alembic_smoke_test.db"
  rm -f "$alembic_db"
  export DATABASE_URL="sqlite:///$alembic_db"
  if PYTHONPATH="$PROJECT_ROOT/backend" alembic upgrade head 2>&1; then
    ok "Alembic migrations applied successfully"
  else
    warn "Alembic migration smoke test failed (non-blocking)"
  fi
  rm -f "$alembic_db"
  cd "$PROJECT_ROOT"
}

run_frontend_tests() {
  header "Frontend Tests"

  cd "$PROJECT_ROOT/frontend"

  # Build check
  info "Running TypeScript build check (tsc + vite build)..."
  echo ""
  if npm run build 2>&1; then
    FRONTEND_BUILD_PASS=1
    ok "Frontend build PASSED"
  else
    err "Frontend build FAILED"
    return 1
  fi

  echo ""

  # Lint check
  info "Running linter (oxlint)..."
  echo ""
  if npm run lint 2>&1; then
    FRONTEND_LINT_PASS=1
    ok "Frontend lint PASSED (0 warnings, 0 errors)"
  else
    err "Frontend lint FAILED"
  fi

  echo ""

  # E2E tests
  info "Running Playwright E2E tests..."
  echo ""
  if npx playwright test 2>&1; then
    FRONTEND_E2E_PASS=1
    ok "Frontend E2E tests PASSED"
  else
    err "Frontend E2E tests FAILED"
  fi

  cd "$PROJECT_ROOT"
}

# ─────────────────────────────────────────────────────────────────────────────
header "FamilyHub Test Runner"
info "Target: ${BOLD}$TARGET${NC}"
info "Project: $PROJECT_ROOT"

case "$TARGET" in
  frontend|fe|front)
    run_frontend_tests
    ;;
  backend|be|back)
    run_backend_tests
    ;;
  all|both|"")
    run_backend_tests
    echo ""
    run_frontend_tests
    ;;
  *)
    err "Unknown target: $TARGET"
    echo "Usage: $0 [frontend|backend|all]"
    exit 1
    ;;
esac

# ─────────────────────────────────────────────────────────────────────────────
echo ""
header "Test Summary"

TOTAL_PASS=0
TOTAL_FAIL=0

if [[ "$TARGET" == "backend" || "$TARGET" == "back" || "$TARGET" == "be" || "$TARGET" == "all" || "$TARGET" == "both" ]]; then
  if [[ $BACKEND_PASS -eq 1 ]]; then
    echo -e "  ${GREEN}✓${NC} Backend tests:     PASSED"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Backend tests:     FAILED"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
fi

if [[ "$TARGET" == "frontend" || "$TARGET" == "front" || "$TARGET" == "fe" || "$TARGET" == "all" || "$TARGET" == "both" ]]; then
  if [[ $FRONTEND_BUILD_PASS -eq 1 ]]; then
    echo -e "  ${GREEN}✓${NC} Frontend build:    PASSED"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Frontend build:    FAILED"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
  if [[ $FRONTEND_LINT_PASS -eq 1 ]]; then
    echo -e "  ${GREEN}✓${NC} Frontend lint:     PASSED"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Frontend lint:     FAILED"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
  if [[ $FRONTEND_E2E_PASS -eq 1 ]]; then
    echo -e "  ${GREEN}✓${NC} Frontend E2E:      PASSED"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Frontend E2E:      FAILED"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
fi

echo ""
if [[ $TOTAL_FAIL -eq 0 ]]; then
  ok "All $TOTAL_PASS test suite(s) passed ✓"
  exit 0
else
  err "$TOTAL_FAIL suite(s) failed, $TOTAL_PASS passed"
  exit 1
fi
