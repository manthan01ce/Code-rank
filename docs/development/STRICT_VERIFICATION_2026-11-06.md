# Strict verification follow-up — 6 November 2026

**Initial local verdict: BLOCKED.** College-server/intended-host/LAN/cloud acceptance remains deferred and excluded. The owner subsequently explicitly authorized full-stack Actions on PR #111. Current real-CI results and the exact final certified source/artifact identities are recorded in [PR #111](https://github.com/manthan01ce/Code-rank/pull/111); the local observations below remain historical, not a statement that tools are unavailable on GitHub runners. This report never certifies production hosting.

## Source and actual fix

Started from a clean isolated worktree of latest master `e3733ce61311739737580ad544f61bac5da5f057`; preserved the earlier worktree unchanged. This follows #102 and supersedes the earlier API health/metrics failure diagnosis, not the unperformed full-stack requirements.

Reproduced `process.memoryUsage()` throwing `ENOENT` / `uv_resident_set_memory` because this execution environment has no accessible `/proc`. Both operational metrics and detailed health called it directly. Metrics returned 500; detailed diagnostics discarded unrelated connection/queue information. Added a small API-owned memory probe that preserves the normal successful object exactly and returns null measurement fields with `available: false` and `PROCESS_MEMORY_UNAVAILABLE` when the OS probe fails. It does not fabricate zero usage, leak OS exception details, change readiness dependency checks or weaken authentication.

The existing health test now exercises successful measurements and a throwing probe. Existing real-listening API/gateway operations tests also pass against this environment's naturally failing OS probe (their PGlite/database fixtures remain unit/runtime-adapter evidence, not real PostgreSQL/Redis acceptance).

## Checks performed

| Check | Exit/result | Meaning |
| --- | --- | --- |
| Clean npm ci | 0 | Existing lockfile; no version/dependency changes |
| Critical lint | 0 | No lint errors/warnings |
| Strict npm test | 0: 401 passed, 0 failed/skipped/cancelled/TODO | Exact discovered/executed unit and architecture file-set verification passed |
| Focused health and operations suites | 0: 14 passed | Failure regression and existing admin/API/gateway contracts pass |
| API build | 0 | Syntax, dependency imports and route registration pass |
| bash launcher syntax / git diff check | 0 | No syntax/whitespace issues |
| Forced integrated build | 1 | Next.js fails uv_resident_set_memory ENOENT; no passing web build claim |
| Alternate Next webpack build | 1 | Same unavailable OS memory probe; compiler choice is not a workaround |
| Warm disposition harness | 1, blocked | Docker/Compose CLI absent, imageId null; no actual image/config execution |

Initial results above were collected with the implementation working tree in progress. Their hashes below describe those actual reports, not a clean-head final certificate. The final published source/tree and any clean-head rerun are recorded in the associated PR verification section; never promote these initial hashes to a different revision. The full-suite number is not a percentage of application correctness.

## Gaps that remain mandatory

| Requirement | Current state / completion requirement |
| --- | --- |
| Web build, web/API/worker/gateway/sandbox images | Build blocked by restricted OS telemetry; Docker CLI/socket absent. Use a normal Docker-capable disposable Linux test machine; do not patch dependencies or fake measurements. |
| PostgreSQL/Redis integration and migrations | Not performed here; requires isolated actual services and schema/ledger regression checks. No live or college database was accessed. |
| Authenticated browsers, PDF/upload/CRUD, all roles | Not performed end-to-end; requires the running real stack plus browsers. Unit mocks/PGlite do not replace it. |
| Run/submit/grading/privacy/cleanup, batch and retired-warm behavior | Active Docker lane has three specs and zero quarantine; exact-revision real execution and warm-disposition image/config report still required. |
| Two actual API replicas / fan-out / drain | Requires real Redis and two API processes plus public gateway; standalone Socket.IO fixtures do not complete it. |
| Outage and process/database recovery | Requires actual services, crash/restart drills and observed web availability. |
| Persistent-volume sentinel / backup / restore / rollback | Requires disposable real volumes, matching pg_dump/pg_restore (absent here) and preserved data. No reset/reseed/deletion was attempted. |
| Capacity | Requires unchanged thresholds and measured hardware/topology-qualified results. No throughput promise follows from unit success. |
| Final acceptance provenance | Every in-scope real group must have final-revision command exits, image/source/tool/hardware IDs, report hashes and tested/merged tree equality. No full certificate or merged-tree claim yet. |

These gaps cannot be ignored to close #102. Reopen its acceptance tracking until the required results exist. Previous PR/issue closure, successful fast CI and predecessor Docker claims do not supply missing integrated evidence. Existing host/CI validators, resource limits, SQL bytes/ledger, auth/privacy policy, volumes, test lanes, thresholds and Vercel policy remain unchanged. Cosmetic documented folder choices need no extra refactor.

## Initial artifact hashes (SHA-256)

- `unit.tap`: `613f88601e8c551a9c47d2d35c7f55149ce2afb4107cb429a06910cfc747f710`
- `unit.files.json`: `8ce46732abf0e738259f9443696761903193e43a09edf1599b0b05494c018a5a`
- `operations.log`: `3b25ace9132a9add1024b9651a7317d99a48fab4ac5927399878904868701867`
- `install.log`: `0cb919c2512cd91269228234a656c76b7faa1a8fc35c0ecb304eb841763195e8`
- `lint.log`: `b3363c13632c66dca5e023e5363c6ada0447428380b391992ca126f8f9ebc29a`
- `forced-build.log`: `c9167c1a83f5c2abcba14e693acfc76135e272f954844bfd5782c09b84ab8829`
- `webpack-build.log`: `28e18a2e6666a59fcc4f79cac05d3c162fd3dc870f82c2569b0f7c0ea471fa97`
- `api-build.log`: `a094243cac498fbf62e0dcdd4e3d0e13cd7fdf01134e13f583d7f01f95862b89`
- `warm-disposition.json`: `5fbbcb9f283cddceb23ccf5e0208a47b49bb087ca922eb7e662c7b064a8eb004`

## How to finish

On a disposable Docker-capable test machine, check out the exact reviewed PR head, install the declared tool versions, then run the existing integration, warm-disposition, Docker, stack, authenticated-browser and topology harnesses with their isolated environment setup. Complete missing replica, persistence, backup/recovery, rollback and capacity drills from the scoped #102 matrix. Keep every actual failed result visible and rerun affected checks after a fix. Do not add expensive Actions labels or dispatch stopped workflows without fresh explicit authorization. College-server acceptance remains outside this result.

## Authorized real CI and evidence-gate fixes

The owner explicitly authorized enabling `ci:full-stack` on PR #111. Initial real run [42108877809](https://github.com/manthan01ce/Code-rank/actions/runs/42108877809) passed all application stages: unit, PostgreSQL/Redis integration, Docker execution, all images and standard web build, Compose, gateway, web-to-worker execution, synthetic faculty UI, real authenticated role/browser workflows, two API replicas, capacity and process/database recovery. Certification failed because the faculty browser configuration used Playwright's default root test-results directory and deleted prior unit/integration/Docker file reports. The failure is preserved, not relabeled as a pass.

The faculty browser artifacts now have an explicit nested output directory; a regression test checks both browser configurations cannot clean the shared evidence root. Strict certification additionally requires source/image/configuration-bound warm retirement evidence and real durability drills. The Docker lane runs once through the warm-disposition harness; no existing test is skipped or weakened.

Added disposable container drills explicitly prove: only worker has Docker access; standard pages remain available during API outage; PostgreSQL/Redis graceful restart and SIGKILL recovery preserve sentinels and migration ledger; recreating application containers preserves named data volumes; rolling API back to an actual separately built prior-source image, then restoring the current image preserves data and readiness; real code still executes after recovery. The prior image is built from the PR base revision with a source label and must have a distinct image ID. No production/developer volumes or databases are selected.

Certification rejects omitted drills, missing prior/current image identities, identical rollback/current artifacts, wrong/dirty warm source, missing configuration modes and mismatched Docker report hashes. Final certificate records source commit/tree, runner hardware/tool versions, artifact hashes and actual image identities. Host/LAN validators remain unchanged, and CI capacity is only qualified for the recorded runner. See the latest PR run/artifact rather than treating an earlier run's evidence as final-revision acceptance.
