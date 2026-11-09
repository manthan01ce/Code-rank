# Public-site rollout

The web app includes `/privacy`, `/terms` (usage guidelines), `/contact`, a global 404, route titles, robots rules, a public-only sitemap and an Open Graph image. Footer and authentication links expose support and policy information.

## Institutional information still required

Set `CODERANK_SUPPORT_EMAIL` and/or `CODERANK_SUPPORT_URL` to the institution-approved public contact. Until supplied, the contact page directs users to their assigned faculty or department administrator. No personal email is inferred from repository authors or login credentials.

The privacy page describes source-supported behavior; it is not a certification of legal compliance. Before student rollout, the institution must confirm its operator identity, contact, hosting providers, retention and backup schedule, applicable rights/request process and any additional institutional notice. The terms route provides practical usage guidelines, not invented contractual acceptance or penalties.

## Deployment settings

Set these in the **web build environment**, then rebuild/redeploy:

- `CODERANK_PUBLIC_URL`: the actual HTTP(S) origin, without a path, query, fragment or credentials.
- `CODERANK_ALLOW_INDEXING=true`: only for the public production site. Default is off. Vercel preview/development environments remain non-indexable even if this flag is set.
- `CODERANK_SUPPORT_EMAIL`: approved public helpdesk email (optional).
- `CODERANK_SUPPORT_URL`: approved HTTP(S) help page (optional).

Without an origin or opt-in, robots disallows crawling, page metadata uses noindex and the sitemap is empty. When enabled, only home, practice, privacy, usage guidelines and contact are listed. Private workspace, account and profile routes retain noindex. Robots directives are not access controls; API authorization remains responsible for protecting data.

## Release checks

1. Build with the intended web environment; check public page titles, canonical URLs and social-image URL.
2. Visit policy/support links from home, sign-in and account access. Confirm the real institutional contact works.
3. Visit an unknown URL and confirm a 404 response with navigation back to the site.
4. Check `/robots.txt`, `/sitemap.xml`, and `/opengraph-image`. Confirm no student/profile/assessment URLs appear in the sitemap.
5. Check mobile width, keyboard focus, page scrolling and contrast. Confirm authenticated dashboard behavior is unchanged.

No visitor analytics, consent banner, sticky mobile CTA or thank-you page was introduced. Reassess consent needs before adding tracking, using the institution's applicable requirements.
