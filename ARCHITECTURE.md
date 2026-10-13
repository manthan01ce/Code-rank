# 🏛️ CodeRank System Architecture

Comprehensive architecture, data flow, execution engine, real-time polling, and database design for CodeRank.

---

## 📑 Table of Contents
1. [Overview & High-Level Architecture](#-overview--high-level-architecture)
2. [Tech Stack & Infrastructure](#-tech-stack--infrastructure)
3. [Database Design & PgBouncer Connection Pooling](#-database-design--pgbouncer-connection-pooling)
4. [Real-Time Sync & 15-Second Polling Architecture](#-real-time-sync--15-second-polling-architecture)
5. [Code Execution & Sandboxing Pipeline](#-code-execution--sandboxing-pipeline)
6. [Role-Based Access Control (RBAC) & Auth Flow](#-role-based-access-control-rbac--auth-flow)
7. [Directory & Component Layout](#-directory--component-layout)

---

## 🌐 Overview & High-Level Architecture

CodeRank is a secure, high-concurrency educational management and automated code-evaluation platform designed for universities and coding labs.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                                │
│  React 19 / Next.js 16 (App Router) + Monaco Code Editor + Socket.IO   │
│  Dashboards: /admin  |  /faculty  |  /student  |  /practice  |  /code  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS / WSS
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             GATEWAY / API                               │
│  Next.js Serverless Routes (/api/*) + Custom Node.js Server (server.js)│
│  JWT Authentication + RBAC Middleware + Activity Logging                │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│           DATA ACCESS TIER           │ │     EXECUTION ENGINE TIER     │
│  @neondatabase/serverless (HTTP)     │ │  Docker Sandbox Daemons       │
│  Neon Serverless PostgreSQL          │ │  BullMQ Job Queues + Redis    │
│  PgBouncer Connection Pooler         │ │  stdin/stdout Test Runner     │
└──────────────────────────────────────┘ └───────────────────────────────┘
```

---

## 🛠️ Tech Stack & Infrastructure

- **Framework**: Next.js 16.3.6 (Turbopack, App Router)
- **UI & Frontend**: React 19, Monaco Editor, Lucide Icons, Vanilla CSS
- **Database**: Neon Serverless PostgreSQL with PgBouncer Connection Pooling
- **Database Driver**: `@neondatabase/serverless` (Stateless HTTP queries + WebSocket pooler)
- **Real-Time Communication**: Socket.io push with short job-status fallback polling; dashboard polling uses Page Visibility awareness
- **Queueing & Rate Limiting**: Redis + BullMQ
- **Execution Isolation**: Docker runtime daemons (Python, C, C++, Java, Node.js)
- **Security & Auth**: JWT (24h expiry) + bcryptjs password hashing
- **Reporting & Export**: jsPDF + jspdf-autotable, ExcelJS, csv-parse

---

## 🗄️ Database Design & PgBouncer Connection Pooling

### PgBouncer Connection Architecture
Under high concurrent usage in serverless environments (e.g., hundreds of students submitting practicals simultaneously), persistent database connections can exhaust connection limits.

CodeRank implements connection pooling through Neon's native PgBouncer pooler:

```
Serverless Function / API
         │
         │ (Stateless HTTP via @neondatabase/serverless)
         ▼
  PgBouncer Proxy (Transaction Mode Pooling)
  ep-xxxx-pooler.us-east-1.aws.neon.tech:5432
         │
         │ (Active Connection Pool)
         ▼
  PostgreSQL Master DB (neondb)
```

- **Connection URL**:
  ```env
  DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1
  ```
- **`pgbouncer=true`**: Disables prepared statement caching incompatible with transaction-mode pooling.
- **`connection_limit=1`**: Limits connection consumption per serverless invocation.

### Core Database Entities

```
 ┌──────────────┐       1:N       ┌──────────────────┐
 │    users     ├─────────────────►  activity_logs   │
 └──────┬───────┘                 └──────────────────┘
        │
        │ 1:N
        ▼
 ┌──────────────┐       N:M       ┌──────────────────┐
 │course_faculty◄─────────────────►     courses      │
 └──────────────┘ (is_co_coord)   └────────┬─────────┘
                                           │
                                           │ 1:N
                                           ▼
 ┌───────────────────────────┐    1:N     ┌──────────────────┐
 │  practical_test_cases     ◄────────────┤    practicals    │
 └───────────────────────────┘            └────────┬─────────┘
                                                   │
                                                   │ 1:N
                                                   ▼
 ┌───────────────────────────┐    1:N     ┌───────────────────────┐
 │ practical_submission_cases◄────────────┤ practical_submissions │
 └───────────────────────────┘            └───────────────────────┘
```

---

## ⚡ Real-Time Sync & 15-Second Polling Architecture

To ensure 100% data reliability even if WebSocket disconnects or network drops occur in lab environments, CodeRank implements a **hybrid real-time sync model**:

```
           ┌────────────────────────────────────────┐
           │        Dashboard (Client Hook)         │
           └──────┬──────────────────────────┬──────┘
                  │                          │
           Socket.io Event            usePolling Hook (15s)
                  │                          │
                  ▼                          ▼
          Instant Push Update        Periodic Catch-up Poll
                  │                          │
                  └───────────┬──────────────┘
                              ▼
                   Live UI State Updated
```

1. **Immediate Socket Push**:
   - `practical_added` / `practical_updated` / `practical_deleted` broadcast to `course_{courseId}` rooms.
   - `new_submission` / `new_submission_marks` broadcast to `practical_{practicalId}` and `course_{courseId}` rooms.
2. **15-Second Polling (`usePolling`)**:
   - Polling interval set to 15,000ms across Admin, Faculty, and Student modules.
   - Utilizes Page Visibility API (`document.visibilityState`) to pause polling when tabs are backgrounded, eliminating wasted network requests.

### Execution completion delivery

Code runs use a separate low-latency path: the worker emits `worker_job_complete`
over Socket.IO as soon as BullMQ completes a job. If that socket delivery is
unavailable, the coding workspace polls `/api/jobs/:jobId` after 250 ms, then
backs off to 500 ms and a maximum of 1 second until it resolves. This keeps a
socket failure from adding the previous fixed 1.5 second display delay without
turning a large socket outage into permanent high-frequency polling.

---

## 🚀 Execution Capacity and Scaling

The queue accepts requests independently of sandbox capacity. On the calibrated
local host, `MAX_CONCURRENT_JOBS=8` is the execution limit and `MAX_QUEUE_SIZE=500`
is the admission buffer. This supports at least 50 simultaneous users without
starting 50 competing Docker processes.

- **Do not set worker concurrency to active-user count.** Code execution is
  CPU-bound; higher concurrency increased queueing/CPU contention without
  increasing throughput in local tests.
- **Runner isolation:** each invocation uses a unique execution artifact name.
  Source builds may remain content-addressed and cached, but inputs, outputs,
  and errors are never shared between same-source jobs.
- **Interpreted playground fast path:** Python and JavaScript source, input,
  execution, and cleanup happen in one `docker exec` call instead of three.
- **Horizontal scale:** for more sustained throughput, run more worker
  processes/hosts and add matching sandbox-daemon replicas. All workers share
  Redis; capacity then scales with the number of daemon CPU allocations.
- **Observability:** track BullMQ waiting/active counts, completion latency,
  worker failures, Docker CPU/memory, and Redis memory/evictions. Redis uses
  `noeviction` so a full queue fails explicitly instead of silently dropping
  jobs.

### Runner isolation and graceful shutdown

Workers consume the BullMQ queue concurrently up to `MAX_CONCURRENT_JOBS`.
On `SIGTERM` or `SIGINT`, they pause queue intake, wait for active processors to
finish, then close their Redis connections; `SHUTDOWN_GRACE_MS` supplies a
bounded fail-safe deadline. Runner daemons use Docker network isolation,
non-root execution, a read-only root filesystem, dropped capabilities,
`no-new-privileges`, PID limits, CPU/memory limits, and tmpfs workspaces.
The playground executor collects wall time plus `/usr/bin/time` CPU and peak
RSS metrics from the process it started.

---

## 🔒 Role-Based Access Control (RBAC) & Auth Flow

```
┌────────────────────────────────────────────────────────┐
│                   User Login (/login)                  │
│       POST /api/auth/login { email, password }         │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Authentication Flow                   │
│   1. Validate user in PostgreSQL                       │
│   2. Compare bcrypt hash (salt rounds: 10)             │
│   3. Generate signed JWT token (24h validity)          │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      Admin Role                  Faculty / Student
┌─────────────────────────┐ ┌─────────────────────────┐
│ /admin/* routes         │ │ /faculty/* or /student/* │
│ useAdminAuth middleware │ │ Token verification hook │
└─────────────────────────┘ └─────────────────────────┘
```

---

## 📁 Directory & Component Layout

```
CodeRank/
├── apps/
│   ├── web/                                # Next.js + custom Socket.IO server
│   │   └── src/app/api/                    # HTTP API routes
│   └── worker/                             # BullMQ execution and system workers
│       └── src/execution/runners/          # Docker sandbox execution paths
├── packages/core/                          # Shared DB, queue, auth and service code
├── infrastructure/                         # Docker Compose and service configuration
├── load-tests/                             # k6 regression/load benchmarks
├── .env.example                            # Deployment configuration template
├── README.md
└── ARCHITECTURE.md
```
