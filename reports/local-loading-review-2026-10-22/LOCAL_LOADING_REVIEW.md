# Local loading review — 22 October 2026

Scope: this workspace, not the processes or browser on your Windows computer.

Initially nothing listened on port 3000. Startup failed opening the Next development persistence database: invalid digit found in string. Preserved the generated dev cache at apps/web/.next/dev-before-loading-review and retried with a fresh cache.

Fresh-cache startup succeeded, but rendering still fails with ENOENT uv_resident_set_memory on this restricted host. HTML status 200 can contain render-error markers. These are failed pages, not usable page-load measurements.

| Request | First total ms | Repeat total ms |
|---|---:|---:|
| / | 1128.95 | 37.04 |
| /login | 280.7 | 29.43 |
| /student | 332.9 | 36.75 |
| /admin | 1132.28 | 38.75 |
| /api/health | 1804.18 | 15.14 |
| /api/auth/login | 712.3 | 13.67 |

Timings include HTTP body transfer, not browser paint or interaction readiness. Initial requests include development compilation.

Local readiness: database unavailable/schema unknown, Redis unavailable, zero healthy workers. Connector access to Neon does not configure the local DATABASE_URL.

Student dashboard changes: practicals load alongside profile/courses; preserve successful sections; abort initial requests after 12 seconds and on navigation; show a visible retry message on failure. Previously requests ran sequentially, had no deadline, and failures were console-only. Production authentication and throttling are unchanged.

Validation: targeted lint has zero errors and four existing component warnings. Visual layout, contrast, mobile clipping and authenticated success timing remain unverified. A normal browser/Docker host with healthy dependencies is required to verify student, faculty, admin and editor at 360/390/768/1280px and 200% zoom.

The profiler cleaned up the web and worker processes it started. A healthy local server is not established.
