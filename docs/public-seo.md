# Public search and sharing

`npm run build` now renders the landing page, Privacy, Terms, Community and Contact into their own HTML files. Crawlers can read those pages before JavaScript runs. The existing client application still starts normally and restores accounts through the authenticated API; the renderer uses only anonymous public components and never requests account or game data.

Each public page has its own title, description and canonical URL on `https://hakoware.xyz`. Metadata follows navigation. The homepage includes application, website and organization structured data with no invented reviews, pricing or ratings. A 1200×630 PNG uses Hakoware's real branding and an explicitly labelled example Duo for Open Graph and large Twitter previews.

The build generates `/sitemap.xml` from the public-page list. `/robots.txt` points to it. Vercel serves the distinct public HTML before the SPA fallback, redirects the `www` host to the canonical host, and sends `X-Robots-Tag: noindex, nofollow` for friend spaces, Founder, password resets and account/checkout query links. Client metadata also excludes signed-in homepage views, sensitive queries and unknown routes. Robots allows crawling those URLs so crawlers can observe the exclusion headers; authentication remains the privacy boundary.

## Search Console

The user confirmed on October 14, 2026 that Search Console has not been configured. This does not prove why Google has not indexed or ranked the site: Google can discover a site without Search Console. Verification gives the owner the actual crawl/indexing diagnosis and the ability to request a crawl.

After deploying the build:

1. Open [Google Search Console](https://search.google.com/search-console), add a **Domain** property, and enter `hakoware.xyz` without `https://` or a path.
2. Copy Google's exact verification TXT value into the domain's authoritative DNS dashboard as a root/apex TXT record (often host `@` or blank, depending on the DNS provider). Add it alongside existing records, then return to Search Console and verify once it is visible. Domain verification does not require API keys or merchant credentials.
3. In **Sitemaps**, submit `https://hakoware.xyz/sitemap.xml`. The build lists the homepage and four public legal/support pages only.
4. Use **URL Inspection** for `https://hakoware.xyz/`, choose **Test live URL**, and request indexing if Google can access the public page. Check the reported indexing status rather than assuming a successful request means the page is already indexed.

If the live test fails, inspect its reported HTTP status, robots/canonical result and rendered page. A deployment-wide `X-Robots-Tag: noindex`, password protection, an inaccessible sitemap or the wrong production build can prevent discovery/indexing even when the repository checks pass. A signed-in app view or a URL with `?view=...` is deliberately excluded: inspect the plain public homepage instead. Domain verification and submission require the domain owner's Google account and DNS access. They have not been performed here.

Use Search Console impressions, indexed pages and relevant search queries to judge results. A valid sitemap and structured data do not guarantee indexing, rankings or rich results.

## Verification

- Production client and public-render builds pass. ESLint reports zero errors under the existing warning configuration.
- Five SEO checks cover populated public HTML, per-page canonical metadata, sitemap scope, deployment routing/exclusion rules and share-image dimensions. CI runs these after building.
- All 17 existing frontend checks pass.
- Chromium reads all five pages with JavaScript disabled and exercises the built client at 320 and 1280 pixels: signup/back, legal navigation, metadata updates, checkout-link exclusion, signed-in exclusion and CSP compatibility. A local server simulates the configured deployment headers. Fixtures create no accounts or payment records.

The October 14 icon update rebuilt successfully and all five SEO checks passed. Lint has zero errors; the existing JSX-import configuration also flags the used shopping-bag icon, bringing warnings to 416. No source-level public-page indexing blocker was found in the checked build.

The live deployment, Google ownership verification, sitemap submission and actual search indexing have not been verified in this workspace. Its restricted egress policy does not currently allow the public Hakoware hosts. The cloud draft preserves existing destinations and now includes the canonical/www site, the Railway API host and official Google documentation hosts. Saving that draft does not apply it; publish it through environment settings before retrying live-site checks. Domain ownership and Search Console operations still require the owner's Google account and DNS dashboard.
