# Web Shared Ownership & Client Infrastructure

**Migration Matrix Row:** `shared-client-styles`  
**Branch:** `refactor/batch5-web-shared-ownership`  
**Target:** Clean separation of browser infrastructure, environment-independent utilities, feature-scoped hooks, and CSS token ownership.

---

## 1. Classification & Move Summary

| Original Path | Destination | Classification | Justification & Consumers |
|---|---|---|---|
| `apps/web/src/lib/api-utils.js` | `apps/web/src/lib/client/api-utils.js` | Browser Client Infrastructure | Attaches client bearer auth token to `fetch()`; consumed by client components/hooks. |
| `apps/web/src/lib/browser-socket-auth.js` | `apps/web/src/lib/client/browser-socket-auth.js` | Browser Client Infrastructure | Reads auth token from browser `localStorage` on connection/reconnection attempts. |
| `apps/web/src/lib/fetch-collection.js` | `apps/web/src/lib/client/fetch-collection.js` | Browser Client Infrastructure | Handles paginated cursor fetching with 401 redirect semantics; consumed by 8+ feature modules. |
| `apps/web/src/lib/fetch-user-options.js` | `apps/web/src/lib/client/fetch-user-options.js` | Browser Client Infrastructure | Bounded paginated dropdown loader for faculty and user selection. |
| `apps/web/src/lib/http-client.js` | `apps/web/src/lib/client/http-client.js` | Browser Client Infrastructure | Provides `requestPage` and `createRequestScope` (cancellable AbortController request scopes). |
| `apps/web/src/lib/job-lifecycle.js` | `apps/web/src/lib/client/job-lifecycle.js` | Browser Client Infrastructure | Bounded HTTP polling and error mapping for async worker jobs. |
| `apps/web/src/lib/progress-updates.js` | `apps/web/src/lib/client/progress-updates.js` | Browser Client Infrastructure | Dispatches browser DOM `Event` and cross-tab `localStorage` sync notifications. |
| `apps/web/src/lib/wait-for-job.js` | `apps/web/src/lib/client/wait-for-job.js` | Browser Client Infrastructure | Socket-accelerated job completion watcher with bounded polling fallback. |
| `apps/web/src/lib/cache.js` | `apps/web/src/lib/shared/cache.js` | Pure Environment-Independent Utility | In-memory key-value cache with finite TTL; zero browser DOM dependencies. |
| `apps/web/src/lib/practical-navigation.js` | `apps/web/src/lib/shared/practical-navigation.js` | Pure Environment-Independent Utility | Deterministic URL builder and schedule timing checks; pure logic. |
| `apps/web/src/lib/student-theme.js` | `apps/web/src/lib/shared/student-theme.js` | Pure Environment-Independent Utility | Storage-independent theme preference reads and writes with dark default. |
| `apps/web/src/lib/utils.ts` | `apps/web/src/lib/utils.ts` | Generic UI Helper (Retained) | Standard shadcn Tailwind class merger (`cn()`); retained at conventional path `@/lib/utils`. |
| `apps/web/src/hooks/useExecutionLifecycle.js` | `apps/web/src/features/coding-workspace/hooks/useExecutionLifecycle.js` | Feature-Specific Hook | Only consumed by `WorkspaceLayout` and `useCodingWorkspace`; relocated to feature owner. |
| `apps/web/src/hooks/useSocket.js` | `apps/web/src/hooks/useSocket.js` | Shared Realtime Hook (Retained) | Consumed across 8+ feature modules (faculty, student, admin, workspace). |
| `apps/web/src/hooks/usePolling.js` | `apps/web/src/hooks/usePolling.js` | Shared Utility Hook (Retained) | Tab-visibility-aware interval polling consumed across all role dashboards and views. |
| `apps/web/src/hooks/useProgressRefresh.js` | `apps/web/src/hooks/useProgressRefresh.js` | Shared Event Hook (Retained) | Multi-tab progress synchronization hook consumed by practicals and user profiles. |

---

## 2. Justified Retention Decisions for Styles

1. **`apps/web/src/app/globals.css` (Retained in `apps/web/src/app/globals.css`):**
   - **Requirement:** Next.js App Router root layout (`apps/web/src/app/layout.js`) requires importing the root global stylesheet.
   - **Content:** Contains Tailwind CSS v4 `@theme inline` declarations, CSS reset, body font-family, and root CSS variables (`--primary`, `--bg-color`, `--card-bg`, etc.).
   - **Decision:** Kept in `app/globals.css` per framework standard. Does not contain role-specific or domain-specific styles.

2. **`apps/web/src/app/student/student-theme.css` (Retained in `apps/web/src/app/student/student-theme.css`):**
   - **Scope:** Defines CSS custom properties scoped strictly to `.student-theme[data-student-theme="dark|light"]` used inside the student workspace and code editor.
   - **Consumer:** Imported exclusively by `apps/web/src/app/student/layout.js`.
   - **Decision:** Retained under `app/student/` as a feature-scoped theme sheet. Moving it to a generic global `styles/` folder would violate feature isolation and pollute the global style graph.

3. **Role-Specific Styles (`admin.css`, `faculty.css`):**
   - Retained under their respective feature layouts (`apps/web/src/app/admin/admin.css`, `apps/web/src/app/faculty/faculty.css`).

4. **Empty Directories:**
   - No unused `lib/server` or arbitrary empty `styles/` folders were created.

---

## 3. Verification & Evidence

- **Lint:** `npm run lint:critical` passes with 0 warnings.
- **Production Build:** `npm run build --workspace=apps/web` succeeded using Turbopack with 20/20 static and dynamic routes compiled.
- **Architecture Validation:** `node --test tests/architecture/architecture.test.mjs` passes 13/13 tests, confirming local import resolution and package boundary enforcement.
- **Focused Unit Suites:**
  - `tests/unit/browser-socket-auth.test.mjs` (pass)
  - `tests/unit/student-theme.test.mjs` (pass)
  - `tests/unit/progress-updates.test.mjs` (pass)
  - `tests/unit/fetch-collection.test.mjs` (pass)
  - `tests/unit/job-wait.test.mjs` (pass)
  - `tests/unit/job-lifecycle.test.js` (pass)
  - `tests/unit/practical-navigation.test.mjs` (pass)
  - `tests/unit/faculty-review-fixtures.test.mjs` (pass)
  - `tests/unit/faculty-review-requests.test.mjs` (pass)
  - Total: 30/30 tests passing.
