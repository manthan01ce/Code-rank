# Python Practice Dashboard 

A secure, isolated coding playground for executing Python code locally inside Docker. This dashboard runs completely independent of the main CodeRank application layout.

## Features
- **Monaco Editor Integration**: Automatic layout, robust syntax highlighting.
- **Docker-Backed Execution**: Executes all user Python code inside a secure `python:3.12-slim` container.
- **Strict Limits**: Implements a 5-second execution timeout, 128MB memory limit, and 0.5 CPU limit. No network access is granted to the execution container.
- **Project-Local Temp Storage**: Temporarily stores user scripts in `.tmp/` before mounting them to Docker.

## Setup Instructions

1. **Install Docker Desktop**: Ensure Docker Desktop is installed and running on your host machine.
2. **Pull the Execution Image**: 
   Open your terminal and run:
   ```bash
   docker pull python:3.12-slim
   ```
3. **Start the CodeRank Server**:
   ```bash
   npm run dev
   ```
4. **Access the Dashboard**:
   Navigate your browser to `http://localhost:3000/practice`

## Architecture & Verification

The execution backend is located at `src/app/api/python-run/route.js` and `src/lib/dockerExecution.js`. 
When code is submitted:
1. A unique UUID is generated.
2. A `.tmp/<uuid>` folder is created containing `main.py` and `input.txt`.
3. Docker is spawned using `child_process.exec` with strict flags: 
   `docker run --rm --memory=128m --cpus=0.5 --network none -v <absolute_path_to_tmp>:/app python:3.12-slim`
4. The output is captured, the container is destroyed, and the `.tmp` directory is wiped.

### Troubleshooting Docker
If the dashboard reports a "Docker Offline" status or fails to execute:
1. Run `docker info` in your terminal to verify the Docker daemon is responding.
2. Run `docker images` to verify `python:3.12-slim` is listed.
3. Ensure your `.tmp` folder has read/write permissions for the Node process.
