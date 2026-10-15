#!/usr/bin/env bash
set -e

# =========================================================
# DarkPanel Pay-As-You-Go Telegram Bot Installer & Updater
# =========================================================

INSTALL_DIR="/opt/darkpanel/bot"
BIN_TARGET="/opt/darkpanel/bin/darkpanel-bot"
SERVICE_NAME="darkpanel-bot"
REPO="${REBECCA_REPO:-Amiir-Dark/darkpanel}"
BRANCH="${REBECCA_REF:-main}"

colorized_echo() {
    local color=$1
    local text=$2
    case $color in
        red) echo -e "\033[0;31m$text\033[0m" ;;
        green) echo -e "\033[0;32m$text\033[0m" ;;
        yellow) echo -e "\033[0;33m$text\033[0m" ;;
        blue) echo -e "\033[0;34m$text\033[0m" ;;
        *) echo "$text" ;;
    esac
}

colorized_echo blue "========================================================="
colorized_echo blue "   DarkPanel Pay-As-You-Go Telegram Bot Installer       "
colorized_echo blue "========================================================="

if [ "$(id -u)" -ne 0 ]; then
    colorized_echo red "This script must be run as root."
    exit 1
fi

mkdir -p "$INSTALL_DIR" /opt/darkpanel/bin

# 1. Install / Update Binary
if [ -f "$BIN_TARGET" ]; then
    colorized_echo green "Found existing bot binary at $BIN_TARGET"
    cp -f "$BIN_TARGET" "$INSTALL_DIR/darkpanel-bot"
elif command -v go >/dev/null 2>&1; then
    colorized_echo yellow "Building darkpanel-bot from GitHub source with Go..."
    TMP_DIR=$(mktemp -d)
    git clone --depth 1 -b "$BRANCH" "https://github.com/${REPO}.git" "$TMP_DIR"
    (
        cd "$TMP_DIR/bot"
        CGO_ENABLED=0 go build -trimpath -o "$INSTALL_DIR/darkpanel-bot" .
    )
    cp -f "$INSTALL_DIR/darkpanel-bot" "$BIN_TARGET"
    rm -rf "$TMP_DIR"
    colorized_echo green "Bot binary built and installed successfully."
else
    colorized_echo yellow "Go not found. Downloading prebuilt binary from release..."
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64) ASSET_ARCH="amd64" ;;
        aarch64|arm64) ASSET_ARCH="arm64" ;;
        *) colorized_echo red "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    
    # Try downloading dev/main release artifact or clone
    TMP_DIR=$(mktemp -d)
    git clone --depth 1 -b "$BRANCH" "https://github.com/${REPO}.git" "$TMP_DIR"
    if command -v go >/dev/null 2>&1; then
        (cd "$TMP_DIR/bot" && CGO_ENABLED=0 go build -o "$INSTALL_DIR/darkpanel-bot" .)
    else
        colorized_echo yellow "Installing Go compiler to build binary..."
        apt-get update -qq && apt-get install -y -qq golang-go git
        (cd "$TMP_DIR/bot" && CGO_ENABLED=0 go build -o "$INSTALL_DIR/darkpanel-bot" .)
    fi
    cp -f "$INSTALL_DIR/darkpanel-bot" "$BIN_TARGET"
    rm -rf "$TMP_DIR"
fi

chmod +x "$INSTALL_DIR/darkpanel-bot"

# 2. Configure .env if not exists
ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    colorized_echo yellow "Configuring bot environment (.env)..."
    
    read -rp "Enter Telegram Bot Token (from @BotFather): " BOT_TOKEN
    read -rp "Enter Admin Telegram User IDs (e.g. 12345678, separated by comma): " ADMIN_IDS
    read -rp "Enter DarkPanel URL [default: http://127.0.0.1:8000]: " PANEL_URL
    PANEL_URL="${PANEL_URL:-http://127.0.0.1:8000}"
    read -rp "Enter DarkPanel Admin Username [default: Amir]: " PANEL_USERNAME
    PANEL_USERNAME="${PANEL_USERNAME:-Amir}"
    read -rsp "Enter DarkPanel Admin Password: " PANEL_PASSWORD
    echo ""
    read -rp "Enter Default Price Per GB (Tomans) [default: 5000]: " PRICE_PER_GB
    PRICE_PER_GB="${PRICE_PER_GB:-5000}"
    
    cat > "$ENV_FILE" <<EOF
BOT_TOKEN=${BOT_TOKEN}
PANEL_URL=${PANEL_URL}
PANEL_USERNAME=${PANEL_USERNAME}
PANEL_PASSWORD=${PANEL_PASSWORD}
ADMIN_IDS=${ADMIN_IDS}
PRICE_PER_GB=${PRICE_PER_GB}
MIN_BALANCE_TO_START=5000
SYNC_INTERVAL_SECONDS=120
DATABASE_PATH=${INSTALL_DIR}/bot.db
SUPPORT_USERNAME=@AdminSupport
CHANNEL_USERNAME=
EOF
    colorized_echo green ".env configuration saved."
else
    colorized_echo green "Existing .env found at $ENV_FILE. Preserving configuration."
fi

# 3. Setup Systemd Service
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=DarkPanel Pay-As-You-Go Telegram Bot
After=network.target darkpanel.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/darkpanel-bot
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

colorized_echo green "========================================================="
colorized_echo green "   DarkPanel Telegram Bot has been started successfully! "
colorized_echo green "========================================================="
colorized_echo yellow "Check status with: systemctl status $SERVICE_NAME"
colorized_echo yellow "View logs with:   journalctl -u $SERVICE_NAME -f"
