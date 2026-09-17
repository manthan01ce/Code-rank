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

echo " 📍 Server Local IP    : $HOST_IP"
echo " 🌐 Student / Lab Portal: http://${HOST_IP}:3000"
echo " 💻 Localhost Access    : http://localhost:3000"
echo ""
echo " 🔒 Firewall Configuration:"
echo "    Ensure port 3000 is open in UFW if enabled:"
echo "    $ sudo ufw allow 3000/tcp"
echo ""
echo " 🔌 Network Note:"
echo "    For high reliability during lab sessions/exams, connect"
echo "    both the server and lab PCs to the same switch/router"
echo "    via Ethernet to avoid Wi-Fi Client Isolation."
echo "========================================================"
echo ""

# 2. Verify Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js is not installed."
    echo "   Install Node.js (v18+) with:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

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

# 4. Ensure environment variables exist
if [ ! -f "frontend/.env.local" ] && [ -f ".env.local" ]; then
    cp .env.local frontend/.env.local
fi
if [ ! -f "frontend/.env" ] && [ -f ".env" ]; then
    cp .env frontend/.env
fi
if [ ! -f "backend/.env.local" ] && [ -f ".env.local" ]; then
    cp .env.local backend/.env.local
fi
if [ ! -f "backend/.env" ] && [ -f ".env" ]; then
    cp .env backend/.env
fi

# 5. Check dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    (cd frontend && npm install)
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    (cd backend && npm install)
fi

# 6. Start Redis & Execution Daemons
echo ""
echo "🚀 [1/3] Starting Redis and isolated compiler daemons in Docker..."
$COMPOSE_CMD -f runner/docker-compose.yml up -d --build

# 7. Setup Process Cleanup Trap
WORKER_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "🛑 Shutting down CodeRank lab server..."
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

# 8. Start Backend Worker
echo "⚙️  [2/3] Starting BullMQ backend worker..."
(cd backend && node src/worker.js) &
WORKER_PID=$!

# Wait briefly for worker to initialize
sleep 2

# 9. Start Frontend Server on 0.0.0.0:3000
echo "🖥️  [3/3] Starting Frontend web server (0.0.0.0:3000)..."
export HOSTNAME="0.0.0.0"
export PORT="3000"

(cd frontend && node server.js) &
FRONTEND_PID=$!

echo ""
echo "✨ CodeRank is LIVE and accessible to all lab computers at:"
echo "   👉 http://${HOST_IP}:3000"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Keep running and wait for child processes
wait
