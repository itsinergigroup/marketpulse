#!/bin/bash
# =============================================================================
# MarketPulse - Update Script
# Target OS : Ubuntu 22.04 LTS
# VPS User  : sinergi (non-root, sudo access)
#
# Usage:
#   chmod +x update.sh
#   ./update.sh
#
# Run on VPS saat ada update dari repo. Pilih brand saat ditanya.
# =============================================================================

set -e

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
GREEN='\e[32m'
RED='\e[31m'
YELLOW='\e[33m'
BLUE='\e[34m'
RESET='\e[0m'

info()    { echo -e "${BLUE}[INFO] $*${RESET}"; }
success() { echo -e "${GREEN}✅ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${RESET}"; }
error()   { echo -e "${RED}❌ $*${RESET}"; }

# ---------------------------------------------------------------------------
# Interactive: Brand selection
# ---------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=================================================${RESET}"
echo -e "${BLUE}   MarketPulse - Update Script                   ${RESET}"
echo -e "${BLUE}=================================================${RESET}"
echo ""

while true; do
    read -rp "Brand yang akan diupdate [amura/reglow]: " BRAND
    BRAND="${BRAND,,}"
    if [[ "$BRAND" == "amura" || "$BRAND" == "reglow" ]]; then
        break
    fi
    error "Brand harus 'amura' atau 'reglow'."
done

APP_DIR="/web/marketpulse-${BRAND}"
PM2_NAME="marketpulse-${BRAND}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ---------------------------------------------------------------------------
# Validate app directory
# ---------------------------------------------------------------------------
if [[ ! -d "$APP_DIR" ]]; then
    error "Direktori ${APP_DIR} tidak ditemukan."
    echo "Jalankan install.sh terlebih dahulu untuk brand ${BRAND}."
    exit 1
fi

info "Update MarketPulse - ${BRAND}"
info "Direktori: ${APP_DIR}"
echo ""

# ---------------------------------------------------------------------------
# Step 1: git pull
# ---------------------------------------------------------------------------
info "Step 1/4: Mengambil update dari repository..."
cd "$APP_DIR"
git pull origin main
success "git pull selesai"

# ---------------------------------------------------------------------------
# Step 2: npm install
# ---------------------------------------------------------------------------
info "Step 2/4: Menginstall dependencies..."
npm install
success "npm install selesai"

# ---------------------------------------------------------------------------
# Step 3: npm run build
# ---------------------------------------------------------------------------
info "Step 3/4: Build aplikasi..."
npm run build
success "Build selesai"

# ---------------------------------------------------------------------------
# Step 4: PM2 restart
# ---------------------------------------------------------------------------
info "Step 4/4: Restart PM2 process '${PM2_NAME}'..."
if pm2 describe "$PM2_NAME" &>/dev/null; then
    pm2 restart "$PM2_NAME"
    success "PM2 process '${PM2_NAME}' berhasil di-restart"
else
    error "PM2 process '${PM2_NAME}' tidak ditemukan."
    warn "Jalankan install.sh untuk setup awal brand ${BRAND}."
    exit 1
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}================================${RESET}"
echo -e "${GREEN}✅ UPDATE SELESAI!${RESET}"
echo -e "${GREEN}================================${RESET}"
echo -e "Brand       : ${BRAND}"
echo -e "PM2 Process : ${PM2_NAME}"
echo -e "Waktu       : ${TIMESTAMP}"
echo -e "${GREEN}================================${RESET}"
