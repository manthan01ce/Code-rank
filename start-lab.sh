#!/usr/bin/env bash
set -e

# ========================================================
#    CodeRank Educational Platform - Linux Lab Server
# ========================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================================"
echo "    CodeRank Educational Platform - Linux Lab Server"
echo "========================================================"
echo ""

# 2. Verify Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js is not installed."
    echo "   Install Node.js (v24+) with:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

# Resolve dotenv settings before shell defaults or startup displays.
# Re-enter once with an inherited allowlist; never source/eval .env as shell code.
if [ "${1:-}" != "--resolved-env" ]; then
    exec node scripts/dev/lab-launcher.mjs
fi

# 1. Detect Host LAN IP
HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$HOST_IP" ]; then
    HOST_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
fi
if [ -z "$HOST_IP" ]; then
    HOST_IP=$(ip -4 addr show scope global 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1 | head -n1)
fi
if [ -z "$HOST_IP" ]; then
    HOST_IP="<LINUX_SERVER_IP>"
fi

# Resolve the effective port once, early. A user-provided PORT always wins;
# the default is 3000. Exported so child processes (npm run web/worker) inherit it.
export PORT="${PORT:-3000}"

echo " 📍 Server Local IP    : $HOST_IP"
echo " 🌐 Student / Lab Portal: http://${HOST_IP}:${PORT}"
echo " 💻 Localhost Access    : http://localhost:${PORT}"
echo ""
echo " 🔒 Firewall Configuration:"
echo "    Ensure port ${PORT} is open in UFW if enabled:"
echo "    $ sudo ufw allow ${PORT}/tcp"
echo ""
echo " 🔌 Network Note:"
echo "    For high reliability during lab sessions/exams, connect"
echo "    both the server and lab PCs to the same switch/router"
echo "    via Ethernet to avoid Wi-Fi Client Isolation."
echo "========================================================"
echo ""

# 3. Verify Docker & Docker Compose
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Error: Docker Compose is not installed."
    echo "   Install Docker & Compose with:"
    echo "   sudo apt update && sudo apt install -y docker.io docker-compose-v2"
    echo "   sudo usermod -aG docker \$USER"
    exit 1
fi

# Check if Docker daemon is accessible
if ! docker info >/dev/null 2>&1; then
    echo "⚠️ Warning: Cannot connect to Docker daemon as user '$(whoami)'."
    echo "   Try starting the service or adding yourself to the docker group:"
    echo "   sudo systemctl start docker"
    echo "   sudo usermod -aG docker \$USER  (requires re-login)"
    echo ""
    read -p "Press Enter to attempt continuing with sudo, or Ctrl+C to abort..."
    COMPOSE_CMD="sudo $COMPOSE_CMD"
fi

# Active workspaces load the root environment through packages/core/config.
if [ ! -f .env ] && [ ! -f .env.local ]; then
    echo "Create .env from .env.example and configure DATABASE_URL and JWT_SECRET first."
    exit 1
fi
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
export HOSTNAME="0.0.0.0"
export ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-http://localhost:$PORT,http://$HOST_IP:$PORT}"
# Derive REALTIME_URL from the effective port when no explicit value exists.
export REALTIME_URL="${REALTIME_URL:-http://127.0.0.1:$PORT}"
echo "Building the sandbox image and starting Redis..."
$COMPOSE_CMD -f infrastructure/docker-compose.yml --profile build-image build runner-image
$COMPOSE_CMD -f infrastructure/docker-compose.yml up -d redis

# 7. Setup Process Cleanup Trap
WORKER_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "🛑 Shutting down CodeRank lab server..."
    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" 2>/dev/null || true
    fi
    if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
        kill "$WORKER_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo "✅ Lab server stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

npm run api &
API_PID=$!

# 8. Start Backend Worker
echo "⚙️  [2/3] Starting BullMQ backend worker..."
npm run worker &
WORKER_PID=$!

# Wait briefly for worker to initialize
sleep 2

# 9. Start Frontend Server on 0.0.0.0:${PORT}
echo "🖥️  [3/3] Starting Frontend web server (0.0.0.0:${PORT})..."

npm run web &
FRONTEND_PID=$!

echo ""
echo "✨ CodeRank is LIVE and accessible to all lab computers at:"
echo "   👉 http://${HOST_IP}:${PORT}"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Keep running and wait for child processes
wait
