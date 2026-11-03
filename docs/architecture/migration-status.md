# Architecture migration status

Reviewed against master `3d4ce2f97e1ece2686b25d4ce02587c7e0889378` and the batch audit correction. A closed preparation issue is not evidence that the destination architecture exists.

## Current versus destination

| Area | Current implementation | Recommendation and remaining work |
| --- | --- | --- |
| Applications | `apps/web`, `apps/worker` | Add independently runnable `apps/api`; three deployables |
| HTTP | All 47 route files remain in `apps/web/src/app/api` | Move adapters and API-only services by feature into `apps/api/src/modules`; preserve URLs, auth, headers and responses |
| Realtime | Web custom server owns Socket.IO | API owns Socket.IO; preserve worker service authentication and browser room/job authorization |
| Frontend features | Coding-workspace, practice, credential PDF and practical-authoring extractions landed | Finish submission/reports/user workflows as separate slices; route files assemble views |
| Core | Browser PDF implementation removed; explicit runtime environment export added | Retain only genuinely shared backend rules; move API-only services, retire facades after consumers migrate |
| Tooling | Unused config package removed; root tooling now has explicit lint dependencies and backend correctness rules | Expand checks with the API workspace as it is implemented |
| Database | SQL assets and lifecycle scripts still under root `database/` | Consolidate under database package without changing migration names/checksums |
| Runtime/deployment | Combined Next.js/custom backend runtime remains | After all cutovers, standard Next.js web plus independent API/worker artifacts and gateway |

The foundation issues #19/#20 recorded the baseline and accepted design. Issues #24–#34 addressed setup, CI, selected ownership and frontend slices. PR numbers #35–#47 are merge records, not additional implementation stages. Their completion does not complete the full review's migration plan.

At this audit the only open PR is the correction PR #48; there is no open API implementation issue. The CR-ARCH identifiers below are planned work identifiers from the accepted ADR/route inventory, not existing GitHub issue numbers. They need concrete implementation issues before contributors start those stages. Never claim that an issue exists merely because an ADR names its identifier.

## Next dependency order

Follow [ADR-0001](decisions/0001-api-runtime-and-hosting.md) and the [route inventory](route-inventory.json).

| Order | Planned work identifier | Required completed work | Deliverable |
| --- | --- | --- | --- |
| 1 | CR-ARCH-09 | Foundation and setup batch; verified audit correction | Fastify API workspace, bootstrap/lifecycle/container/gateway wiring; migrate only `/api/live` with real direct and gateway contract tests; remove its old handler |
| 2 | CR-ARCH-10A | 09 | Auth adapters/shared middleware and identity/password contracts |
| 3 | CR-ARCH-14 | 10A | Socket.IO moves from web to API, including worker transport and room/session ownership tests (Variant X) |
| 4 | CR-ARCH-10B and CR-ARCH-11A | Shared API/auth runtime; coordinate shared-file edits | User-management and course/department/mapping HTTP slices; may proceed independently after prerequisites |
| 5 | CR-ARCH-11B and CR-ARCH-12A | 14, plus actual feature/service prerequisites | Practical-management and execution HTTP slices; preserve event publication and execution contracts |
| 6 | CR-ARCH-12B | 12A and established realtime boundary | Submission/history/reset/workspace HTTP slice |
| 7 | CR-ARCH-13 | API/auth runtime and any services its endpoints consume | Operations/profile remaining HTTP slice; preserve readiness without running migrations |
| 8 | CR-ARCH-15 | Every HTTP slice and 14 complete; 47-route parity proven | Complete web/API separation; remove web backend imports/secrets/custom Socket.IO server only now |

These are minimum prerequisites, not permission to bypass feature-level consumers. Each implementation issue must enumerate the exact paths/methods it owns using the inventory. Use a new branch and PR per slice; start a dependent slice only after its prerequisites merge and pass CI. One public URL must have one authoritative handler throughout cutover. Do not create empty destination directories to make the tree appear complete.

After separation, schedule remaining frontend extractions, core export/facade cleanup, database assets, sandbox/worker consolidation and supported lab topology verification in small changes. Keep SQL bytes and volume identity intact. Hosted/cloud verification remains a separate decision; the accepted initial topology is the local Linux lab.

## Completion evidence

For each stage, record the PR, merged master revision, actual test results and known limitations. Add API lint/boundary/build checks when the app is created. API contract tests must cross a real listening HTTP boundary and exercise the public gateway. Full separation requires web without backend packages/secrets, API without Next.js/React, worker-only Docker access, authenticated browser workflows, real execution/realtime/recovery and all three independently verified artifacts. Existing CI success for the combined runtime cannot certify an API service that does not exist yet.
