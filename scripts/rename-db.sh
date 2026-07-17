#!/usr/bin/env bash
# =============================================================================
# scripts/rename-db.sh — Rename FamilyHub → FridgeHub database & user
#
# Usage:
#   Local SQLite:   ./scripts/rename-db.sh --sqlite
#   Local MySQL:    ./scripts/rename-db.sh --mysql
#   Production:     ./scripts/rename-db.sh --production
#   Docker Compose: ./scripts/rename-db.sh --docker
# =============================================================================
set -euo pipefail

OLD_DB="familyhub_db"
NEW_DB="fridgehub_db"
OLD_USER="familyhub_user"
NEW_USER="fridgehub_user"
OLD_SQLITE="familyhub.db"
NEW_SQLITE="fridgehub.db"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

usage() {
  echo "Usage: $0 [--sqlite] [--mysql] [--production] [--docker]"
  echo ""
  echo "  --sqlite      Rename local SQLite .db files"
  echo "  --mysql       Rename local MySQL database and user"
  echo "  --production  Rename MySQL on remote VPS via SSH (reads .env for REMOTE_HOST)"
  echo "  --docker      Rename MySQL inside running Docker Compose mysql container"
  exit 1
}

# ── SQLite ────────────────────────────────────────────────────────────────────
rename_sqlite() {
  info "Renaming SQLite databases..."
  local changed=0

  for dir in "." "backend" "backend/tests"; do
    if [ -f "$dir/$OLD_SQLITE" ]; then
      mv "$dir/$OLD_SQLITE" "$dir/$NEW_SQLITE"
      success "Renamed $dir/$OLD_SQLITE → $dir/$NEW_SQLITE"
      changed=1
    fi
    # Also handle e2e and test variants
    for old in "e2e_familyhub.db" "test_familyhub.db"; do
      new="${old/familyhub/fridgehub}"
      if [ -f "$dir/$old" ]; then
        mv "$dir/$old" "$dir/$new"
        success "Renamed $dir/$old → $dir/$new"
        changed=1
      fi
    done
  done

  if [ $changed -eq 0 ]; then
    info "No old SQLite files found (already renamed or never existed)."
  fi
}

# ── MySQL SQL commands ────────────────────────────────────────────────────────
mysql_rename_sql() {
  cat <<SQL
-- Step 1: Create new database
CREATE DATABASE IF NOT EXISTS \`${NEW_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Copy all tables from old DB to new DB
SET @tables = NULL;
SELECT GROUP_CONCAT('\`${OLD_DB}\`.\`', table_name, '\` TO \`${NEW_DB}\`.\`', table_name, '\`')
  INTO @tables
  FROM information_schema.tables
  WHERE table_schema = '${OLD_DB}';

SET @tables = IFNULL(@tables, 'x');
SET @sql = CONCAT('RENAME TABLE ', @tables);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Drop old database
DROP DATABASE IF EXISTS \`${OLD_DB}\`;

-- Step 4: Rename user (MySQL 5.7+)
RENAME USER '${OLD_USER}'@'%' TO '${NEW_USER}'@'%';
RENAME USER '${OLD_USER}'@'localhost' TO '${NEW_USER}'@'localhost';

-- Step 5: Re-grant privileges
GRANT ALL PRIVILEGES ON \`${NEW_DB}\`.* TO '${NEW_USER}'@'%';
GRANT ALL PRIVILEGES ON \`${NEW_DB}\`.* TO '${NEW_USER}'@'localhost';
FLUSH PRIVILEGES;

SELECT 'Database rename complete.' AS status;
SQL
}

# ── Local MySQL ───────────────────────────────────────────────────────────────
rename_mysql_local() {
  info "Renaming local MySQL: $OLD_DB → $NEW_DB, $OLD_USER → $NEW_USER"

  # Check if old DB exists
  if ! mysql -u root -e "USE \`$OLD_DB\`;" 2>/dev/null; then
    if mysql -u root -e "USE \`$NEW_DB\`;" 2>/dev/null; then
      success "Database already renamed to $NEW_DB — nothing to do."
      return
    fi
    error "Neither $OLD_DB nor $NEW_DB found. Check your MySQL connection."
  fi

  warn "This will rename $OLD_DB → $NEW_DB and $OLD_USER → $NEW_USER."
  read -rp "Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

  mysql_rename_sql | mysql -u root
  success "Local MySQL rename complete."
}

# ── Docker Compose MySQL ──────────────────────────────────────────────────────
rename_mysql_docker() {
  info "Renaming MySQL inside Docker Compose container..."

  local container
  container=$(docker compose ps -q mysql 2>/dev/null || docker-compose ps -q mysql 2>/dev/null || true)
  [ -z "$container" ] && error "MySQL container not running. Start with: docker compose up -d mysql"

  # Check if old DB exists inside container
  local db_exists
  db_exists=$(docker exec "$container" mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" \
    -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$OLD_DB';" \
    --skip-column-names 2>/dev/null || true)

  if [ -z "$db_exists" ]; then
    local new_exists
    new_exists=$(docker exec "$container" mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" \
      -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$NEW_DB';" \
      --skip-column-names 2>/dev/null || true)
    if [ -n "$new_exists" ]; then
      success "Database already renamed to $NEW_DB inside Docker — nothing to do."
      return
    fi
    error "Neither $OLD_DB nor $NEW_DB found inside Docker container."
  fi

  warn "This will rename $OLD_DB → $NEW_DB inside the Docker MySQL container."
  read -rp "Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

  mysql_rename_sql | docker exec -i "$container" \
    mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" 2>/dev/null

  success "Docker MySQL rename complete."
}

# ── Production (SSH) ──────────────────────────────────────────────────────────
rename_mysql_production() {
  info "Renaming MySQL on production VPS..."

  # Load .env for REMOTE_HOST, REMOTE_USER, SSH_KEY, MYSQL_ROOT_PASSWORD
  local env_file=".env"
  [ ! -f "$env_file" ] && env_file="deploy/.env.production"
  [ ! -f "$env_file" ] && error "No .env file found. Copy deploy/.env.production to .env and fill in values."

  set -a; source "$env_file"; set +a

  local host="${REMOTE_HOST:-}"
  local user="${REMOTE_USER:-root}"
  local key="${SSH_KEY:-~/.ssh/id_rsa}"
  local root_pass="${MYSQL_ROOT_PASSWORD:-}"

  [ -z "$host" ] && error "REMOTE_HOST not set in $env_file"
  [ -z "$root_pass" ] && error "MYSQL_ROOT_PASSWORD not set in $env_file"

  warn "This will rename $OLD_DB → $NEW_DB on $host."
  read -rp "Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

  local sql
  sql=$(mysql_rename_sql)

  ssh -i "$key" "$user@$host" "
    # Check if old DB exists
    if mysql -u root -p'$root_pass' -e \"USE \\\`$OLD_DB\\\`;\" 2>/dev/null; then
      echo '$sql' | mysql -u root -p'$root_pass'
      echo 'Production rename complete.'
    elif mysql -u root -p'$root_pass' -e \"USE \\\`$NEW_DB\\\`;\" 2>/dev/null; then
      echo 'Already renamed to $NEW_DB — nothing to do.'
    else
      echo 'ERROR: Neither $OLD_DB nor $NEW_DB found on production.' >&2
      exit 1
    fi
  "

  success "Production MySQL rename complete."
}

# ── Main ──────────────────────────────────────────────────────────────────────
[ $# -eq 0 ] && usage

case "${1:-}" in
  --sqlite)     rename_sqlite ;;
  --mysql)      rename_mysql_local ;;
  --docker)     rename_mysql_docker ;;
  --production) rename_mysql_production ;;
  *) usage ;;
esac
