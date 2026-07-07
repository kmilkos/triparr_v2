#!/usr/bin/env bash

# Triparr Installer Script
# Works on Debian/Ubuntu and Fedora systems.

set -eo pipefail

# Colorful output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 1. Root Check
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root. Please run: sudo $0"
fi

# 2. OS Detection & Dependency Installation
info "Detecting operating system..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_LIKE=$ID_LIKE
else
    error "Could not detect operating system (/etc/os-release missing)."
fi

info "OS detected: $NAME ($VERSION)"

install_debian_deps() {
    info "Updating package lists..."
    apt-get update -y

    # Check if Node.js is installed and version is 20+
    local install_node=true
    if command -v node >/dev/null 2>&1; then
        local node_ver=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_ver" -ge 20 ]; then
            info "Node.js v$(node -v) is already installed."
            install_node=false
        fi
    fi

    if [ "$install_node" = true ]; then
        info "Installing Node.js 24.x setup repository..."
        apt-get install -y curl ca-certificates gnupg
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        apt-get update -y
    fi

    info "Installing system dependencies..."
    apt-get install -y nodejs git sqlite3 build-essential rsync
}

install_fedora_deps() {
    # Check if Node.js is installed and version is 20+
    local install_node=true
    if command -v node >/dev/null 2>&1; then
        local node_ver=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_ver" -ge 20 ]; then
            info "Node.js v$(node -v) is already installed."
            install_node=false
        fi
    fi

    info "Installing system dependencies..."
    if [ "$install_node" = true ]; then
        dnf install -y nodejs git sqlite3 rsync
    else
        dnf install -y git sqlite3 rsync
    fi
    dnf groupinstall -y "Development Tools"
}

if [[ "$OS" == "debian" || "$OS" == "ubuntu" || "$OS_LIKE" == *"debian"* || "$OS_LIKE" == *"ubuntu"* ]]; then
    install_debian_deps
elif [[ "$OS" == "fedora" || "$OS_LIKE" == *"fedora"* || "$OS" == "rhel" || "$OS" == "centos" ]]; then
    install_fedora_deps
else
    warn "Unsupported OS type. Attempting generic package installation (needs command-line tools manually installed)..."
fi

# 3. Create Dedicated User
if ! id -u triparr >/dev/null 2>&1; then
    info "Creating system user 'triparr'..."
    useradd -r -s /usr/sbin/nologin -m -d /var/lib/triparr triparr
    success "System user 'triparr' created."
else
    info "User 'triparr' already exists."
fi

# 4. Clone / Deploy Repository
INSTALL_DIR="/opt/triparr"
SCRIPT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info "Deploying Triparr application to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

# Copy files from current repo source directory to /opt/triparr
info "Copying files from $SCRIPT_SOURCE_DIR to $INSTALL_DIR..."
rsync -a --exclude='.git' --exclude='.next' --exclude='node_modules' --exclude='data/*.sqlite' --exclude='data/triparr.log' "$SCRIPT_SOURCE_DIR/" "$INSTALL_DIR/"

# 5. Create Data Folders
info "Creating data folders..."
mkdir -p "$INSTALL_DIR/data/Libraries/Movies"
mkdir -p "$INSTALL_DIR/data/Libraries/TVSeries"
mkdir -p "$INSTALL_DIR/data/tmp"

# 6. Generate Environment Configuration
ENV_FILE="$INSTALL_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    info "Generating secure environment file .env..."
    # Generate secure secret
    APP_SECRET=$(openssl rand -base64 48 2>/dev/null || tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
    cat <<EOF > "$ENV_FILE"
APP_SECRET=$APP_SECRET
DATABASE_PATH=$INSTALL_DIR/data/triparr.sqlite
PORT=3000
HOSTNAME=0.0.0.0
TRIPARR_BASE_URL=http://localhost:3000
EOF
    success "Environment file created in $ENV_FILE."
else
    info "Environment file .env already exists. Skipping."
fi

# 7. Run npm installation, db migration and build
info "Running database migrations and building Next.js application..."
cd "$INSTALL_DIR"
npm install --allow-scripts
if command -v npx >/dev/null 2>&1; then
    npx --yes allow-scripts auto >/dev/null 2>&1 || true
fi
export DATABASE_PATH="$INSTALL_DIR/data/triparr.sqlite"
npm run db:migrate
npm run build

# Adjust folder ownership to triparr user
info "Setting directory permissions..."
chown -R triparr:triparr "$INSTALL_DIR"
chmod -R 750 "$INSTALL_DIR"

# 8. Install systemd Units
info "Configuring systemd services..."
if [ -f "$INSTALL_DIR/deploy/systemd/triparr-web.service" ] && [ -f "$INSTALL_DIR/deploy/systemd/triparr-worker.service" ]; then
    cp "$INSTALL_DIR/deploy/systemd/triparr-web.service" /etc/systemd/system/triparr-web.service
    cp "$INSTALL_DIR/deploy/systemd/triparr-worker.service" /etc/systemd/system/triparr-worker.service
    
    # Reload daemon and start
    systemctl daemon-reload
    
    info "Enabling and starting triparr-web.service..."
    systemctl enable --now triparr-web.service
    
    info "Enabling and starting triparr-worker.service..."
    systemctl enable --now triparr-worker.service
    
    success "Systemd services started and enabled."
else
    error "Systemd template units not found in deploy/systemd/."
fi

success "Triparr installation completed successfully!"
echo -e "${GREEN}Web Console available at:${NC} http://localhost:3000"
echo -e "${GREEN}Management logs command:${NC} journalctl -u triparr-web.service -f"
