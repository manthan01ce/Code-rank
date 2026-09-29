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
- **Real-Time Communication**: Socket.io + 15-second auto-polling with Page Visibility awareness
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
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js                     # Homepage
│   │   │   ├── login/page.js               # Login Portal
│   │   │   ├── admin/                      # Admin Module (Faculty, Students, Courses, Logs)
│   │   │   ├── faculty/                    # Faculty Module (Practicals, Submissions, Marks)
│   │   │   ├── student/                    # Student Module (Practicals, Code Editor)
│   │   │   ├── code/                       # Standalone Coding Workspace
│   │   │   ├── practice/                   # Practice Sandbox
│   │   │   └── api/                        # Next.js Serverless API Endpoints
│   │   ├── components/                     # Shared UI Components (Loading, Logout, Modals)
│   │   ├── hooks/                          # Custom Hooks (usePolling, useSocket, useAdminAuth)
│   │   └── lib/                            # Database client, auth utils, execution engines
│   ├── server.js                           # Custom Next.js + Socket.IO Server
│   ├── next.config.mjs                     # Next.js Config
│   └── package.json                        # Frontend Dependencies
├── backend/                                # Standalone Worker & Queue Support
│   └── src/lib/db.js                       # Backend Database Connection
├── vercel.json                             # Vercel Deployment Configuration
├── README.md                               # Project Guide & Documentation
└── ARCHITECTURE.md                         # Architecture Specifications
```
