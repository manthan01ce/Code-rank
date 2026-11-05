# Sandbox Image Ownership

**Migration identifier:** CR-ARCH-4I  
**Branch:** `refactor/batch4-sandbox-images`  
**Closes:** #78  
**Prerequisite merged:** #91 (4H — worker/runner orchestration)

---

## Authoritative sandbox image

**One image. One build path. No per-language splits.**

| Property | Value |
|---|---|
| Image tag | `coderank-base:latest` |
| Dockerfile | `infrastructure/docker/runner/Dockerfile` |
| Base | `alpine:3.23` |
| Languages | C (`gcc`), C++ (`g++`), Java (`openjdk17`), Python 3 (`python3`), JavaScript (`nodejs`) |
| Non-root user | `sandbox` (UID/GID 1000) |
| CMD | `sleep <lifetime>` — bounded lifetime even if worker crashes |
| `python` symlink | `/usr/local/bin/python → python3` |

### How to build

**Local lab (via Compose):**
```bash
docker compose -f infrastructure/docker-compose.yml --profile build-image build runner-image
```
Both `start-lab.sh` and `start-lab.bat` invoke this automatically.

**CI:**
```bash
docker build -t coderank-base:latest -f infrastructure/docker/runner/Dockerfile .
```
Used in `.github/workflows/architecture-checks.yml` and `.github/workflows/auth-performance.yml`.

**Override image name:**  
Set `RUNNER_IMAGE=<tag>` in the worker or health-check environment to use a custom tag.  
Respected by `packages/runner/src/sandbox/Sandbox.js` and `packages/runner/src/sandbox/health.js`.

---

## Compose services

### `runner-image` (profile: `build-image`)
Builds and tags `coderank-base:latest`. Run once before starting the worker.

```yaml
# infrastructure/docker-compose.yml
runner-image:
  build:
    context: ..
    dockerfile: infrastructure/docker/runner/Dockerfile
  image: coderank-base:latest
  profiles: [build-image]
```

### Warm-daemon overlay (opt-in)
`infrastructure/compose.warm-daemons.yaml` extends the main Compose file with five
long-running daemon containers — one per language — all using `coderank-base:latest`.

**Usage:**
```bash
docker compose -f infrastructure/docker-compose.yml \
               -f infrastructure/compose.warm-daemons.yaml \
               --profile local-database up -d
```

Enable warm mode in the worker process:
```
USE_WARM_DAEMONS=true
```

> [!WARNING]
> Warm daemons **do not provide per-job filesystem or process isolation**.  
> Multiple jobs share the same container and can observe each other's `/app` state.  
> Use warm mode only in trusted single-tenant lab environments, never for
> untrusted multi-tenant execution.

Warm-mode behaviour in `packages/runner/src/sandbox/Sandbox.js`:
- `USE_WARM_DAEMONS=true` + a language set → `isWarm = true`
- `start()` and `destroy()` are no-ops (the daemon is managed by Compose)
- `script()` sends `docker exec` to `coderank-<lang>-daemon`
- If the daemon is offline (`No such container`): `isWarm` is cleared, a fresh UUID container is started, and the script is retried automatically

---

## Retired images (removed in this PR)

| Dockerfile | Reason retired |
|---|---|
| `runner/Dockerfile` (repo root) | Orphaned Alpine 3.19 image. No Compose service, no CI step, no script reference. Superseded by `infrastructure/docker/runner/Dockerfile` (Alpine 3.23). |
| `infrastructure/docker/cpp/Dockerfile` | Dead single-language `gcc:13` image. Zero consumers in Compose, CI, or source. |
| `infrastructure/docker/java/Dockerfile` | Dead single-language `openjdk:21-slim`. Zero consumers. |
| `infrastructure/docker/python/Dockerfile` | Dead single-language `python:3.11-slim`. Zero consumers. |

The authoritative `infrastructure/docker/runner/Dockerfile` already provides all five
compilers/interpreters in a single image; the per-language splits added no value and
accumulated drift (Alpine vs Debian bases, different user names, stale CMD).

---

## Security properties preserved

The sandbox `docker run` command issued by `Sandbox.js` retains all isolation flags:

| Flag | Value | Purpose |
|---|---|---|
| `--network none` | — | No external network access |
| `--read-only` | — | Image root filesystem is read-only |
| `--cap-drop ALL` | — | No Linux capabilities |
| `--security-opt no-new-privileges:true` | — | Cannot escalate privileges |
| `--pids-limit 64` | — | Bounded process count |
| `--memory 512m --memory-swap 512m` | — | Bounded memory, no swap |
| `--cpus 1` | — | Bounded CPU |
| `--tmpfs /app` | `rw,exec,nosuid,nodev,size=128m,uid=1000,gid=1000,mode=0700` | Per-job writable workspace |
| `--tmpfs /tmp` | `rw,noexec,nosuid,nodev,size=64m,uid=1000,gid=1000,mode=0700` | Per-job temp space |
| `--user 0:0` → exec `--user 1000:1000` | — | Root supervisor, non-root code |
| `sleep <lifetime>` | 1–120 s | Container dies even if worker crashes |

---

## Validation

```bash
npm ci
npm run lint:critical
npm test                    # unit tests including warm-daemon tests
# Full Docker acceptance (requires ci:full-stack label):
docker build -t coderank-base:latest -f infrastructure/docker/runner/Dockerfile .
npm run test:docker         # real sandbox isolation, all 5 languages
docker compose -f infrastructure/docker-compose.yml config --quiet
docker compose -f infrastructure/docker-compose.yml -f infrastructure/compose.warm-daemons.yaml --profile local-database config --quiet
docker compose -f infrastructure/docker-compose.yml -f infrastructure/compose.ci.yaml --profile local-database config --quiet
```
