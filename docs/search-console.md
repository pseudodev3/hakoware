# Search Console and public indexing

The canonical site is `https://hakoware.xyz` and its sitemap is **https://hakoware.xyz/sitemap.xml**. The robots file advertises that same address. The sitemap contains only the five public pages; account, payment, invitation and game URLs remain excluded.

Vercel is explicitly configured to run `npm run build` and publish `dist`. That command builds the app, prerenders the public pages and emits the sitemap. It should not be replaced with plain `vite build`, which omits the prerender/sitemap step.

On 15 October 2026, public requests using a Googlebot user agent received HTTP 200 and parseable XML at the sitemap URL. Its five page URLs also returned HTTP 200, prerendered headings, correct self-canonical URLs and no noindex response header. Robots was readable and allowed those URLs. This verifies public delivery; it does not reveal the result or timing of Google's own fetch.

If Search Console says “Couldn't fetch”, check that the submitted URL matches the canonical address above, then resubmit it and inspect its next fetch result. For a URL-prefix property whose form already supplies `https://hakoware.xyz/`, enter `sitemap.xml` in the remaining field. A Domain property's full-URL field takes the complete sitemap URL. If it fails again, the exact submitted address and latest fetch detail are needed to distinguish a hostname/property mismatch from a Google-side fetch failure.

Page titles and Open Graph/Twitter titles no longer use pipe separators. The homepage title is “Hakoware, a friendship game for staying in touch”. Google may retain an earlier title until recrawling or choose its own search-result title.

Validation: production build, all five existing SEO checks and live delivery of the sitemap, robots file and every sitemap entry passed. No Search Console submission was made from this environment.
