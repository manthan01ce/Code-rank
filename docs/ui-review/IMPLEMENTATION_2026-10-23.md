# UI and CI changes — 23 October 2026

Baseline: master 681077a53cd142cb33e2512d0a886340643ac23f, pulled with fast-forward. Prior workspace preserved in a stash.

## CI failure

Architecture run 39909948916 passed unit, integration, Docker, production build and execution round trip, then hit the 5-minute Chromium installation deadline. Provisioning now separates OS dependencies from browser download. Each has at most two attempts with 180-second subprocess limits; failure still exits nonzero. The enclosing step permits 13 minutes. No product test or readiness gate is disabled.

## Implemented

- TypeScript and Tailwind v4 configuration, semantic color aliases mapped to the existing tokens, without Tailwind preflight or a replacement palette/font. `src/components/ui` matches the existing `@/` alias; it is the shadcn CLI/import destination, not a new root `/components` directory.
- shadcn CLI initialization attempted; ui.shadcn.com was blocked by the network proxy. Added components.json and utils manually. React Bits registry entries reference REACTBITS_LICENSE_KEY; no credential is checked in. Registry endpoints remain unverified until a licensed install succeeds.
- Homepage heading RANK UP CODING with typing, underscore cursor and reduced-motion handling. Original two-row footer with real public links and no email input/link. Original lightweight starfield fallback, static on mobile/reduced motion.
- Provided sign-in structure adapted to the existing theme, labels, validation, real bounded signInRequest, session storage and role redirects. Password toggle has an accessible name. No credential logging or fake providers. Coding image uses Unsplash. No fabricated testimonials.
- Admin-only responsive sidebar preserves Dashboard, Department Master, Faculty Master, Student Master, Courses, Course Mapping, Activity Logs, Settings, Profile, Change Password and Logout. Real user name/initial; original client role check and server authorization retained. Desktop expands on hover/focus. Mobile menu supports Escape, focus return and keyboard focus containment.
- Existing JS routes retained; architecture parsing/import checks extended to TS/TSX rather than bypassed.
- Added browser assertions and review screenshots for public pages at 360/768/1280px, plus mobile admin destinations and keyboard dismissal.

## Outstanding requirements

Exact React Bits Pro Footer 6 and Glitter Warp cannot be installed without the license key or supplied licensed source. Fallbacks are explicitly labeled in their source and are not represented as those components. Once REACTBITS_LICENSE_KEY is supplied privately, run the requested shadcn add commands from apps/web and re-run review.

There is no existing Google login, unauthenticated password reset or public sign-up API. Signup currently explains institutional account creation and links to real sign-in. It does not collect passwords or claim accounts were created. A functioning public name/email/password registration flow remains outstanding because the supplied requirement to preserve existing auth conflicts with introducing public registration into an admin-provisioned app. Existing authenticated Change Password remains available. No remember-me checkbox is shown because the backend has no corresponding lifetime option.

## Local verification

TypeScript and critical lint pass. Architecture parsing/import tests pass. Local production build still fails at ENOENT uv_resident_set_memory. A development server startup reached “Server ready,” but a separate loopback probe could not connect from this restricted execution environment. A usable local review server is therefore not established; no visual sign-off is claimed. CI on the normal host must verify the production build, role workflows and screenshots.

## Verified browser results

Commit 98420ee passed Architecture checks (39921983200) and Authentication performance comparison (39921983192). This includes real role flows, mobile menu navigation, public page overflow checks at 360/768/1280px, capacity and recovery. CI produced ten screenshots. Review found and fixed portal tab wrapping, tablet navigation width and dashboard table overflow. Sign-in uses the real coding photograph, and public/admin layouts retain the existing palette. Screenshots now disable transient CSS animations to capture their final state.

A fresh isolated local profiler successfully reached its own dev server and performed HTTP checks. Rendering still fails with uv_resident_set_memory and local readiness remains degraded; HTTP 200 HTML with embedded error markers is not usable rendering. Diagnostic processes were cleaned up. This updates the earlier separate-loopback connection failure; neither result establishes a working local review environment.
