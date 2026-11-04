# Frontend authentication and profile ownership (#73)

The baseline is latest master 2171ad1. This change keeps backend authority and all HTTP endpoints in API. No dependencies, database assets, socket transport or URLs change.

| Previous owner | Feature owner | Consumers |
| --- | --- | --- |
| login route; ui/sign-in.tsx; lib/sign-in-request | auth components Login/SignIn and hooks/useLogin; api/sign-in-request | /login; auth resilience tests |
| signup route | auth/components/AccountAccess | /signup |
| hooks/useAdminAuth and useFacultyAuth | auth/hooks with shared useRoleSession and api/role-session | Admin pages, faculty pages, practical editor |
| hooks/useAccountIdentity | auth/hooks/useAccountIdentity | Admin/faculty sidebars |
| components/ChangePasswordModal | auth/components/ChangePasswordModal | Sidebars, student practicals, administrator profile overview |
| lib/auth-client | auth/api/auth-client | Shared fetchApi, login, other session consumers |
| admin profile route | profile/components/AdminProfile and hooks/useAdminProfile | /admin/profile |
| admin settings route | auth/components/AccountSettings and hooks/useAccountSettings | /admin/settings |
| username profile route, AdminProfileOverview and stylesheet | profile/components and hooks/useUsernameProfile, api/profile-api | /profile/[username] |

Role guards perform no profile requests and share one storage/role decision; server APIs remain authoritative. Admin keeps `/` as its redirect; faculty keeps `/login` and administrator access. The shared guard also reacts to storage/account events so rotated bearer tokens reach consumers. Identity refresh preserves outage handling and stale-token checks. Sign-in keeps bounded response/body deadlines and aborts on unmount, and now checks cancellation before storing a completed response. Session helper writes dispatch the existing account event. Browser socket auth and useSocket remain shared for unrelated feature consumers.

Username reads remain `/api/profile/[username]`; self reads/edits remain `/api/auth/profile`. Password endpoints, confirmation, validation and API error wording remain unchanged. Username changes remount the view to prevent old identity display; existing progress listeners and polling remain. Admin loads abort on unmount/bearer changes; username ownership responses check bearer stability after body consumption. No compatibility files remain at retired component/hook/helper paths.

Validation: clean npm ci, critical lint, full unit lane, production web build, focused role/storage and profile endpoint/abort tests plus existing sign-in resilience tests. Full-stack, outage/session-revocation/browser and auth-performance certification remain pending under the explicit owner instruction stopping expensive CI; do not enable opt-in labels without a fresh owner request.
