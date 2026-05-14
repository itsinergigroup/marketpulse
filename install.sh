#!/bin/bash
# =============================================================================
# MarketPulse - Install Script
# Target OS : Ubuntu 22.04 LTS
# VPS User  : sinergi (non-root, sudo access)
# App dir   : /web/marketpulse-[brand]
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
#
# Run once per brand (amura, reglow).
# Prerequisites: PostgreSQL 14, Nginx 1.18 already installed.
#   Upload DB export first: /home/sinergi/marketpulse_export.sql
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
# Interactive prompts
# ---------------------------------------------------------------------------
echo ""
echo -e "${BLUE}=================================================${RESET}"
echo -e "${BLUE}   MarketPulse - Installer Ubuntu 22.04 LTS     ${RESET}"
echo -e "${BLUE}=================================================${RESET}"
echo ""

# Brand
while true; do
    read -rp "Brand name [amura/reglow]: " BRAND
    BRAND="${BRAND,,}"  # lowercase
    if [[ "$BRAND" == "amura" || "$BRAND" == "reglow" ]]; then
        break
    fi
    error "Brand harus 'amura' atau 'reglow'."
done

# Default suggestions based on brand
DEFAULT_DBNAME="marketpulse_${BRAND}"
DEFAULT_DBUSER="mp_${BRAND}"
DEFAULT_DOMAIN="mrfm.${BRAND}.id"
if [[ "$BRAND" == "amura" ]]; then
    DEFAULT_PORT=3000
else
    DEFAULT_PORT=3001
fi

# Database name
read -rp "Database name [${DEFAULT_DBNAME}]: " DB_NAME
DB_NAME="${DB_NAME:-$DEFAULT_DBNAME}"

# Database user
read -rp "Database user [${DEFAULT_DBUSER}]: " DB_USER
DB_USER="${DB_USER:-$DEFAULT_DBUSER}"

# Database password
while true; do
    read -srp "Database password: " DB_PASS
    echo ""
    if [[ -n "$DB_PASS" ]]; then
        break
    fi
    error "Password tidak boleh kosong."
done

# Domain
read -rp "Domain [${DEFAULT_DOMAIN}]: " DOMAIN
DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"

# Port
read -rp "Port [${DEFAULT_PORT}]: " PORT
PORT="${PORT:-$DEFAULT_PORT}"

APP_DIR="/web/marketpulse-${BRAND}"
SQL_FILE="/home/sinergi/marketpulse_export.sql"
REPO_URL="https://github.com/mnfai/marketpulse.git"
PM2_NAME="marketpulse-${BRAND}"
NGINX_CONF="/etc/nginx/sites-available/marketpulse-${BRAND}"

echo ""
echo -e "${BLUE}------------------------------------------------${RESET}"
info "Konfigurasi:"
echo "  Brand    : ${BRAND}"
echo "  DB Name  : ${DB_NAME}"
echo "  DB User  : ${DB_USER}"
echo "  Domain   : ${DOMAIN}"
echo "  Port     : ${PORT}"
echo "  App Dir  : ${APP_DIR}"
echo -e "${BLUE}------------------------------------------------${RESET}"
read -rp "Lanjutkan? [y/N]: " CONFIRM
if [[ "${CONFIRM,,}" != "y" ]]; then
    warn "Instalasi dibatalkan."
    exit 0
fi

# ---------------------------------------------------------------------------
# Step 1: Check SQL export file
# ---------------------------------------------------------------------------
info "Step 1/12: Memeriksa file database export..."
if [[ -f "$SQL_FILE" ]]; then
    success "File database ditemukan, akan diimport otomatis"
else
    error "File database tidak ditemukan di ${SQL_FILE}"
    echo ""
    warn "Upload file terlebih dahulu:"
    echo "  scp marketpulse_export.sql sinergi@<IP_VPS>:/home/sinergi/"
    echo ""
    exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Install Node.js v20 LTS if not installed
# ---------------------------------------------------------------------------
info "Step 2/12: Memeriksa Node.js..."
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    success "Node.js sudah terinstall: ${NODE_VER}"
else
    info "Node.js belum terinstall. Menginstall Node.js v20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    NODE_VER=$(node --version)
    success "Node.js berhasil diinstall: ${NODE_VER}"
fi

# Verify npm
if ! command -v npm &>/dev/null; then
    error "npm tidak ditemukan setelah instalasi Node.js."
    exit 1
fi
success "npm tersedia: $(npm --version)"

# ---------------------------------------------------------------------------
# Step 3: Install PM2 if not installed
# ---------------------------------------------------------------------------
info "Step 3/12: Memeriksa PM2..."
if command -v pm2 &>/dev/null; then
    success "PM2 sudah terinstall: $(pm2 --version)"
else
    info "Menginstall PM2..."
    sudo npm install -g pm2
    success "PM2 berhasil diinstall: $(pm2 --version)"
fi

# ---------------------------------------------------------------------------
# Step 4: Clone repository
# ---------------------------------------------------------------------------
info "Step 4/12: Clone repository ke ${APP_DIR}..."
if [[ -d "$APP_DIR" ]]; then
    warn "Direktori ${APP_DIR} sudah ada."
    read -rp "Hapus dan clone ulang? [y/N]: " OVERWRITE
    if [[ "${OVERWRITE,,}" == "y" ]]; then
        sudo rm -rf "$APP_DIR"
        info "Direktori lama dihapus."
    else
        error "Instalasi dibatalkan. Hapus direktori terlebih dahulu atau pilih 'y' untuk overwrite."
        exit 1
    fi
fi

sudo mkdir -p /web
sudo chown sinergi:sinergi /web
git clone "$REPO_URL" "$APP_DIR"
success "Repository berhasil di-clone ke ${APP_DIR}"

# ---------------------------------------------------------------------------
# Step 5: npm install
# ---------------------------------------------------------------------------
info "Step 5/12: Menjalankan npm install..."
cd "$APP_DIR"
npm install
success "npm install selesai"

# ---------------------------------------------------------------------------
# Step 6: Generate secrets
# ---------------------------------------------------------------------------
info "Step 6/12: Membuat secret keys..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
EMERGENCY_RESET_TOKEN=$(openssl rand -base64 32)
success "Secret keys berhasil digenerate"

# ---------------------------------------------------------------------------
# Step 7: Create .env file
# ---------------------------------------------------------------------------
info "Step 7/12: Membuat file .env..."
cat > "${APP_DIR}/.env" <<EOF
# MarketPulse - ${BRAND} - Generated by install.sh on $(date '+%Y-%m-%d %H:%M:%S')

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
NEXTAUTH_URL="http://${DOMAIN}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
EMERGENCY_RESET_TOKEN="${EMERGENCY_RESET_TOKEN}"
NODE_ENV=production
PORT=${PORT}
EOF
success "File .env berhasil dibuat"

# ---------------------------------------------------------------------------
# Step 8: Create PostgreSQL database and user
# ---------------------------------------------------------------------------
info "Step 8/12: Membuat database PostgreSQL..."

# Drop existing user/db if needed (idempotent)
sudo -u postgres psql <<PSQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE USER "${DB_USER}" WITH PASSWORD '${DB_PASS}';
    ELSE
        ALTER USER "${DB_USER}" WITH PASSWORD '${DB_PASS}';
        RAISE NOTICE 'User sudah ada, password diupdate.';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE "${DB_NAME}" OWNER "${DB_USER}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
\gexec

GRANT ALL PRIVILEGES ON DATABASE "${DB_NAME}" TO "${DB_USER}";
PSQL

# Grant schema public access (must connect to target db)
sudo -u postgres psql -d "${DB_NAME}" <<PSQL
GRANT ALL ON SCHEMA public TO "${DB_USER}";
PSQL

success "Database '${DB_NAME}' dan user '${DB_USER}' siap"

# ---------------------------------------------------------------------------
# Step 9: Import SQL file
# ---------------------------------------------------------------------------
info "Step 9/12: Import database dari ${SQL_FILE}..."
sudo -u postgres psql -d "${DB_NAME}" < "$SQL_FILE"
success "Import SQL selesai"

# Verify user count
USER_COUNT=$(sudo -u postgres psql -d "${DB_NAME}" -t -c 'SELECT COUNT(*) FROM "User";' | tr -d '[:space:]')
success "Users berhasil diimport: ${USER_COUNT} user ditemukan"

# ---------------------------------------------------------------------------
# Step 10: Prisma migrate deploy + build
# ---------------------------------------------------------------------------
info "Step 10/12: Menjalankan Prisma migrate deploy..."
cd "$APP_DIR"
npx prisma migrate deploy
success "Prisma migrate selesai"

info "Menjalankan npm run build..."
npm run build
success "Build selesai"

# ---------------------------------------------------------------------------
# Step 11: Start with PM2
# ---------------------------------------------------------------------------
info "Step 11/12: Menjalankan app dengan PM2..."

if pm2 describe "$PM2_NAME" &>/dev/null; then
    warn "Proses PM2 '${PM2_NAME}' sudah ada — melakukan restart..."
    pm2 restart "$PM2_NAME"
else
    PORT="${PORT}" pm2 start npm --name "${PM2_NAME}" -- start
fi

pm2 save

info "Mengkonfigurasi PM2 startup systemd..."
sudo pm2 startup systemd -u sinergi --hp /home/sinergi
pm2 save

success "PM2 process '${PM2_NAME}' berjalan"

# ---------------------------------------------------------------------------
# Step 12: Nginx configuration
# ---------------------------------------------------------------------------
info "Step 12/12: Konfigurasi Nginx..."

sudo tee "$NGINX_CONF" > /dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
NGINX

sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/marketpulse-${BRAND}"

info "Testing konfigurasi Nginx..."
sudo nginx -t
success "Nginx config valid"

info "Reload Nginx..."
sudo systemctl reload nginx
success "Nginx berhasil direload"

# ---------------------------------------------------------------------------
# Final summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}================================${RESET}"
echo -e "${GREEN}✅ INSTALASI SELESAI!${RESET}"
echo -e "${GREEN}================================${RESET}"
echo -e "Brand          : ${BRAND}"
echo -e "App URL        : http://${DOMAIN}"
echo -e "PM2 Process    : ${PM2_NAME}"
echo -e "Database       : ${DB_NAME}"
echo -e "Port           : ${PORT}"
echo -e "Users imported : ${USER_COUNT}"
echo ""
echo -e "${YELLOW}Emergency Reset URL:${RESET}"
echo -e "http://${DOMAIN}/emergency-reset?token=${EMERGENCY_RESET_TOKEN}"
echo -e "${YELLOW}⚠️  Simpan URL ini di tempat aman!${RESET}"
echo ""
echo -e "${BLUE}LANGKAH SELANJUTNYA:${RESET}"
echo -e "1. Arahkan DNS ${DOMAIN} ke IP VPS ini"
echo -e "2. Pasang SSL: sudo certbot --nginx -d ${DOMAIN}"
echo -e "3. Test login di: http://${DOMAIN}"
echo -e "${GREEN}================================${RESET}"
