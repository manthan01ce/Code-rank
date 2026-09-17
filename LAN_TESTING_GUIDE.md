# CodeRank - Local Linux Server LAN Testing & Deployment Guide

This guide explains how to host **CodeRank** on a single Linux server (e.g., Ubuntu/Debian lab server, workstation, or teacher PC) so that student and faculty workstations across your local computer lab network (LAN) can access the platform simultaneously.

---

## 🏛️ Architecture Overview

```
                      [ Lab Local Network (LAN) ]
              (Switch / Router / Wired Ethernet Subnet)
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
   [ Student PC #1 ]     [ Student PC #2 ]     [ Faculty PC ]
   http://192.168.1.50:3000                 http://192.168.1.50:3000
                                 │
                                 ▼ Port 3000 (0.0.0.0)
     ┌─────────────────────────────────────────────────────────────┐
     │                     Linux Server Host                       │
     │                                                             │
     │  ┌────────────────────────┐       ┌──────────────────────┐  │
     │  │ Frontend & API Gateway │       │    Backend Worker    │  │
     │  │   Next.js + Socket.IO  │ <───> │  (BullMQ Processor)  │  │
     │  │   Port 3000 (0.0.0.0)  │       └──────────┬───────────┘  │
     │  └───────────┬────────────┘                  │              │
     │              │                               │              │
     │              │ (Localhost 127.0.0.1 only)    │              │
     │              ▼                               ▼              │
     │  ┌────────────────────────┐       ┌──────────────────────┐  │
     │  │   Redis Task Queue     │       │  Isolated Execution  │  │
     │  │   (Port 6379 - Local)  │       │  Daemons (No Network)│  │
     │  └────────────────────────┘       │  • Python, C, C++    │  │
     │                                   │  • Java, JavaScript  │  │
     │                                   └──────────────────────┘  │
     └─────────────────────────────────────────────────────────────┘
```

### Key Security & Network Features
1. **Single Entry Point (`0.0.0.0:3000`)**: Student and faculty PCs only connect to port `3000`.
2. **Zero Client IP Hardcoding**: All frontend API calls and Socket.IO connections adapt dynamically to `window.location.origin`. If DHCP changes the Linux server's IP, no files need editing.
3. **Execution Sandbox Isolation**: Compiler daemons operate with `network_mode: none`. Student code cannot access the internet, local server filesystem, or other computers on the LAN.
4. **Localhost-Only Redis**: Redis (`port 6379`) is bound strictly to `127.0.0.1`, preventing direct tampering from student machines.

---

## 📋 Server Prerequisites

On your Linux server (Ubuntu 20.04, 22.04, or 24.04 recommended):

### 1. Install Node.js (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v # Should be v18 or v20+
```

### 2. Install Docker & Docker Compose
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
```

### 3. Grant Docker Permissions (No Sudo Needed)
```bash
sudo usermod -aG docker $USER
```
*(Log out and log back in, or run `newgrp docker` to apply permissions).*

---

## 🌐 Network Setup & Firewall

### 1. Identify Your Server's LAN IP
Run:
```bash
hostname -I | awk '{print $1}'
```
*(Example output: `192.168.1.50`)*

### 2. Configure Firewall (`ufw`)
Allow incoming traffic only on the frontend port:
```bash
sudo ufw allow 3000/tcp
sudo ufw reload
sudo ufw status
```

### 3. ⚠️ Critical Note on University/College Wi-Fi
> [!WARNING]
> Most institutional Wi-Fi networks enable **Client Isolation (AP Isolation)**, which blocks Wi-Fi devices from connecting to each other.
> 
> **Recommendation for Labs & Exams:**
> Connect both the Linux host and student workstations using **wired Ethernet cables** plugged into the lab's network switch or router.

---

## 🚀 Starting the Server

In the root directory of the project, run:

```bash
chmod +x start-lab.sh
./start-lab.sh
```

### What `start-lab.sh` does automatically:
1. Detects your server's primary LAN IPv4 address.
2. Verifies Docker, Node.js, and dependencies.
3. Copies `.env.local` to `frontend/` and `backend/` if needed.
4. Builds the multi-compiler Docker image and starts Redis + 5 isolated language daemons (`coderank-python-daemon`, `coderank-cpp-daemon`, etc.).
5. Starts the BullMQ background worker.
6. Starts the Next.js frontend & Socket.IO server on `0.0.0.0:3000`.
7. Displays the student access link on your screen.

---

## 🧪 Connecting & Testing from Student PCs

1. On any student/lab computer on the same local network, open a web browser (Chrome, Edge, Firefox).
2. Enter the URL displayed by `start-lab.sh`:
   ```
   http://<LINUX_SERVER_IP>:3000
   ```
   *(e.g., `http://192.168.1.50:3000`)*
3. **Log in as Student**:
   - Access practical coding assignments.
   - Open the Monaco code editor.
   - Click **Run** or **Submit**.
   - Verify that test cases run inside the server's isolated containers and output streams back in real time via Socket.IO.
4. **Log in as Admin / Faculty**:
   - Faculty can create new problems, view submissions, and check student progress live.

---

## 🩺 Verifying Health & Docker Daemons

From the Linux server or any browser on the LAN, verify daemon status:
```
http://<LINUX_SERVER_IP>:3000/api/execute
```
This returns a JSON health report:
```json
{
  "status": "healthy",
  "images": [
    { "language": "python", "image": "coderank-python-daemon", "available": true },
    { "language": "cpp", "image": "coderank-cpp-daemon", "available": true },
    { "language": "c", "image": "coderank-c-daemon", "available": true },
    { "language": "java", "image": "coderank-java-daemon", "available": true },
    { "language": "javascript", "image": "coderank-javascript-daemon", "available": true }
  ],
  "message": "All Docker daemons are running."
}
```

---

## 🛠️ Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Student PC says **"Connection timed out"** | Firewall is blocking port 3000, or AP isolation is active. | Run `sudo ufw allow 3000/tcp` on the Linux server. If on Wi-Fi, switch to wired Ethernet. |
| **"Cannot connect to Docker daemon"** | Docker service is stopped or user lacks permissions. | Run `sudo systemctl start docker` and `sudo usermod -aG docker $USER`. |
| Port 3000 already in use | Another process is using port 3000. | Run `lsof -i :3000` and kill the old process (`kill -9 <PID>`). |
| Code submissions say **"Compiler error"** | Base image has not finished building. | Run `docker compose -f runner/docker-compose.yml up -d --build` to inspect build logs. |
