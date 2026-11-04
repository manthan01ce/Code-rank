# CI minute budget mode

Enabled at the owner's request after more than 1,000 of the stated 2,000 included GitHub Actions minutes had been consumed. This usage is owner-reported, not independently measured billing data.

## Default PR checks

Keep Fast PR & Commit Checks automatic: Linux dependency installation, critical lint, disposable database migrations/schema preflight and unit tests, plus Windows launcher/seed-safety coverage.

## Opt-in expensive checks

| PR label | Workflow | Coverage |
| --- | --- | --- |
| `ci:full-stack` | Architecture checks | Integration, Docker isolation, independent images, gateway/container execution, browser workflows, capacity and recovery certification |
| `ci:auth-performance` | Authentication performance comparison | Baseline and candidate production builds and browser timing |

A maintainer applies the relevant label to the PR when that verification is needed. Create those repository labels if absent. Apply labels to the final review-ready revision to avoid repeated image/browser builds during intermediate fixes. Removing a label prevents subsequent commits from starting that expensive workflow; already-running jobs may need cancellation. Both workflows cancel superseded runs on the same PR.

Use full-stack verification for release candidates and changes to runtime topology, Docker/sandbox, database migration/recovery, queues, realtime, authentication/authorization or grading that need real-service acceptance. Use performance comparison for sign-in performance investigations or meaningful changes to authentication startup, retries or requests. Ordinary documentation, ownership-only planning and small UI changes usually need the fast gate plus focused local checks.

No test suites, assertions, security rules or capacity thresholds are removed. A skipped optional job is NOT a passing full-stack certification. Reports/PRs must distinguish fast-only validation from a completed full run, and old certification applies only to its tested revision. Do not claim deployment/architecture acceptance when relevant real-service tests were not run.

This owner-approved scheduling policy overrides earlier issue wording that required all expensive workflows on every intermediate PR revision. Issue-specific runtime acceptance still applies when relevant; run expensive checks once on the final head rather than on every push. CI remains PR-only, with no scheduled or post-merge builds added. Restore automatic gating by removing the label conditions when the budget policy changes.

If branch protection requires these job names, verify that skipped optional jobs satisfy the intended policy; never bypass a failing required check. GitHub usage and included-minute accounting should be checked in the account billing view before promising an exact saving.
