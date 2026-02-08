#!/bin/bash
# ============================================================================
# DATABASE RESTORE SCRIPT - Finance Hub
# Restore from backup file
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_DIR/docker"

# Default values
COMPOSE_FILE="docker-compose.prod.yml"
DB_SERVICE="postgres"
DB_USER="${DB_USER:-hubcompta}"
DB_NAME="${DB_NAME:-hubcompta}"

# ----------------------------------------------------------------------------
# Functions
# ----------------------------------------------------------------------------

print_header() {
    echo -e "${BLUE}"
    echo "=============================================="
    echo "  Finance Hub - Database Restore"
    echo "=============================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    echo "Usage: $0 <backup_file> [options]"
    echo ""
    echo "Arguments:"
    echo "  backup_file    Path to the backup file (.sql.gz or .sql)"
    echo ""
    echo "Options:"
    echo "  -c, --compose  Docker compose file (default: docker-compose.prod.yml)"
    echo "  -u, --user     Database user (default: hubcompta)"
    echo "  -d, --database Database name (default: hubcompta)"
    echo "  -f, --force    Skip confirmation prompt"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backups/hubcompta_2024-01-15.sql.gz"
    echo "  $0 backup.sql -f"
    echo "  $0 backup.sql.gz -c docker-compose.yml -u postgres -d mydb"
    exit 1
}

check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
}

get_compose_command() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

# ----------------------------------------------------------------------------
# Parse Arguments
# ----------------------------------------------------------------------------

BACKUP_FILE=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--compose)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        -*)
            print_error "Unknown option: $1"
            usage
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# ----------------------------------------------------------------------------
# Validation
# ----------------------------------------------------------------------------

print_header

if [ -z "$BACKUP_FILE" ]; then
    print_error "Backup file is required"
    usage
fi

if [ ! -f "$BACKUP_FILE" ]; then
    print_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

check_dependencies

COMPOSE_CMD=$(get_compose_command)

# Check if compose file exists
if [ ! -f "$DOCKER_DIR/$COMPOSE_FILE" ]; then
    # Try current directory
    if [ -f "$COMPOSE_FILE" ]; then
        COMPOSE_PATH="$COMPOSE_FILE"
    else
        print_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
else
    COMPOSE_PATH="$DOCKER_DIR/$COMPOSE_FILE"
fi

# ----------------------------------------------------------------------------
# Confirmation
# ----------------------------------------------------------------------------

echo "Restore Configuration:"
echo "  Backup file:   $BACKUP_FILE"
echo "  Compose file:  $COMPOSE_PATH"
echo "  Database:      $DB_NAME"
echo "  User:          $DB_USER"
echo ""

if [ "$FORCE" = false ]; then
    print_warning "This will OVERWRITE all data in the database!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

# ----------------------------------------------------------------------------
# Pre-restore Checks
# ----------------------------------------------------------------------------

echo ""
echo "Step 1: Checking database connection..."

cd "$(dirname "$COMPOSE_PATH")"
COMPOSE_PATH="$(basename "$COMPOSE_PATH")"

if ! $COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
    print_error "Database is not running or not ready"
    echo "Start the database with: $COMPOSE_CMD -f $COMPOSE_PATH up -d $DB_SERVICE"
    exit 1
fi

print_success "Database is ready"

# ----------------------------------------------------------------------------
# Stop Application Services
# ----------------------------------------------------------------------------

echo ""
echo "Step 2: Stopping application services..."

$COMPOSE_CMD -f "$COMPOSE_PATH" stop backend worker 2>/dev/null || true
print_success "Application services stopped"

# ----------------------------------------------------------------------------
# Create Pre-restore Backup
# ----------------------------------------------------------------------------

echo ""
echo "Step 3: Creating pre-restore backup..."

PRE_RESTORE_BACKUP="pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
$COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$PRE_RESTORE_BACKUP"

print_success "Pre-restore backup created: $PRE_RESTORE_BACKUP"

# ----------------------------------------------------------------------------
# Restore Database
# ----------------------------------------------------------------------------

echo ""
echo "Step 4: Restoring database..."

# Determine if backup is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "  Decompressing and restoring..."
    gunzip -c "$BACKUP_FILE" | $COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
        psql -U "$DB_USER" -d "$DB_NAME" -q
else
    echo "  Restoring from SQL file..."
    cat "$BACKUP_FILE" | $COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
        psql -U "$DB_USER" -d "$DB_NAME" -q
fi

if [ $? -eq 0 ]; then
    print_success "Database restored successfully"
else
    print_error "Database restore failed"
    echo ""
    print_warning "You can restore from the pre-restore backup:"
    echo "  gunzip -c $PRE_RESTORE_BACKUP | $COMPOSE_CMD -f $COMPOSE_PATH exec -T $DB_SERVICE psql -U $DB_USER -d $DB_NAME"
    exit 1
fi

# ----------------------------------------------------------------------------
# Restart Application Services
# ----------------------------------------------------------------------------

echo ""
echo "Step 5: Restarting application services..."

$COMPOSE_CMD -f "$COMPOSE_PATH" start backend worker 2>/dev/null || true
print_success "Application services restarted"

# ----------------------------------------------------------------------------
# Verification
# ----------------------------------------------------------------------------

echo ""
echo "Step 6: Verifying restore..."

# Check table counts
TABLES=$($COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

USERS=$($COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")

WORKSPACES=$($COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM workspaces;" 2>/dev/null | tr -d ' ' || echo "0")

TRANSACTIONS=$($COMPOSE_CMD -f "$COMPOSE_PATH" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT COUNT(*) FROM transactions;" 2>/dev/null | tr -d ' ' || echo "0")

echo "  Tables:       $TABLES"
echo "  Users:        $USERS"
echo "  Workspaces:   $WORKSPACES"
echo "  Transactions: $TRANSACTIONS"

print_success "Verification complete"

# ----------------------------------------------------------------------------
# Cleanup
# ----------------------------------------------------------------------------

echo ""
print_success "Restore completed successfully!"
echo ""
echo "Pre-restore backup saved as: $PRE_RESTORE_BACKUP"
echo "You can delete it once you've verified the restore:"
echo "  rm $PRE_RESTORE_BACKUP"
echo ""

# Health check
echo "Checking application health..."
sleep 5

if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_success "Application is healthy"
elif curl -s http://localhost:3001/health > /dev/null 2>&1; then
    print_success "Application is healthy"
else
    print_warning "Could not verify application health. Check logs if needed."
fi

exit 0
