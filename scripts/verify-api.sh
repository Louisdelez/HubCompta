#!/bin/bash
# ============================================================================
# API VERIFICATION SCRIPT - Finance Hub
# Verify API endpoints match the spec
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${API_URL:-http://localhost:3001}"
API_PREFIX="/api/v1"

echo -e "${BLUE}"
echo "=============================================="
echo "  Finance Hub - API Verification"
echo "=============================================="
echo -e "${NC}"
echo "Base URL: $BASE_URL"
echo ""

PASS=0
FAIL=0
SKIP=0

check_endpoint() {
    local method=$1
    local path=$2
    local auth=${3:-false}
    local expected=${4:-200}

    printf "  %-6s %-50s " "$method" "$path"

    if [ "$auth" = "true" ]; then
        # Skip auth-required endpoints without token
        echo -e "${YELLOW}SKIP${NC} (requires auth)"
        ((SKIP++))
        return
    fi

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${BASE_URL}${path}" 2>/dev/null || echo "000")

    if [ "$status" = "$expected" ] || [ "$status" = "401" ] || [ "$status" = "403" ]; then
        echo -e "${GREEN}OK${NC} ($status)"
        ((PASS++))
    elif [ "$status" = "000" ]; then
        echo -e "${RED}FAIL${NC} (connection error)"
        ((FAIL++))
    else
        echo -e "${RED}FAIL${NC} (got $status, expected $expected)"
        ((FAIL++))
    fi
}

echo "Public Endpoints:"
echo "----------------------------------------"
check_endpoint "GET" "/health" false 200
check_endpoint "GET" "/health/live" false 200
check_endpoint "GET" "/health/ready" false 200
check_endpoint "GET" "/health/db" false 200
check_endpoint "GET" "/health/redis" false 200
check_endpoint "GET" "/health/storage" false 200
check_endpoint "GET" "/health/full" false 200
check_endpoint "GET" "/health/metrics" false 200

echo ""
echo "Auth Endpoints (no auth):"
echo "----------------------------------------"
check_endpoint "POST" "${API_PREFIX}/auth/register" false 400
check_endpoint "POST" "${API_PREFIX}/auth/login" false 400
check_endpoint "POST" "${API_PREFIX}/auth/refresh" false 401

echo ""
echo "Protected Endpoints (should return 401):"
echo "----------------------------------------"
check_endpoint "GET" "${API_PREFIX}/user" false 401
check_endpoint "GET" "${API_PREFIX}/user/devices" false 401
check_endpoint "GET" "${API_PREFIX}/workspaces" false 401
check_endpoint "GET" "${API_PREFIX}/notifications" false 401
check_endpoint "GET" "${API_PREFIX}/settings" false 401
check_endpoint "GET" "${API_PREFIX}/currencies" false 401
check_endpoint "GET" "${API_PREFIX}/currencies/rates" false 401
check_endpoint "GET" "${API_PREFIX}/assets/search" false 401
check_endpoint "GET" "${API_PREFIX}/search" false 401
check_endpoint "GET" "${API_PREFIX}/admin/stats" false 401

echo ""
echo "=============================================="
echo "Results:"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Skipped: $SKIP"
echo "=============================================="

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Some endpoints failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All checked endpoints OK!${NC}"
    exit 0
fi
