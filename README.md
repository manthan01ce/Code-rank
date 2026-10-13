# CodeRank

CodeRank is a role-based educational platform for managing courses, practicals,
students, faculty, submissions, activity logs, and isolated code execution.

## Architecture

- **Web application:** Next.js 16, React 19, custom Socket.IO server
- **Backend services:** shared Node.js service layer, BullMQ workers, Redis
- **Database:** Neon/PostgreSQL through `@neondatabase/serverless`
- **Execution:** isolated Docker daemons for Python, C, C++, Java, and JavaScript

Execution requests are queued in Redis. The worker uses a CPU-bounded execution
pool (calibrated to `MAX_CONCURRENT_JOBS=8` locally), while Redis buffers client
requests. This is intentionally different from the number of active users: 50
or 100 users may submit concurrently without starting 50 or 100 Docker jobs.

## Active project layout

```text
CodeRank/
├── apps/
│   ├── web/                         # Next.js UI, API routes and Socket.IO server
│   │   ├── src/app/                 # App Router pages and API handlers
│   │   ├── src/components/          # UI and coding-workspace components
│   │   └── src/lib/                 # Web-only helpers (auth, queue, PDF)
│   └── worker/                      # BullMQ background-process application
│       └── src/
│           ├── execution/           # Docker health and language runners
│           │   └── runners/         # Compile/run implementations
│           └── workers/             # BullMQ queue consumers
├── packages/
│   └── core/                        # Shared DB, auth, logging and services
├── infrastructure/                  # Docker Compose and deployment config
├── load-tests/                      # k6 load and runner benchmarks
├── database/                        # Database assets/migrations
├── .env.example                     # Environment-variable template
├── ARCHITECTURE.md                  # Detailed system and capacity design
└── package.json                     # npm workspace scripts
```

`frontend/`, `backend/`, and `runner/` are legacy copies retained for backward
compatibility. They are **not** used by the root workspace scripts or active
deployment configuration. New development belongs only in `apps/` and
`packages/`.

## Prerequisites

- Node.js 18 or later (npm 11 recommended)
- Docker Desktop (for Redis and language runner containers)
- A PostgreSQL/Neon `DATABASE_URL`
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) for load tests
  (optional)

## Setup

```powershell
git clone https://github.com/manthan01ce/Code-rank.git
cd Code-rank
Copy-Item .env.example .env
npm install
docker compose -f infrastructure/docker-compose.yml up -d redis
```

Set `DATABASE_URL`, `JWT_SECRET`, and other required values in `.env`. For
local development, the web app and worker also load app-local `.env` files.

## Run locally

Use separate terminals:

```powershell
npm run web       # http://localhost:3000
npm run worker    # BullMQ execution and system workers
```

Check dependencies and queue status:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

## Environment configuration

Start from `.env.example`. Important execution settings:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
MAX_CONCURRENT_JOBS=8
MAX_QUEUE_SIZE=500
JOB_TIMEOUT_MS=30000
WORKER_VERBOSE_LOGS=false
```

`MAX_CONCURRENT_JOBS` controls CPU-bound execution jobs, not signed-in users.
Increase it only after measuring Docker CPU and latency on the target host. For
more throughput, add worker/runner replicas with additional CPU capacity.

## Load testing

The runner benchmark submits code and waits for the actual BullMQ result. For
local load testing only, temporarily disable the API rate limiter in
`apps/web/.env`, restart the web server, and remove the setting afterward.

```powershell
# 50 simultaneous clients
$env:VUS='50'; $env:DURATION='40s'
k6 run load-tests/runner-concurrency-benchmark.js

# 100 simultaneous clients; permits time for the bounded execution backlog
$env:VUS='100'; $env:DURATION='40s'
$env:MAX_WAIT_SECONDS='30'; $env:POLL_INTERVAL_SECONDS='0.25'
$env:P95_TARGET_MS='15000'
k6 run load-tests/runner-concurrency-benchmark.js
```

Recent local result: 100 concurrent users completed at about 10.7
executions/second. The p95 includes expected queue wait behind eight slots.

## Documentation

- [Architecture and capacity design](ARCHITECTURE.md)
- [Load test notes](load-tests/README.md)
- [Testing guide](TEST_GUIDE.md)
- [LAN deployment guide](LAN_TESTING_GUIDE.md)

## Deployment

The root `vercel.json` targets `apps/web`. The BullMQ worker and Docker runners
must run separately on infrastructure that can access Redis and Docker; they
are not suitable for Vercel serverless execution.

## License

Private and proprietary.
