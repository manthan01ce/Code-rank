# CodeRank three-application topology

The architecture separates frontend, HTTP/realtime and background execution. Follow-on ownership PRs #70–#80 are merged, but concrete move-map gaps and runtime acceptance remain unresolved. See the [current matrix](local-lab-matrix.json) and [local lab acceptance runbook](../deployment/LOCAL_LAB_CERTIFICATION.md). Merge status is not lab certification.

| Component | Ownership | Host default | Container address |
| --- | --- | --- | --- |
| Infrastructure gateway | All public routing, HTTP streaming/timeouts, Socket.IO upgrades; no business rules | localhost:3000 | gateway:3000 |
| apps/web | Standard Next.js pages, browser features and HTTP/socket clients | loopback:3020 (PORT+20) | web:3000 |
| apps/api | All 47 baseline HTTP endpoint groups, API feature modules, Socket.IO and authority | loopback:3001 | api:3001 |
| apps/worker | Queue jobs, grading orchestration, sandbox lifecycle | no public listener | outbound API/Redis/database |

Every `/api/*` path is sent unchanged to API, including unknown paths; there is no frontend fallback for backend URLs. `/socket.io/*` upgrades go to API. Pages and Next.js assets go to web. API downtime returns uncached 502/504 at gateway while frontend pages remain available. Public browser realtime uses the same origin; worker REALTIME_URL identifies API directly.

`npm run dev` starts the host services. Root `npm run web` is a lab supervisor around the infrastructure gateway and a standard `next dev` child. Root `npm run web:production` supervises standard `next start` children after a web build, optionally with WEB_CONCURRENCY replicas. The supervisor forwards only public/runtime environment settings to Next.js and replaces crashed children. The frontend workspace also runs independently with its own `next dev` / `next start` commands. The Docker frontend runs Next.js-generated standalone output with public/static assets copied explicitly.

Only API/worker receive database, Redis, JWT or service-token configuration. Web builds/starts without backend packages, secrets or an API process. API builds/starts without Next.js/React/runner. Only worker receives `/var/run/docker.sock`; submitted code still runs in bounded unprivileged sandbox processes. No SQL migration bytes, volume identities, auth schemes, queue admission limits or grading rules change in this separation.

The public practice catalog is used by frontend rendering and API execution validation. `packages/contracts` contains that existing public data once, without Node/backend/environment dependencies. It contains no hidden practical cases, credentials or SQL. Broader backend feature/facade cleanup in core is tracked separately.

## Release and verification

1. Preserve existing CODERANK_POSTGRES_VOLUME / CODERANK_REDIS_VOLUME mappings. Build the runner image and the three application images plus infrastructure gateway.
2. Start PostgreSQL/Redis, back up existing data as required by the operational runbook, and run controlled `npm run db:migrate` against the selected database. Readiness never migrates.
3. Start API, worker, web and gateway with `infrastructure/docker-compose.yml` plus `compose.containers.yaml`. Use container-reachable DATABASE_URL and `http://api:3001` worker transport.
4. Check public `/api/live`, `/api/health` and `npm run deployment:check -- <public-url>`; complete authenticated browser/execution/recovery acceptance before lab rollout.

CI validates standalone frontend without backend services/secrets, API without frontend/runner, and a disposable complete image topology through gateway with real sandbox execution, WebSocket events and guest ownership. Container topology evidence is mandatory for certification alongside the existing unit/integration/Docker/browser, capacity and database/process recovery evidence. The full-container overlay explicitly resets base service profiles; Compose 2.24.4+ is required for the supported overlays. `compose.ci.yaml` is test-only and overrides published ports. It uses random project/volume names and never selects operator volumes.

Vercel Git deployment is enabled for master in the root and web workspace configs. It is frontend-only: a Next.js preview does not deploy or certify the long-running API/realtime, Docker worker, PostgreSQL and Redis. External hosting remains separately gated under #82; no full cloud topology is certified here.

The [requirement matrix](local-lab-matrix.json) distinguishes implemented feature/database/worker/script ownership from remaining shared-client/styles, core-facade, runner-grouping, warm-mode and batch-restoration gaps. Actual lab host/LAN and complete strict runtime verification remain pending.

Current frontend Git policy permits master and disables other branches. This policy takes no API/socket routing ownership and does not certify external hosting. The earlier Git-retirement policy is historical; current root/web configuration and architecture assertions are authoritative.
