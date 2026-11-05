# Batch 5G: scoped integrated acceptance (#102)

**Historical initial attempt: BLOCKED.** Subsequent real disposable verification passed; see [the current evidence snapshot](../architecture/batch5-ci-acceptance.json) and current move-map matrix. The tables and command failures below describe the initial #110 attempt, not the latest CI result. College/intended-host acceptance remains deferred. Reviewed source: `29324a4b7690e8f71e356b121f568b091ba793c9` (latest master pulled before changes), tree `e759043cdb0e132efdbd6c9bf734a1941f9883d2`. Assessment date: 6 November 2026 (Asia/Calcutta). Raw command timestamps use the execution host clock and must not be used to infer the client date.

## Scope and prerequisite reconciliation

All six prerequisite issues are closed and their implementation PRs are merged. [The snapshot](../architecture/batch5-predecessors.json) records actual GitHub head/merge identities: #96/#106; #97/#103 plus #107; #98/#105; #99/#108; #100/#104; #101/#109. These are merge facts, not substitute acceptance evidence.

PR #95 supplied source inventories, an acceptance runbook and an auditor. It did **not** complete real #81 acceptance, despite automatic issue closure. PR #108 similarly merged while its report said Docker acceptance was blocked. PR #109 later reports 18 real Docker tests passing at its head; that historical claim is not a fresh run or independently reviewed image/Compose report for this revision.

**Deferred outside #102:** college-server deployment, intended-host identity/LAN reachability, DNS/TLS, provisioning, production promotion and cloud acceptance. These are not prerequisites to closing this narrower local integration issue. Keep them visible under #81/#82 without counting them as passed. Local browser/theme, process recovery, replica and container checks remain in scope. Existing intended-host/CI validators and `labCertified`/`cloudCertified` semantics are unchanged; a successful scoped report cannot manufacture a host certificate.

## Recommendation-to-source/test reconciliation

This table covers every one of the existing 18 concrete ownership rows. It supplements rather than rewrites their functional acceptance fields. Source/test references below were checked for existence; existence alone is not execution evidence.

| Row | Structural disposition | Source owner | Owning test/evidence |
| --- | --- | --- | --- |
| api-features | implemented | `apps/api/src/modules`; `packages/core/src/modules` | `tests/architecture/final-separation.test.mjs`; `tests/unit/api-route-contracts.test.mjs` |
| faculty-review | implemented | `apps/web/src/features/submissions`; `apps/web/src/features/reports` | `tests/unit/faculty-review-requests.test.mjs`; `tests/browser/faculty-review.spec.mjs` |
| users-pdf | implemented | `apps/web/src/features/users` | `tests/unit/users-ui-api.test.mjs`; `tests/unit/credential-pdf.test.mjs`; `tests/browser/role-workflows.spec.mjs` |
| auth-sign-in | implemented | `apps/web/src/features/auth/components/SignIn.tsx`; `apps/web/src/features/auth`; `apps/web/src/features/profile` | `tests/unit/auth-feature-ownership.test.mjs`; `tests/unit/password-session.test.mjs` |
| home-catalog-practicals | implemented | `apps/web/src/features/home`; `apps/web/src/features/courses`; `apps/web/src/features/mapping`; `apps/web/src/features/dashboard`; `apps/web/src/features/practicals`; `apps/web/src/features/practice`; `apps/web/src/features/coding-workspace` | `tests/unit/remaining-views-api.test.mjs`; `tests/browser/role-workflows.spec.mjs` |
| shared-layout | implemented | `apps/web/src/components/layout`; `apps/web/src/components/ui` | `tests/browser/role-workflows.spec.mjs`; `tests/architecture/final-separation.test.mjs` |
| shared-client-styles | implemented | `apps/web/src/lib/client`; `apps/web/src/lib/shared`; `apps/web/src/lib/utils.ts`; `apps/web/src/app/globals.css`; `apps/web/src/app/student/student-theme.css` | `tests/unit/browser-socket-auth.test.mjs`; `tests/unit/student-theme.test.mjs`; `tests/unit/progress-updates.test.mjs`; `tests/unit/fetch-collection.test.mjs` |
| core-policy | implemented | `packages/core/src/modules/submissions/GradingService.js`; `packages/core/src/modules/submissions/SubmissionRepository.js`; `packages/core/src/shared/pagination.js` | `tests/unit/grading.test.mjs`; `tests/integration/postgres.test.mjs` |
| core-facades | implemented | `packages/core/package.json`; `packages/core/src/shared`; `packages/core/src/modules`; `packages/database/src/client.js`; `packages/database/src/readiness.js` | `tests/architecture/core-public-entries.test.mjs`; `tests/unit/worker-import.test.mjs`; `tests/unit/selector-pagination.test.mjs`; `tests/unit/user-pagination.test.mjs`; `tests/integration/postgres.test.mjs`; `tests/integration/worker-recovery.test.mjs` |
| database-assets | implemented | `packages/database/bootstrap`; `packages/database/migrations`; `packages/database/seeds`; `packages/database/scripts`; `packages/database/sql-assets.sha256.json` | `tests/unit/database-assets.test.mjs`; `tests/unit/seed-safety.test.mjs`; `tests/integration/postgres.test.mjs` |
| worker-orchestration | implemented | `apps/worker/src/index.js`; `apps/worker/src/jobs/execution`; `apps/worker/src/jobs/system`; `apps/worker/src/realtime`; `apps/worker/src/lifecycle` | `tests/unit/worker-dispatch.test.mjs`; `tests/unit/worker-shutdown.test.mjs`; `tests/integration/worker-recovery.test.mjs` |
| runner-grouping | implemented | `packages/runner/src/languages`; `packages/runner/src/sandbox`; `packages/runner/src/Executor.js` | `tests/unit/worker-dispatch.test.mjs`; `tests/unit/runner.test.mjs`; `tests/unit/static-runners.test.mjs`; `tests/unit/sandbox.test.mjs`; `tests/unit/sandbox-recovery.test.mjs`; `tests/docker/sandbox.test.mjs` |
| sandbox-warm | partial | `infrastructure/docker/runner/Dockerfile`; `packages/runner/src/sandbox/Sandbox.js`; `docs/architecture/warm-daemon-disposition.md`; `scripts/ci/warm-mode-acceptance.mjs` | `tests/unit/warm-retirement.test.mjs`; `tests/unit/sandbox.test.mjs`; `tests/docker/warm-retirement.test.mjs`; `tests/docker/sandbox.test.mjs` |
| queue-contract | implemented | `packages/queue/src/bullmq-scripts.js`; `packages/queue/src/index.js` | `tests/unit/queue-script-contract.test.mjs`; `tests/integration/queue-script-admission.test.mjs`; `tests/integration/queue.test.mjs` |
| test-lanes-batch | implemented | `tests/lane-manifest.json`; `scripts/ci/run-tests.mjs`; `scripts/ci/verify-tap.mjs`; `scripts/ci/write-certification.mjs` | `tests/unit/job-lifecycle.test.js`; `tests/unit/test-discovery.test.mjs`; `tests/docker/batch-execution.test.js` |
| scripts-assets-docs | implemented | `scripts/dev`; `scripts/ci`; `scripts/ops`; `scripts/lib`; `apps/web/public`; `docs/getting-started.md`; `docs/deployment`; `docs/archive/2026-11`; `README.md`; `start-lab.sh`; `start-lab.bat` | `tests/unit/lab-launcher-env.test.mjs`; `tests/unit/seed-safety.test.mjs`; `tests/unit/load-test-entrypoints.test.mjs` |
| load-tests | implemented | `load-tests/scenarios`; `load-tests/scripts`; `load-tests/lib`; `load-tests/run-k6.ps1` | `tests/unit/capacity.test.mjs`; `tests/unit/load-test-entrypoints.test.mjs` |
| topology-optional-paths | retained-documented | `apps/web/Dockerfile`; `apps/api/Dockerfile`; `apps/worker/Dockerfile`; `infrastructure/gateway/Dockerfile`; `infrastructure/docker-compose.yml`; `infrastructure/compose.containers.yaml`; `infrastructure/compose.ci.yaml` | `tests/architecture/final-separation.test.mjs`; `scripts/ci/container-topology.mjs` |

16 rows are implemented, one is an intentional documented naming/topology retention, and warm retirement remains partial pending acceptance. All path references exist. Feature/page/API/socket URLs remain owned as specified; no route-group or browser/e2e renaming is necessary. The browser-safe contracts workspace has actual consumers. No new feature/runtime implementation, SQL, limits, volumes, dependency versions or Vercel policy was changed by this reconciliation.

## Runtime evidence groups and next commands

| Existing group | #102 disposition and evidence needed |
| --- | --- |
| builds-compose | Blocked: web build and actual application/gateway/sandbox images plus native resolved Compose modes required. Warm overlay is retired; verify cold modes and stale-flag rejection. |
| startup-volume-continuity | Pending: disposable project/volumes, sentinel persistence across host/container restart, no reseed or volume reset. |
| role-workflows | Pending: real disposable PostgreSQL/Redis, account/session/permissions, catalog/mapping CRUD, upload errors, saved PDF content. |
| faculty-student | Pending: authoring/archive/extra-time/review/marks, eligibility/timers, workspace/run/submit/history/profile refresh in a real browser. |
| sandbox-privacy | Blocked: real canonical image and all active Docker specs, language/error/timeout/batch/privacy/cleanup evidence. |
| replica-realtime | Pending: two actual API processes with Redis fan-out, replica-local drain and guest/job ownership through gateway. Standalone Socket.IO fixtures alone are insufficient. |
| outage-recovery | Pending: web remains available through API outage; worker/Redis/database/process crash/restart behavior. |
| backup-restore | Blocked: matching pg_dump/pg_restore and disposable database; verify data/ledger continuity. |
| capacity | Pending: real hardware-qualified measurements at unchanged thresholds; no inherited throughput claims. |
| host-lan | DEFERRED outside #102: intended college host and a second LAN client. Local browser/theme/navigation checks remain required under role/faculty groups. |
| rollback | Pending: redeploy/revert application only; prove sentinel data and volume identities survive. |
| final-head-ci | Expensive Actions remain STOPPED. Local equivalents and final tested/published/merged tree evidence are required for #102; they must be reported as local evidence, never forged as GitHub CI or host certification. Fast CI remains automatic. |

Use the owning commands documented in LOCAL_LAB_CERTIFICATION.md: `test:integration`, `test:docker`, `test:stack`, `test:authenticated`, container-topology and `deployment:check`, plus the missing drills above. `test:warm-disposition` records actual Compose/image identities and the active Docker lane. A Docker-free environment cannot replace those checks with mocks. Preserve synthetic/disposable targets and never target live college/production data. No expensive workflow labels or dispatches were used.

## Follow-up

[The strict follow-up](STRICT_VERIFICATION_2026-11-06.md) fixes unavailable process-memory diagnostics and records a passing 401-test local unit/architecture gate. Real integrated service acceptance remains blocked. The command results below are the historical #110 attempt, not the follow-up results.

## Fresh verification

| Check | Exit / result | Limit |
| --- | --- | --- |
| Clean `npm ci --no-audit --no-fund` | 0 | Node 24.22.1 / npm 11.9.0; no lockfile/version changes |
| `node --test tests/architecture/*.test.mjs` | 0: 26 passed, no failures/skips | Source ownership/import contracts; not live service verification |
| `npm run lint:critical` | 0 | Critical source lint, not browser/runtime acceptance |
| `npm test` | 1 | 400 tests: 397 passed, 3 failed; zero skips/cancellations. API health/detailed and metrics subtests fail, with their parent also counted. No passing full-suite claim. |
| `npm run build -- --force` | 1 | Web build fails `ENOENT: uv_resident_set_memory`; environment memory/process observation is unavailable. No image build attempted without Docker. |
| `npm run build --workspace=apps/api` | 0 | Source/dependency/route-registration validation only |
| `bash -n start-lab.sh` | 0 | Shell parsing only |
| `npm run test:warm-disposition` | 1 / blocked | Docker CLI unavailable (ENOENT), null image identity; dirty documentation working tree recorded truthfully |
| `npm run lab:audit` | 1 / blocked | Broader host auditor remains intentionally blocked; this shallow checkout cannot prove predecessor ancestry, and no host/CI certificate was fabricated |
| Structural matrix references | pass | All 18 rows' source and test references exist |

Observed execution environment: Linux x64, Node 24.22.1, memory reported 10,451,427,328 bytes, CPU inventory empty (0 exposed logical CPU entries). These are sandbox observations, not qualified capacity or college-server hardware. Docker/Compose/socket and PostgreSQL dump/restore tools are unavailable. No live DB/Redis/browser execution or capacity measurement was performed. The current API operations implementation/tests were not changed to hide these failures.

Architecture log SHA-256: `ee71a43cb52ebe1fccf1a60daf181d24ac27d26a9ba507971516e6544965abfc`.

SHA-256 of actual command artifacts:

- `unit.tap`: `adf68e3af50f4466a0e4282f2ae7f84f6556ecff28da26cf0694a9354389301b`
- `unit.files.json`: `8ce46732abf0e738259f9443696761903193e43a09edf1599b0b05494c018a5a`
- `warm-disposition.json`: `80fb7ef1b1169002b5636d70b2862da4ef10d6fc98e23bcd5000b10520108446`
- `install.log`: `fe6cffb08de0f2bd04926a090c3a951d9d367fae7915cbf7cfd9efeac4dbf823`
- `lint.log`: `b3363c13632c66dca5e023e5363c6ada0447428380b391992ca126f8f9ebc29a`
- `build.log`: `c60914657209b88c21da176857bcd33ebb820a845c796c636a7c4dc0c5e2855a`
- `api-build.log`: `a094243cac498fbf62e0dcdd4e3d0e13cd7fdf01134e13f583d7f01f95862b89`

Raw reports stay in ignored test-results or private diagnostic output. The unit TAP/file set, warm report and command logs must be SHA-256 hashed alongside their actual source/tree identity. Current implementation checks run while the documentation patch is uncommitted; they are not a clean final-head certificate. Before completing #102, commit the final revision, rerun affected checks on that exact clean head, record image identities and all required runtime artifacts, then compare its tree with the merged tree. No merge comparison is claimed while this PR is draft/unmerged.

## Completion gate

Keep #102 open and this PR draft until all in-scope real checks pass with exact-revision reviewed evidence. Missing resources or failed commands remain blockers. Do not weaken the matrix, expected test inventory, host validators, thresholds or CI budget to obtain a green result. Documentation reconciliation is useful implementation work but is not full acceptance.
