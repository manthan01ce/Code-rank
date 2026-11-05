# Route compatibility after the architecture repairs

The route inventory test retains all 46 API paths, their HTTP methods and all 17
page locations. Domain/package extraction does not require changing public URLs.

| Route group | Current contract |
|---|---|
| Run/submit/language execution | Asynchronous 202 response with job ID; protected polling at `/api/jobs/[jobId]` |
| `/api/faculty/practicals` GET | Array page, default limit 100, max 200; `cursor` and optional `course_id`; `X-Next-Cursor` header |
| `/api/faculty/practicals` POST | Same success envelope `{success, practical}`; validates and commits practical/cases/audit atomically |
| `/api/faculty/practicals/[id]` GET/PUT | Existing detail/success shapes; graded case changes return 409, identical cases remain editable with metadata |
| `/api/faculty/practicals/[id]` DELETE | Archives the practical and preserves history, including when it has no grades; success message describes archival |
| `/api/faculty/practicals/[id]/extra-time` POST | Positive whole `extraMinutes` (max 10080) or a valid later `newEndTime`; update and audit commit atomically |
| `/api/mapping` GET/POST | Existing grouped mapping and success shapes; duplicate/invalid faculty IDs rejected, replacement and audit atomic |
| `/api/faculty/practicals/[id]/submissions` GET | Array page, default 100/max 200; opaque cursor from `X-Next-Cursor`; existing search/status/division/date/sort filters |
| Student submission-history GET routes | Array page, default 100/max 200; numeric ID cursor; own submissions only |
| Workspace save/load | Existing paths and result shapes; shared practical-access and source/language validation |
| `/api/users` GET | Array page, default 100/max 200, numeric cursor and `X-Next-Cursor` |

Treat cursors as opaque: copy the response header unchanged into the next request,
and reset it whenever filters or sorting change. An empty header ends pagination.
Existing first-party callers were updated for the changed bounded collections.
Faculty tables retain one page; selectors may collect multiple bounded pages.

Socket.IO uses WebSocket-only transport. An opt-in Redis adapter supports multiple
servers; HTTP polling of job status remains the authoritative fallback. Cluster mode
refuses startup without shared realtime enabled. Production cluster/isolation and
browser workflow checks remain deployment gates.

Deploy migrations through 006 and the matching web/worker together after draining old workers.
No migration has been applied to a live database during this work.

Fourth-stage contracts:

- Both `/api/users` and `/api/users/[id]` mutations use the same transactional
  service. User DELETE deactivates rather than removing grading history; changing
  roles is rejected. Creation returns a generated password only for a committed row.
- Bulk upload accepts CSV/XLSX, at most 5 MB and 500 rows, with per-row atomicity.
- Course stats retain `{course, practicals, students, submissions}` and add
  `departments` and `pagination`. Use `studentCursor` and `practicalCursor` separately;
  defaults are 100 students and 25 practicals, maxima 200 and 50. CSV exports the
  displayed page, not an implied whole-course export.
- Profile GET requires authentication and returns only the latest 100 grade
  summaries, without source code. No public path or HTTP method was removed.

Fifth-stage contracts:

- Course/department/faculty-course/faculty-batch collections retain array bodies,
  add cursor headers, default to 100 rows and accept at most 500.
- Course deletion returns 409 while practicals exist; department deletion returns
  409 while users reference it. Mutations and audits commit together.
- Protected routes reject revoked sessions with 401 and database authentication
  outages with 503. Invalid bearer credentials cannot become guest access.
- Password changes return a replacement token; clients must persist it.
- Faculty submission reset requires the current course mapping and commits its
  audit atomically. Historical practical authorship grants no fallback authority.
- `/api/health` returns 503 without a healthy worker lease. `/api/live` remains the
  process liveness endpoint.

Readiness refinement: `/api/health` now also returns 503 if the migration ledger
is missing, pending, or differs from the required checksums. The database service
report includes `schema` (`current`, `missing`, `pending`, `mismatch`, or `unknown`).
HTTP methods and paths are unchanged. Liveness remains independent.
