# Public search and sharing

`npm run build` now renders the landing page, Privacy, Terms, Community and Contact into their own HTML files. Crawlers can read those pages before JavaScript runs. The existing client application still starts normally and restores accounts through the authenticated API; the renderer uses only anonymous public components and never requests account or game data.

Each public page has its own title, description and canonical URL on `https://hakoware.xyz`. Metadata follows navigation. The homepage includes application, website and organization structured data with no invented reviews, pricing or ratings. A 1200×630 PNG uses Hakoware's real branding and an explicitly labelled example Duo for Open Graph and large Twitter previews.

The build generates `/sitemap.xml` from the public-page list. `/robots.txt` points to it. Vercel serves the distinct public HTML before the SPA fallback, redirects the `www` host to the canonical host, and sends `X-Robots-Tag: noindex, nofollow` for friend spaces, Founder, password resets and account/checkout query links. Client metadata also excludes signed-in homepage views, sensitive queries and unknown routes. Robots allows crawling those URLs so crawlers can observe the exclusion headers; authentication remains the privacy boundary.

## Search Console

After deployment, create a Domain property for `hakoware.xyz` in [Google Search Console](https://search.google.com/search-console). Copy Google's exact TXT record into the domain's DNS dashboard and verify ownership there. Submit `https://hakoware.xyz/sitemap.xml`, then use URL Inspection on the homepage and public support pages. Domain verification and submission require the domain owner's account and DNS access. They have not been performed here.

Use Search Console impressions, indexed pages and relevant search queries to judge results. A valid sitemap and structured data do not guarantee indexing, rankings or rich results.

## Verification

- Production client and public-render builds pass. ESLint reports zero errors under the existing warning configuration.
- Five SEO checks cover populated public HTML, per-page canonical metadata, sitemap scope, deployment routing/exclusion rules and share-image dimensions. CI runs these after building.
- All 17 existing frontend checks pass.
- Chromium reads all five pages with JavaScript disabled and exercises the built client at 320 and 1280 pixels: signup/back, legal navigation, metadata updates, checkout-link exclusion, signed-in exclusion and CSP compatibility. A local server simulates the configured deployment headers. Fixtures create no accounts or payment records.

The live deployment, Google ownership verification, sitemap submission and actual search indexing have not been verified in this workspace.
