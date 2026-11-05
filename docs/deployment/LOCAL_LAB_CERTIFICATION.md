# Local lab acceptance — CR-ARCH-26A / #81

**Not certified.** This is the current acceptance runbook and gap record, not a certificate. The [move-map matrix](../architecture/local-lab-matrix.json) records 18 concrete ownership rows and 12 runtime evidence groups. The [predecessor snapshot](../architecture/local-lab-predecessors.json) records exact PR heads, merged trees and actual workflow conclusions observed on 5 November 2026. The [tracked folder tree](../architecture/local-lab-folder-tree.json) records the actual directory set; it excludes generated output/dependencies. All #70–#80 PRs are merged; all final-head fast runs passed; every strict Architecture checks run was skipped. A closed issue does not prove its acceptance ran.

Current structural blockers are shared browser client/shared utility/styles ownership, retained core compatibility/pagination dispositions, flat runner implementations, real retained-warm-mode acceptance, and quarantined batch execution. Keep working consumers intact; complete the owning migrations or record a reviewed concrete retention decision. Do not create empty folders or treat file length as evidence. Home and sign-in feature owners exist. Route groups, browser/e2e naming and the canonical Compose/runner Dockerfile names are optional path choices already justified by their consumers.

PR heads and merged trees differ for #70, #75 and #77 because the merged tree includes other changes; the snapshot lists the exact differing paths. This is not evidence of a regression or permission to discard merged work. It makes a strict run on the complete final tree necessary. Matching trees for the other predecessors still do not establish runtime parity.

## What can be verified here

Run from a clean checkout of the exact review head with Node 24 and npm 11. Fetch full repository history before checking predecessor ancestry; a shallow checkout cannot prove every merge relationship:

```sh
npm ci
npm run lint:critical
npm test
npm run build -- --force
bash -n start-lab.sh
npm run lab:audit
```

`lab:audit` only inspects source, tools and existing evidence. It writes `test-results/local-lab/audit.json`, including commit/tree, hardware fingerprint, actual tracked folder tree, report hashes, merged predecessor evidence and explicit blockers. It exits 1 while blocked. It does not start services, migrate/seed a database, delete volumes or trigger CI. Even when evidence is complete, its best result is **ready-for-human-review**, with `labCertified: false` and `cloudCertified: false`. It cannot independently establish the identity or LAN reachability of an intended host.

Unit, integration, Docker and browser commands keep their existing manifest/TAP/certification gates. The old tracked `test-results/unit.tap` is retired from source; new reports stay ignored and cannot be mistaken for checked-in certification. Preserve actual run logs privately before another run overwrites them. Do not copy a passing status from another commit.

## Disposable runtime verification

Use the actual intended lab host and an independent LAN client. Record operator/host access, OS/kernel, CPU model/logical count, RAM, Node/npm, Docker/Compose and matching PostgreSQL tool versions. The audit emits hardware without dumping environment variables, secrets or host identity. Compose overlays need 2.24.4 or later.

Select fresh synthetic test database/schema and project/volume identities before running service tests. Set `TEST_DATABASE_URL` only to the disposable test target. Do not point these commands at production or a live Neon database. Preserve existing `CODERANK_POSTGRES_VOLUME` and `CODERANK_REDIS_VOLUME` operator mappings; continuity drills use their own disposable resources. Do not invoke `db:seed`, reset an existing database, or run `down --volumes` on an operator project.

The authoritative strict sequence is [.github/workflows/architecture-checks.yml](../../.github/workflows/architecture-checks.yml). Follow its environment/isolation setup and full sequence; the following is a command index, not a replacement harness:

| Evidence | Existing command / owner | Acceptance limit |
| --- | --- | --- |
| PostgreSQL/Redis, transactions, atomic admission, leases, recovery | `npm run test:integration` | Six service files; no optional registration or live Neon substitution |
| Sandbox build | `docker build -t coderank-base:latest -f infrastructure/docker/runner/Dockerfile .` | All five languages and unchanged isolation/capacity limits |
| Batch candidate | `npm run test:batch` | Real Docker pass required before moving its sole manifest membership from quarantine to docker |
| Cold sandbox contracts | `npm run test:docker` | No mocks; compilation/error/timeout/privacy/cleanup/reaping |
| Application/gateway images | Build `apps/worker/Dockerfile`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `infrastructure/gateway/Dockerfile` with the workflow's image tags | Worker alone receives Docker; web/API dependency and secret isolation |
| Full-container topology | `node scripts/ci/container-topology.mjs` | Uses generated test project/volume names; gateway, readiness, guest ownership and WebSocket evidence |
| Host stack | `npm run test:stack` | Real API-to-worker round trip against isolated services |
| Synthetic frontend transitions | `npm run test:faculty-review` | Separate frontend JSON evidence; cannot replace real permissions |
| Authenticated runtime, browser/PDF, capacity and recovery | `npm run test:authenticated` | Configure disposable test DB and matching backup/restore tools exactly as the harness requires |
| Public readiness | `npm run deployment:check -- <lab-public-url>` | HTTP/readiness smoke only; does not certify host/LAN or all workflows |
| Complete CI evidence | `node scripts/ci/write-certification.mjs` | Existing GitHub Actions provenance and all strict gates remain required; never spoof GITHUB_* variables locally |

Retained trusted warm mode additionally needs real concurrency, job cleanup and process-lifetime tests/evidence. Existing cold sandbox tests and unit mocks do not provide it. Warm mode does not provide per-job filesystem/process isolation and must not become the default for untrusted submissions.

Render the base, local-database, full-container/CI and warm combinations with `docker compose ... config --quiet` before startup. Inspect profiles, ports and mount projections; assert only worker mounts `/var/run/docker.sock`. Keep expanded environment configuration private: do not publish raw `config` output, `.env` or credentials. The full-container profile reset must be verified on the installed Compose version. Record unchanged volume names and mount destinations.

The existing harnesses do not prove every requested manual drill. Record and exercise preserved-volume sentinel continuity across restart, two **real API** replicas with Redis fan-out and replica-local drain, API outage with web still serving pages, Redis/database recovery, real lab LAN HTTP/WebSockets, both themes and responsive navigation. A two-standalone-Socket.IO-server test does not alone prove two-API-replica behavior. Review all 12 runtime groups in the matrix, including catalog/mapping CRUD, bulk upload boundary cases and account/session lifecycle. Add missing tests in their owning lanes rather than marking broad groups passed from narrower evidence.

## Intended-host evidence record

Keep raw reports in private ignored `test-results/` paths; publish only approved synthetic artifacts. Run the audit on the intended host, then create `test-results/local-lab/host-evidence.json` from **actual outcomes**, with:

- `scope: "intended-local-lab"`; exact `commit`, `tree`, and observed `hardwareHash` from that host's audit.
- A credential-free `lanUrl` tested from a separate LAN client. Loopback or CI alone is insufficient.
- `requirements`: exactly the 12 IDs from the matrix. Each entry names the actual command/drill, its measured `exitCode`, `status`, and nonempty `artifacts` containing test-results-relative `path` and raw-byte `sha256`.

Use pending/blocked statuses and null exit codes for unperformed work. These intentionally fail the audit. Preserve failed/cancelled/skipped outcomes, logs and tool limits. Empty artifacts, omitted requirements, stale SHA/hardware, hash mismatch, traversal and symlink escape are rejected. Human reviewers must inspect the reports and host/LAN observations; a JSON declaration cannot itself prove a drill occurred.

Provide strict CI's `test-results/certification.json` plus its exact hashed artifacts for the same commit. The audit rechecks strict TAP/file sets and browser/system evidence; it never relabels a CI result as intended-host acceptance. A complete current strict run can supersede historical skipped predecessor runs, but cannot replace real lab evidence. The owner has stopped expensive CI: do not add `ci:full-stack` or `ci:auth-performance` without a fresh explicit request.

## Review, merge and rollback

Keep #81 open and its PR draft until ownership gaps are resolved, required final-head gates pass and the intended host/LAN has complete reviewed evidence. Snapshot the actual final folder tree, report hashes and hardware-qualified capacity; compare the tested tree with the squash-merged tree before declaring completion. Repeat affected checks if integration changes the tested tree.

Rollback is an application revert PR/redeployment of the prior application revision. Preserve PostgreSQL/Redis volumes, credentials, SQL filenames/bytes/ledger and existing data. Never describe database reset, reseed or volume deletion as rollback. Controlled backup/restore rehearsals use disposable resources under [the operations runbook](DEPLOYMENT_OPERATIONS.md).

External hosting is #82 / CR-ARCH-26B and remains separate. Frontend Vercel deployment on master does not certify or deploy the API, realtime, worker, database or Redis topology.
