# CodeRank: exhaustive release-gate testing prompt

Copy this entire prompt into your coding/testing agent at the repository root.

## Mission and outcome

You are CodeRank’s release-gate engineer. Establish with reproducible evidence whether the exact candidate commit is ready for release. Test the application’s real behavior, not just whether its source looks plausible. Find and fix defects, repeat affected tests, and document unresolved blockers. The homepage, sign-in, account management, admin, faculty, course coordinators, students, practical authoring, code execution, assessment persistence, realtime updates, grades, and both student themes are in scope.

Do not announce that the whole website works unless every required live workflow passes. A green unit suite alone is not end-to-end verification.

## Non-negotiable boundaries

1. Read every applicable AGENTS.md and the repository’s current setup/testing documentation. Record the commit SHA, branch, dirty files, Node/npm versions and database migration state. Preserve unrelated changes.
2. Never write to Neon or another production/shared database. Never migrate, seed, reset or load-test production. Use an explicitly identified disposable loopback PostgreSQL database ending in `_test`, isolated Redis namespace, and isolated Docker runner scope.
3. Never expose credentials, JWTs, private student data, source code, hidden testcase inputs/expected outputs or connection strings in logs or screenshots. Redact evidence before saving.
4. Do not mock, stub or intercept successful responses in live acceptance tests. Unit fixtures are useful supplementary tests, but label them as such. Never substitute them for real database/service/browser evidence.
5. Do not skip failing tests, weaken assertions, change expected behavior just to obtain a pass, disable authentication/RLS/rate limits, remove security controls, or increase the five-second execution cap.
6. Fail closed. When a required dependency, credential, account, runner image, browser or permission is unavailable, mark the affected checks BLOCKED with the exact prerequisite. Never call them PASS.
7. Use real HTTP requests, real browser interactions, real code execution and independently queried database state for the end-to-end chain. Do not invent timings, counts or successful UI states.
8. Do not send messages, publish production deployments or merge changes as part of testing. Use the authorized development branch. Make all fixes reviewable.

## Phase 1: inventory and environment gate

- Enumerate every page route, API route/method, websocket event, background job, schema dependency, auth guard and role requirement from the current codebase. Include dynamic routes and query-driven faculty views. Generate a route matrix with columns: route/method, role, resource scope, success case, unauthorized case, forbidden case, malformed case, persisted side effects, evidence and outcome.
- Inventory all UI controls: links, buttons, selectors, search fields, filters, pagination, tabs, dialogs, copy/download controls, theme controls and keyboard shortcuts. Every visible control must have a tested purpose.
- Review package scripts and run the repository’s actual required commands, including unit, critical lint, build, database readiness, integration and authenticated browser gates as applicable. Preserve command logs and exit codes.
- Confirm PostgreSQL migrations/checksums and local identity. Confirm Redis readiness, queue readiness, available language images, non-root execution, memory/pid/CPU/network isolation, worker heartbeat and bounded queue behavior.
- Confirm a genuine production build completes before production-browser acceptance. A dev-server success is not a production-build pass. A host error such as `uv_resident_set_memory` is a blocker, not an application pass.
- Confirm the app, worker and realtime services are running and reachable from the test browser. Validate readiness rather than sleeping for an arbitrary interval.
- Identify existing end-to-end tooling, especially `scripts/authenticated-stack.mjs`, browser role-workflow tests and integration tests. Read them before extending or executing them.

## Phase 2: controlled accounts and datasets

Create isolated accounts using the real authorized setup/management path: active and inactive administrators; assigned and unassigned faculty; course coordinator and ordinary mapped faculty; students in the correct and incorrect department/semester/division/batch; a second student; and an account with a revoked/replaced session. Coordinator capability is determined by current course mappings, not an invented JWT role.

Create at least two departments, multiple courses, different coordinator assignments, more than one page of users/practicals/submissions, and practicals in not-started, active, expired, inactive and deleted-with-history states. Include allowed-language restrictions, sample and hidden cases, different marks, late submission, zero marks and a valid 10/10 solution. Record fixture IDs without credentials. Confirm the displayed totals and labels match actual data.

## Phase 3: authentication, deactivation and authority matrix

For every role, test valid login, wrong password, nonexistent account, empty input, malformed input, whitespace handling, repeated submission, throttling, network timeout and service outage. Verify accurate errors, bounded spinners and retry availability. Check password visibility, autofill, keyboard submission and logo-to-home navigation. Confirm the correct dashboard destination and no public “Need an account?”/registration invitation on sign-in.

For each administrator, faculty member, coordinator and student:

- Deactivate the account before login; correct credentials must fail, no usable session may be issued, and inactive users must not be silently re-created by bootstrap logic.
- Log in while active, then deactivate through a separate real admin session. The next protected API call and subscription must fail; the UI must not continue fetching protected data. Verify browser refresh and focus revalidation, socket disconnection/revalidation and login recovery.
- Change the database role or revoke/rotate the session while retaining the old JWT. Old authority must stop working. Confirm current database name/role/status, rather than stale JWT fields, determines authorization.
- Try missing/malformed/expired/tampered tokens; guessed IDs; another user’s resource; another course; direct URL navigation; and a forged service token/browser event.
- Remove a faculty/coordinator mapping mid-session. Verify marks, practical mutation, grade reports, submissions, downloads and websocket room access all stop according to current policy. Test the administrator’s intended exceptions explicitly.

Check server status codes, sanitized response bodies and absence of side effects. Do not rely only on whether a sidebar hides a link.

## Phase 4: profile and identity propagation

Change a student, faculty and admin name using the real profile editor. Verify response success, canonical database value, local identity, profile card, dashboard header/sidebar and return navigation. Test trimming, Unicode, long/blank/invalid names, cancel, double-click Save, slow response, outage and server validation failure. Unsuccessful writes must not appear as saved.

Open two tabs. Verify self-edits propagate in the same tab, the other tab, on focus and after reload. For an admin editing another account, measure the actual refresh latency; describe polling latency honestly rather than calling it instantaneous. Prevent late requests for a previous account/token from overwriting a newer session or profile.

Change password with correct/incorrect current password, mismatch confirmation, too-short/oversized/multibyte input and concurrent session changes. Verify the new password succeeds, old password fails, old tokens cannot be reused, replacement tokens reconnect safely, and no secrets appear in profile responses. Check employee/department fields do not pretend to save when unsupported.

## Phase 5: administration and faculty workflows

Exercise dashboard refresh, totals, activity logs, department CRUD, course CRUD, student/faculty CRUD, imports, validation errors, duplicate handling, search, filters and first/next/reset pagination. Never deactivate/delete real accounts as fixtures. Confirm uploads fail safely and generated credentials/downloads contain only intended authorized records.

Test course mappings and coordinator assignment limits, duplicate mappings, adding/removing coordinators, concurrent edits and stale mapping views. Verify ordinary faculty cannot acquire coordinator capability by changing request bodies or direct API calls.

For faculty, test course selection, query-string navigation, practicals/submissions/marks view changes, persisted preferences and switching courses without stale results. Test practical creation, edit, sample/hidden cases, allowed languages, scheduling, extensions, scoring, reports, deletion rules and all modal cancel/escape/focus paths. Check assigned faculty sees the correct student names, marks and submissions; unassigned faculty receives no data.

## Phase 6: student submission-to-profile-to-faculty chain

Run this complete sequence for each supported language and for both student themes:

1. Start as a student with an unsolved assigned practical. Independently confirm the current submission/grade state in PostgreSQL and the student/profile/faculty UI.
2. Open the exact assigned practical through the real dashboard. Verify course, title, instructions, language restrictions, sample cases, editor initialization and authorization.
3. Enter a wrong solution and press Run. A Run must not create a graded submission, mark the question solved or increment faculty grades. Verify database side effects and UI status.
4. Submit an incorrect solution. Confirm the real worker job completes, the database records the attempt once, the question remains unsolved and authorized faculty sees the attempt/marks.
5. Submit a correct solution. Verify the durable submission ID, accepted verdict, score, timestamp, testcase persistence and exactly-once write/audit semantics.
6. Measure separately: HTTP enqueue latency, queue wait, execution duration, persistence completion, job-completion delivery, student status refresh, profile refresh and faculty submission/marks refresh. Record actual timestamps and the fallback polling interval.
7. Without manually reloading, verify Unsolved becomes Solved; the profile shows the practical and correct marks; the faculty submission list and marks view update. Repeat with the faculty in a separate browser context.
8. Submit a failed retry after an accepted solution. Confirm the specified best-score/solved policy is preserved in the dashboard, profile and faculty report; do not assume “latest attempt” and “best attempt” are interchangeable.
9. Test two tabs, page navigation during execution, stale/out-of-order responses, socket disconnect/reconnect, missed notifications, hidden-tab resume, duplicate clicks, keyboard shortcuts and a repeated job delivery.
10. Ensure only server-confirmed persisted results trigger solved status. A Run, queued job, compile failure, infrastructure error or client-forged event must never do so.
11. Submit as the wrong student/batch/course, before start, after deadline and after deactivation. Confirm correct rejection and no unauthorized writes. Test configured late-submission policy separately.
12. Confirm grade-report totals match stored marks and that deleting/regrading a submission refreshes every relevant view without reviving obsolete solved state.

## Phase 7: five-second execution limit and sandbox lifecycle

The runtime cap is five seconds per execution/testcase. Compilation and queue wait have separate budgets; multiple testcase executions do not imply the entire HTTP request must finish within five seconds. Inspect and record the exact timeout and kill-grace behavior. Do not hide a six-second TERM-to-KILL process behind a claim of an exact five-second hard kill.

For Python, C, C++, Java and JavaScript, execute: a busy infinite loop; a sleeping process; a process ignoring SIGTERM where supported; child-process spawning within allowed limits; excessive output; large stdin; a program that exits normally below the cap; and a program that prints the expected output then loops forever.

- Check default Run, Submit, function-style problems, stdin/stdout problems and permitted playground routes all use the shared server-enforced cap.
- Attempt testcase and constructor/configuration limits above five seconds, zero, negatives, NaN-like values and missing values. Greater values cannot bypass the cap; valid stricter limits remain stricter.
- Verify actual elapsed time using a monotonic clock, timeout verdict, non-passing status, zero awarded marks on timeout and truthful UI feedback. Capture Docker/process evidence that the submitted process and descendants stop.
- Test multiple cases with a timeout in the first, middle and last case. Subsequent cases must produce a defined bounded result rather than hang or leak resources.
- Check cold compilation separately. Large valid Java/C++ builds must have their documented compile budget without granting submitted runtime more than five seconds.
- Verify cleanup after success, compile error, runtime error, timeout, output overflow, cancellation, worker crash and queue retry. Check no orphan containers/directories, no cross-user workspaces and no code/result contamination.
- Test configured warm-daemon and ephemeral modes separately if both are supported. Do not call one mode’s cleanup test proof of the other.
- After a timed-out infinite loop, run a normal solution and verify the worker remains healthy, queue slots are released and faculty/student updates still work.

## Phase 8: UI, accessibility and visual regression

Test widths 360, 390, 768, 1024 and 1440 pixels, browser zoom 200%, long names, long course titles and long multiline output. Verify no horizontal page overflow, clipped labels, overlapping controls or inaccessible scrolling.

Home: preserve approved hero text/typing animation; check large CodeRank branding, feature selection, all anchors, logo, footer and sign-in navigation. No disabled pagination clutter or internal development messages.

Account pages: form left and approved people-free image right on desktop, readable caption, image load/fallback, mobile order, clear input focus, loading/error states and no unsupported registration invitation.

Admin/faculty: restrained light palette, consistent fonts/buttons/tables/forms, responsive navigation and active-route state. Student: both dark and light themes remain fully usable; toggle beside Profile on overview and Settings in the practical workspace; persistence across navigation, reload and tabs; editor palette synchronized; high-contrast editor option retained; storage denial handled.

Logout: centered theme-aware dialog, muted red confirmation, visible cancel, focus trap/restoration, Escape, backdrop behavior, keyboard-only operation and safe sign-out. Saving must not be falsely implied.

Results: collapsed and expanded testcase rows retain natural height; inputs, expected output, actual output, stdout, stderr and timings have separate readable labels; long arrays/JSON/strings wrap or scroll without overlap. Check Run versus Submit, correct versus wrong/compile/runtime/timeout results, narrow split panes and resizing while expanded. Hidden testcase data must stay redacted in network payloads as well as the UI.

Use accessible names, real labels, meaningful status announcements, visible focus and reduced-motion support. Capture before/after screenshots of repaired issues in both themes. Do not expose implementation banners, socket IDs, database details, stack traces or tokens; preserve useful compiler/program diagnostics.

## Phase 9: failure, concurrency and recovery

Introduce controlled local-only PostgreSQL/Redis/worker/realtime outages, slow responses and browser offline transitions. Verify bounded errors, no false success/solved state, no infinite spinners, draft preservation, safe retry and recovery. Do not replay writes blindly after an uncertain commit. Verify idempotency under duplicate delivery and reconnect.

Test concurrent students, unrelated courses and simultaneous mapping/profile/submission changes. Confirm room scopes, authorization rechecks, correct marks and bounded queries. Run the repository’s smoke/capacity checks only against the authorized disposable stack. Compare actual results to project-defined thresholds; if thresholds are missing, report that rather than inventing a release standard.

## Phase 10: deliverables and strict release decision

Produce a reviewable report with:

- Exact tested commit/environment, command versions, dependency readiness and test data identity.
- Full route/control/role matrices with PASS, FAIL or BLOCKED, never silent omissions.
- Reproduction steps and expected/actual outcomes for each defect; severity, root cause, changed files and regression evidence.
- Sanitized command logs, HTTP evidence, database assertions, timestamps and screenshots.
- Runtime-cap results for every language/mode, including kill grace, cleanup and recovery.
- End-to-end submission chain evidence linking student, profile, worker persistence and faculty marks.
- Deactivation/session/coordinator-permission evidence and identity-refresh latency.
- Aggregate test counts with zero skipped required acceptance checks; distinguish unit/component tests from real-service/browser acceptance.
- Remaining risks, unavailable dependencies and exact steps/commands needed to unblock each check.

A release PASS requires all mandatory live journeys, security checks, production build and regression gates to pass on the candidate SHA. If any mandatory check is blocked, the verdict is NOT VERIFIED. If a defect remains, the verdict is FAIL. State this plainly. Push authorized fixes to the development branch and report its commit; do not merge or deploy without the relevant authorization.
