# CodeRank test inventory (#79 / CR-ARCH-24)

The sole file-membership authority is tests/lane-manifest.json. scripts/ci/test-lanes.mjs reconciles it with recursively discovered .test.js/.test.mjs and .spec.js/.spec.mjs files in both directions. Missing files, orphan tests, duplicate membership, empty active categories and mismatched quarantine reasons fail before execution. File counts below describe this snapshot, not fixed pass thresholds. Add new files to the manifest deliberately.

| Category | Files |
| --- | --- |
| unit | 85 |
| architecture | 4 |
| integration | 6 |
| docker | 1 |
| neon | 2 |
| browser | 1 |
| frontend | 1 |
| performance | 1 |
| quarantine | 1 |

## Active lanes

- npm test runs tests/unit plus tests/architecture. Existing job-lifecycle.test.js stays active; extensions are preserved.
- npm run test:integration runs six explicit local PostgreSQL/Redis service files. The original Redis admission-contract scenarios now always register in queue-script-admission.test.mjs; missing Redis fails integration rather than silently omitting tests from the unit file.
- npm run test:docker runs tests/docker/sandbox.test.mjs. Real Docker/runner image is required.
- tests/browser stays in place: role-workflows is real authenticated browser coverage; faculty-review is the separate synthetic frontend lane; auth-performance remains opt-in. Playwright reads the same manifest. The performance harness copies the registry/module onto historical baselines and validates its selected browser files there, rather than requiring the baseline to adopt this directory tree.
- test:redis and test:postgres select service subsets from the integration category; test:neon selects the explicitly opt-in isolated-schema Neon category. The selected-service launcher preserves their original process environment and does not execute them in unit discovery. No live Neon run was requested or performed.

The strict Node runner records actual test:pass/test:fail file events in test-results/<lane>.files.json alongside <lane>.tap. TAP verification still rejects failed, skipped, cancelled, TODO, focused, empty-wrapper, truncated and forged-count evidence. Active gates require the executed set to match discovered files exactly; the reporter file is cleared before each run, so stale/missing evidence fails. Certification hashes both TAP and file reports and rejects pending quarantine, missing runtime/browser/faculty/capacity/recovery evidence or a wrong commit. Playwright certification reconciles actual spec-file results against the manifest and rejects empty suites, omitted specs, retries, skipped/expected-failure tests and report errors. Faculty frontend evidence is saved separately as faculty-review-results.json. CI summaries continue to use actual outcomes; no hard-coded passing rows/counts are added. Workflow triggers remain PR-only, expensive jobs remain opt-in and disabled by owner direction.

## Before/after coverage reconciliation

See test-lane-move-inventory.json for every original file, original and destination paths, AST-extracted test declarations, source/destination lanes and before/after hashes. All 100 original files are mapped to 102 current files: one new discovery test and one split of the Redis admission contract. The batch reimplementation is the sole declared test-declaration replacement; every other original declaration is retained across its destinations. Imports, module mocks, file URLs, repository cwd calculations, fixtures, subprocess paths, Windows fast checks, browser configs and maintenance/profiling references moved together. No active test was removed, skipped or reclassified as quarantined. Architecture tests remain in the ordinary unit execution evidence. Fixtures are helpers, never discovered as tests.

BullMQ stays pinned at 6.3.10 across direct consumers. A unit contract checks the worker/core/queue manifests, all lockfile installations and the installed script package for exact alignment. queue-script-contract and queue/atomic-admission coverage remain present, with no check-then-add replacement or dependency upgrade. No runtime execution or grading implementation changes.

## Existing quarantine: NOT restored/certified yet

The one existing quarantine is now tests/docker/batch-execution.test.js. Its host PATH/docker shim is removed. The real Executor/Sandbox candidate checks framed batch output/marks/metrics; runtime-error continuation; per-case timeout and fail-closed continuation after sandbox destruction; compile failure; malformed cases; bounded elapsed execution and real container cleanup. It uses disposable containers and no mocks. Run explicitly with `npm run test:batch` on a Docker-equipped test host. It uses the same strict TAP/file reporter and writes batch.tap/batch.files.json; this explicit candidate command does not count as the active Docker lane. The existing opt-in full-stack workflow includes a named candidate-validation step, without changing labels or triggers. Retire that separate step after a real pass and Docker-lane activation to avoid running the candidate twice.

Docker is unavailable in this workspace. Therefore this file has NOT passed real Docker validation, is NOT in the active Docker gate, and its original named quarantine is retained. Do not describe coverage as restored. After a real passing run, move its single manifest entry from quarantine to docker and remove its quarantine reason atomically, rerun all four lanes and complete strict final-head certification. Until then certification fails rather than concealing the incomplete CR-ARCH-24 obligation.

Full-stack/auth-performance CI is stopped per explicit owner direction; no expensive labels are applied. Full strict certification and real integration/Docker/browser/security/PDF/faculty/realtime/capacity/recovery acceptance remain pending. Unit mocks do not replace runtime evidence. This implementation is a draft and must not merge/close #79 until the real batch run, quarantine removal, active Docker registration and final-head certification pass.

## Validation and merge gate

Implementation base: `0d7679850a8346cf545c096b57ee23d02fbf586f`. Work is isolated on `refactor/batch4-tests`; the pre-existing dirty checkout was preserved. No application feature, SQL, dependency version, runtime resource limit or expensive-CI label is changed.

Run `npm ci`, `npm run lint:critical`, `npm test`, and `npm run build`. On a disposable service host also run `npm run test:integration`, build `infrastructure/docker/runner/Dockerfile`, run the batch candidate command above, then `npm run test:docker` and the authenticated browser/full certification workflows. Integration requires isolated PostgreSQL/Redis; no live Neon commands are authorized by this refactor. Full strict certification remains blocked until batch is active in the Docker lane and all final-head runtime evidence passes. Record the tested source SHA and command exit codes in the PR; a green fast lane is not full certification.
