# CodeRank Standalone Compiler Service

This is a lightweight Node.js Express service designed to host the Docker-based Python compilation engine. 
Deploy this service to your self-hosted Linux VPS/Server (where Docker is installed) to execute Python student scripts sandboxed, allowing your Vercel Next.js frontend to securely delegate execution requests.

---

## 🛠️ VPS Setup Instructions

1. **Copy this folder** (`compiler-service/`) to your Linux VPS.
2. **Install Node.js & Docker** on your VPS if not already present.
3. Make sure the user running the server has permissions to run Docker:
   ```bash
   sudo usermod -aG docker $USER
   # Restart terminal/session to apply
   ```
4. **Pre-cache the Python image** on the VPS:
   ```bash
   docker pull python:3.12-slim
   ```
5. **Install dependencies**:
   ```bash
   npm install
   ```
6. **Create a `.env` file** in the `compiler-service` folder:
   ```env
   PORT=5001
   COMPILER_SECRET=your-secure-shared-key-here
   ```
7. **Start the server** (using PM2 for production background persistence):
   ```bash
   # Option A: Start directly
   npm start

   # Option B: Run in background with PM2
   npm install -g pm2
   pm2 start server.js --name "coderank-compiler"
   pm2 save
   pm2 startup
   ```

---

## 🌐 Next.js / Vercel Configuration

To route execution traffic to this standalone VPS service, add these environment variables to your **Vercel project settings**:

1. **`COMPILER_SERVICE_URL`**: The public HTTP address of your VPS (e.g. `http://192.168.1.100:5001` or `https://compiler.yourdomain.com`).
2. **`COMPILER_SECRET`**: The exact same shared secret key you configured on your VPS `.env` file (e.g. `your-secure-shared-key-here`).

*If `COMPILER_SERVICE_URL` is omitted, the Next.js API automatically falls back to local Docker execution, allowing developers to test locally with `npm run dev` without needing a remote VPS link.*
