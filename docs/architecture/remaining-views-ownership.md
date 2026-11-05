# Remaining frontend view ownership (#74)

Baseline: remote master d968f7c6311f8eae278110a269d98e0a81e4e13e, tree 45a1e01725e2799a01fbe0e807440083fca9453d. The checkout was synchronized through authenticated GitHub reads after terminal Git authentication failed; the baseline tree hash was verified exactly before editing. No upstream backend ownership changes are part of this PR.

| Previous route/component | Feature view | Workflow hook |
| --- | --- | --- |
| `app/admin/courses/page.js` | `features/courses/components/CoursesManagement.js` | `useCoursesManagement` |
| `app/admin/departments/page.js` | `features/courses/components/DepartmentMaster.js` | `useDepartmentsManagement` |
| `app/admin/mapping/page.js` | `features/mapping/components/CourseMapping.js` | `useCourseMapping` |
| `app/admin/logs/page.js` | `features/operations/components/ActivityLogsPage.js` | `useActivityLogs` |
| `app/admin/page.js` | `features/dashboard/components/AdminDashboard.js` | `useAdminDashboard` |
| `app/student/page.js` | `features/dashboard/components/StudentDashboard.js` | `useStudentDashboard` |
| `app/student/practicals/page.js` | `features/practicals/components/StudentPracticals.js` | `useStudentPracticals` |
| `features/practice/components/PythonDashboard.js` | `features/practice/components/PythonDashboard.js` | `usePythonDashboard` |
| `features/coding-workspace/components/WorkspaceLayout.js` | `features/coding-workspace/components/WorkspaceLayout.js` | `useCodingWorkspace` |

Courses and departments share features/courses; mapping owns faculty membership/coordinator forms; operations owns audit filtering; dashboard owns administrator/student overview data. Student discovery, selection, preview and its existing solve/history state live in practicals. The existing usePracticalPage hook has one implementation under practicals, with all dashboard/workspace/discovery consumers and the critical lint command updated. Existing progress notification, request-key cancellation, cursor paging and sockets remain in use; no new poller or socket is introduced.

Practice/PythonDashboard and coding-workspace/WorkspaceLayout retain their existing views and owners, with their mixed request/state orchestration extracted to hooks and explicit API clients for practice intake/workspace loading. Shared fetchCollection, waitForJob, HTTP cancellation, navigation and progress infrastructure remain shared for their real consumers. The standalone coding page and its SSR privacy boundary are unchanged.

Homepage app/page.js now composes features/home/components/HomePage. HeroWaves, home.module.css, HomeFooter and HomeStarfield belong to home. The previously unreferenced landing.module.css and page.module.css remain preserved as historical style assets under home/styles, without activating them or changing the rendered design. Existing asset URLs, animation definitions, branding, text and links remain unchanged. Existing shared global CSS is retained, including global focus/reduced-motion rules.

Catalog search/list requests now abort superseded work and guard late results, mapping/audit refreshes guard cleanup, and student workspace/history reads invalidate on selection changes, language changes or unmount. Existing course eligibility, timers, progress refresh and backend constraints remain authoritative. All request methods, paths, payloads and response/error handling remain compatible; no SQL, migration, dependencies or lockfile changes.

## Validation and pending acceptance

Run npm ci, npm run lint:critical, npm test and the production web build. Existing architecture/import, API/runtime, frontend privacy, navigation/progress, practical/report and sign-in tests remain in place. New remaining-views-api tests verify request methods, endpoint construction, body/signal forwarding and unmodified error responses. Focused feature lint includes no-undef without disabling correctness rules.

Real browser course/department CRUD constraints, mapping authorization, audit/dashboard access, student selection/preview/navigation, timer/progress updates, delayed responses, both themes and responsive rendering remain pending on this revision. The existing role/PDF/faculty/full-stack suites are retained. Docker is unavailable and local Chromium cannot open its required socket. Per explicit owner direction, do not enable ci:full-stack or ci:auth-performance; optional skipped checks are not certification. Rollback is an application revert only.
