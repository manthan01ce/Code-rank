# CodeRank Local Testing & Development Guide

This guide explains how to properly start and test the CodeRank platform locally. Because CodeRank uses a highly-optimized decoupled architecture, there are three separate components you need to run.

## Prerequisites
1. **Docker Desktop** (Must be running for Redis and compiler daemons)
2. **Node.js** (v18+)
3. **Neon PostgreSQL Database** (Configured in `.env` and `.env.local`)

---

## 🚀 How to Start the Local Environment

### Step 1: Start Redis (The Queue)
The backend uses BullMQ and Redis to manage high-concurrency code executions safely.
1. Open a terminal in the root directory.
2. Navigate to the runner folder:
   ```bash
   cd runner
   ```
3. Start the Redis container:
   ```bash
   docker-compose up -d
   ```
   *(Verify Redis is running on port 6379)*

### Step 2: Start the Backend Worker
The worker is responsible for securely compiling and executing user code outside of the main web server.
1. Open a **new** terminal in the root directory.
2. Navigate to the backend folder:
   ```bash
   cd backend
   ```
3. Install dependencies and start the worker:
   ```bash
   npm install
   npm start
   ```
   *(You should see: `Starting worker... Concurrency: 2`)*

### Step 3: Start the Next.js Frontend
This is the main web application (UI and API endpoints).
1. Open a **third** terminal in the root directory.
2. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
3. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
   *(Wait until it says `Ready on http://localhost:3000`)*

---

## 🧪 How to Test the Execution Pipeline

Once all three services (Redis, Backend Worker, Frontend) are running:

1. **Open the App**: Go to [http://localhost:3000](http://localhost:3000) and login as a student.
2. **Select a Practical**: Navigate to the student dashboard and open a coding practical (e.g., *Reverse an Array*).
3. **Change Settings**: Click the ⚙️ gear icon in the top right to verify that your editor preferences (Theme, Word Wrap, Minimap, Font Size) load and save correctly.
4. **Submit Code**:
   - Write your code in the editor (ensure it handles `stdin`/`stdout` correctly).
   - Click **RUN** or **SUBMIT**.
5. **Verify the Pipeline**:
   - Look at the **Frontend Terminal**: You should see the `/api/submit` route enqueue the job and immediately return a `202 Accepted`.
   - Look at the **Backend Terminal**: You should instantly see `Processing job <id>`, followed by the execution output.
   - Look at the **Browser UI**: Thanks to Socket.io, the output (or test case results) should stream into your browser console exactly when the backend terminal finishes.

---

## ⚠️ Troubleshooting

- **Worker throws `fetch failed` or NeonDB errors**: Ensure your `.env` and `.env.local` files are present in the `backend/` directory and contain a valid Neon connection string.
- **Jobs are "Stuck" in Loading**: Check if your Redis container is actually running (`docker ps`). If Redis is down, the frontend cannot send jobs to the backend.
- **Docker Daemon Error in Worker**: If you see `connect ENOENT //./pipe/docker_engine`, make sure Docker Desktop is open and running in the background before submitting code.
