# CodeRank Local Development - System Verification Report

**Date:** October 11, 2026  
**Status:** ✅ ALL SYSTEMS OPERATIONAL

---

## ✅ System Health Check Summary

### Docker Infrastructure
- ✅ Docker version 29.8.0 installed and running
- ✅ `coderank-redis` - Running (healthy)
- ✅ `coderank-python-daemon` - Running (26+ hours uptime)
- ✅ `coderank-cpp-daemon` - Running (26+ hours uptime)
- ✅ `coderank-c-daemon` - Running (26+ hours uptime)
- ✅ `coderank-java-daemon` - Running (26+ hours uptime)
- ✅ `coderank-javascript-daemon` - Running (26+ hours uptime)

### Redis Connection
- ✅ Redis responding to PING with PONG
- ✅ Port 6379 accessible
- ⚠️ Note: Redis eviction policy is `allkeys-lru` (worker suggests `noeviction` for production)

### Web Server
- ✅ Next.js server running on port 3000
- ✅ HTTP server listening on http://localhost:3000
- ✅ Socket.IO server initialized with CORS enabled

### WebSocket Connections
- ✅ Socket.IO server active on web server
- ✅ Worker connected to Socket.IO (Socket ID: gLDFH72NatLpTuykAAAA)
- ✅ Real-time event system operational

### Worker Process
- ✅ Code execution worker running
- ✅ BullMQ connected to Redis
- ✅ Concurrency: 8 workers
- ✅ WebSocket connection to main server established
- ✅ Listening to `code-execution` queue

### Environment Configuration
- ✅ `.env` file created
- ✅ DATABASE_URL configured (requires your Neon credentials)
- ✅ JWT_SECRET set
- ✅ REDIS_HOST and REDIS_PORT configured
- ✅ MAX_CONCURRENT_JOBS set to 8

### Node.js Environment
- ✅ Node.js v25.2.1 installed
- ✅ Root dependencies installed (542 packages)
- ✅ Web app dependencies ready
- ✅ Worker app dependencies ready

---

## 🔌 WebSocket Events Active

The following real-time events are configured and ready:

### Server Events (apps/web/server.js)
1. **Connection Management**
   - `connection` - New socket connects
   - `disconnect` - Socket disconnects

2. **Room Management**
   - `join_practical_room` - Join a practical's room
   - `leave_practical_room` - Leave a practical's room
   - `join_course_room` - Join a course's room
   - `leave_course_room` - Leave a course's room
   - `watch_job` - Watch a job's execution
   - `unwatch_job` - Stop watching a job

3. **Faculty Events (Broadcast)**
   - `faculty_practical_added` → broadcasts `practical_added`
   - `faculty_practical_updated` → broadcasts `practical_updated`
   - `faculty_practical_deleted` → broadcasts `practical_deleted`

4. **Student Events**
   - `student_new_submission` → broadcasts `new_submission` and `new_submission_marks`

5. **Worker Events**
   - `worker_job_complete` → broadcasts `job_complete` to job watchers

### Client Hooks (apps/web/src/hooks/useSocket.js)
- Connects to `window.location.origin` (same server)
- Auto-reconnection enabled
- Max reconnection delay: 10 seconds

---

## 🧪 Testing WebSocket Connection

### Option 1: Open Test Page
1. With the servers running, open: http://localhost:3000/../test-websocket.html
2. Or open the file directly: `c:\Users\Manthan\Desktop\Code-rank\test-websocket.html`

The test page provides:
- ✅ Connection status indicator
- ✅ Room join/leave testing
- ✅ Event simulation buttons
- ✅ Real-time event log
- ✅ All CodeRank WebSocket events monitored

### Option 2: Browser Console Test
```javascript
// Open http://localhost:3000 and paste in console:
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Join a room
socket.emit('join_practical_room', '123');

// Listen for events
socket.on('practical_added', (data) => {
  console.log('📝 Practical added:', data);
});
```

---

## 🐳 Docker Code Runner Verification

### Architecture
The code execution system uses Docker containers:

1. **Runner Containers** (in `runner/docker-compose.yml`)
   - Long-running daemon containers
   - Pre-loaded with compilers and runtimes
   - Network isolated for security
   - Memory limited to 512MB per container
   - CPU limited to 1.0 per container

2. **Execution Engine** (apps/worker/src/execution/docker.js)
   - Creates temporary session directories
   - Mounts code and input files
   - Executes in isolated containers
   - 10-second timeout per execution
   - Auto-cleanup after execution

### Testing Code Execution

#### Manual Docker Test
```powershell
# Test Python execution
docker exec coderank-python-daemon python3 -c "print('Hello from Python')"

# Test C++ execution  
docker exec coderank-cpp-daemon g++ --version

# Test Java execution
docker exec coderank-java-daemon java -version

# Test JavaScript execution
docker exec coderank-javascript-daemon node --version
```

#### Via API (after servers are running)
The following API endpoints handle code execution:
- `/api/execute` - General code execution
- `/api/python-run` - Python execution
- `/api/cpp-run` - C++ execution
- `/api/c-run` - C execution
- `/api/java-run` - Java execution
- `/api/javascript-run` - JavaScript execution

---

## 🚀 Quick Start Commands

### Start Servers
```powershell
# Terminal 1 - Web Server
npm run web

# Terminal 2 - Worker
npm run worker
```

### Run System Check
```powershell
powershell -ExecutionPolicy Bypass -File check-system.ps1
```

### View Logs
```powershell
# Docker logs
docker logs coderank-redis
docker logs coderank-python-daemon

# Process monitoring
docker ps -a --filter "name=coderank"
```

### Stop Services
```powershell
# Stop Node processes
# Press Ctrl+C in each terminal

# Stop Docker containers (if needed)
cd runner
docker-compose down

cd ..\infrastructure  
docker-compose down
```

---

## ⚠️ Important Notes

### 1. Database Configuration
The `.env` file contains a placeholder DATABASE_URL. You need to:
- Replace with your actual Neon PostgreSQL connection string
- Use the pooler URL for better performance
- Format: `postgresql://user:pass@host/db?sslmode=require&pgbouncer=true&connection_limit=1`

### 2. Redis Eviction Policy
The worker warns about Redis eviction policy. For production:
```bash
docker exec coderank-redis redis-cli CONFIG SET maxmemory-policy noeviction
```

### 3. Security Considerations
- JWT_SECRET should be changed for production
- Admin credentials are fallback only
- Docker containers are network-isolated for code execution
- CORS is set to '*' for development (restrict in production)

### 4. Port Usage
- 3000 - Web server (Next.js + Socket.IO)
- 6379 - Redis
- 5432 - PostgreSQL (if using infrastructure/docker-compose.yml)

---

## 📊 File Structure Overview

```
Code-rank/
├── apps/
│   ├── web/              # Next.js frontend + API routes
│   │   ├── server.js     # Custom server with Socket.IO
│   │   ├── src/
│   │   │   ├── hooks/
│   │   │   │   └── useSocket.js   # Client WebSocket hook
│   │   │   └── app/api/           # API routes
│   │   └── package.json
│   │
│   └── worker/           # Background job worker
│       ├── src/
│       │   ├── index.js
│       │   ├── queue/
│       │   │   └── submission.worker.js  # BullMQ worker + Socket.IO
│       │   └── engine/
│       │       ├── docker.js      # Docker execution engine
│       │       └── runners/       # Language runners
│       └── package.json
│
├── runner/               # Docker containers for code execution
│   ├── Dockerfile        # Multi-language container
│   └── docker-compose.yml
│
├── infrastructure/       # Supporting services
│   └── docker-compose.yml  # Redis, Postgres, Worker
│
├── .env                  # Environment variables
├── check-system.ps1      # Health check script
└── test-websocket.html   # WebSocket test page
```

---

## ✅ Verification Checklist

- [x] Docker installed and running
- [x] All runner containers operational
- [x] Redis connection verified
- [x] .env file configured
- [x] Dependencies installed
- [x] Web server started successfully
- [x] Worker process running
- [x] WebSocket connection established
- [x] Socket.IO events configured
- [x] Code execution engine ready

---

## 🎯 Next Steps

1. **Update Database Connection**
   - Edit `.env` and add your Neon database URL
   - Test database connectivity

2. **Test Code Execution**
   - Open http://localhost:3000
   - Navigate to a code playground or practical
   - Submit test code in different languages

3. **Monitor Real-time Events**
   - Open test-websocket.html
   - Join rooms and watch events
   - Verify live updates work

4. **Review API Health**
   - Check http://localhost:3000/api/health
   - Test authentication endpoints

---

## 📞 Troubleshooting

### WebSocket Not Connecting
- Check if port 3000 is accessible
- Verify CORS settings in server.js
- Check browser console for errors
- Ensure Socket.IO client version matches server

### Worker Not Processing Jobs
- Check Redis connection
- Verify BullMQ queue configuration
- Check worker logs for errors
- Ensure Docker socket is accessible

### Code Execution Failing
- Verify Docker containers are running
- Check container logs: `docker logs coderank-python-daemon`
- Test manual execution in containers
- Check file permissions in .tmp directory

### Port Already in Use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000
# Kill process if needed
Stop-Process -Id <PID> -Force
```

---

**System Status: ✅ READY FOR DEVELOPMENT**

All core systems are operational. The local development environment is ready for use.
