# User-management frontend ownership (#72)

Baseline: remote master a4e788314aad85adb2bb0cc9897eba2ca6d53e88. Mandatory checkout/pull succeeded on a clean working tree before creating refactor/batch4-users-ui. No other task branch was reused.

| Before | Owner after extraction | Consumers |
| --- | --- | --- |
| admin/faculty/page.js request/state workflows | users/hooks/useFacultyManagement | FacultyManagement view |
| admin/students/page.js request/state workflows | users/hooks/useStudentManagement | StudentManagement view |
| Inline role-specific add/edit dialogs | users/components/FacultyFormDialog and StudentFormDialog | Respective management views |
| Duplicated CRUD/upload HTTP operations | users/api/users-api | Both workflow hooks |
| Repeated list request lifecycle | users/hooks/useUserListLifecycle | Both hooks; independent request versions/controllers |
| lib/pdfGenerator compatibility export | Removed; users/credential-pdf remains authoritative | Both workflow hooks; PDF tests |

Next route files compose the role-specific feature views. Existing data-table primitives, columns, filters, cursor handling, search debounce, selections, row updates, loading/error messages, role fields and responsiveness are retained. Student/faculty upload role metadata, multipart file contents, CSV/Excel handling, create/update/skipped/error summaries and generated credentials remain unchanged. Database validation, authorization and session revocation remain in API. No self-account/password workflows are moved into users.

The shared list lifecycle aborts active requests and increments their version at unmount, preventing late results even if transport ignores abort. Existing superseded-search cancellation and socket listener cleanup remain. Collection and faculty-option helpers stay shared for their catalog/mapping consumers. No new socket/poller is added. The PDF implementation remains browser-only and unique; the compatibility export was removed after updating its only remaining consumer (the facade-specific test).

Validation lanes: clean npm ci; critical lint; full unit suite; production web build; feature lint with no-undef. New user-client tests cover CRUD paths/methods, cursor forwarding, multipart files/roles and unchanged API errors; cleanup tests deliver a late response after cancellation. Credential tests retain their existing document assertions and also read the actual saved PDF files (magic bytes and expected titles) from a uniquely created test directory, removing only that test-owned directory.

Real admin browser CRUD, duplicate/invalid input behavior, deactivation/login denial, filtering/paging, CSV/Excel boundary cases, real browser PDF download, both themes and browser unmount races remain pending on this revision. Existing API/password/session/browser tests and assertions remain in their lanes. Full-stack and authentication-performance CI stay stopped per explicit owner direction; no opt-in labels are requested. Local Docker/browser limitations are not passing acceptance evidence. No backend, database, dependency, lockfile or deployment changes.
