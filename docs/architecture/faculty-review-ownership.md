# Faculty review and report ownership (#71)

Baseline: master `92a0a6240a3f4bda61f7f3822c79feb32cf2570d`.

| Before: faculty route responsibility | Owner after extraction | Consumers |
| --- | --- | --- |
| Submission filters, sort, cursor, rows, detail/code and reset workflow | `features/submissions/hooks/useSubmissionReview.js` and `api/submissions-api.js` | Faculty workspace |
| Submission table and code/case/reset dialog | `features/submissions/components/{SubmissionReview,SubmissionDetailDialog}.js` | Faculty workspace |
| Marks department filter, two cursor axes, socket refresh, CSV export | `features/reports/hooks/useMarksOverview.js` and `api/reports-api.js` | Faculty workspace |
| Marks matrix | `features/reports/components/MarksOverview.js` | Faculty workspace |
| `components/PracticalGradeReport.js` (only importer: faculty route) | `features/reports/components/PracticalGradeReport.js` and `hooks/usePracticalGradeReport.js` | Faculty workspace; critical lint path updated |
| Authenticated paged report/review HTTP transport | `lib/http-client.js` | Submission and report API clients |

The route keeps course/tab URL and storage preferences, context selectors and practical authoring assembly. Practical CRUD, editor, detail and extra-time features retain their existing owners. No compatibility facade remains. Reports do not own practical authoring; submission review does not own API authorization or grading.

The existing `fetchCollection` remains the all-pages helper for small selectors; `requestPage` reads one table page and preserves `X-Next-Cursor`. Both use public HTTP only. Existing polling is reused. Selection/filter cleanup aborts requests and invalidates late results even when transport ignores cancellation; empty selection and unmount invalidate without needing a new request. Socket listeners and rooms are removed on cleanup; the submission room rejoins on connect. Reset remains a confirmed DELETE checked by API; late reset responses cannot refresh a different selection. Code inspection loads Monaco on demand.

## Validation lanes

- `npm ci`, `npm run lint:critical`, `npm test`, `npm run build --workspace=apps/web`.
- `node --test tests/faculty-review-requests.test.mjs`: cancellation and public request/cursor/error contracts.
- `npm run test:faculty-review`: production-browser tests with synthetic HTTP fixtures. Build web first. Optional `CHROMIUM_PATH` selects an installed Chromium executable.
- Existing real-service `tests/browser/role-workflows.spec.mjs` remains unchanged, including PDF and faculty CRUD/archive/extra-time/delayed-course workflows. Integration, Docker, privacy, capacity and recovery checks are retained.

Synthetic browser tests do not certify API authority, PostgreSQL effects, Socket.IO transport recovery or real PDF generation. Run the full-stack acceptance on the review-ready revision under the CI budget policy; no skipped lane is a pass.

## Local evidence

`npm ci` exited 0. Final `npm test` exited 0: 362 tests, zero failures/skips. Critical lint and the production web build exited 0. `git diff --check` passed. The browser suite lists all six scenarios, but the attempted browser run exited 1 before execution because this environment denies Chromium's process-singleton socket (`Operation not permitted`). Docker is unavailable, so real PostgreSQL/gateway, PDF, Socket.IO, capacity and recovery acceptance were not run locally. The PR records the exact implementation SHA and CI status.
