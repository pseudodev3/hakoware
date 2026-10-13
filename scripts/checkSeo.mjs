import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PUBLIC_PAGES, SITE_URL, SHARE_IMAGE, metadataForLocation } from '../src/lib/siteSeo.js';

test('Public pages have crawlable content and their own canonical metadata before JavaScript', async () => {
  for (const [path, page] of Object.entries(PUBLIC_PAGES)) {
    const html = await readFile(path === '/' ? 'dist/index.html' : `dist${path}/index.html`, 'utf8');
    assert.ok(html.includes(`<title>${page.title}</title>`));
    assert.ok(html.includes(`rel="canonical" href="${SITE_URL}${path}"`));
    assert.ok(html.includes('name="robots" content="index, follow, max-image-preview:large"'));
    assert.match(html, /<div id="root"><[a-z]/);
    assert.match(html, /<h1/);
    assert.ok(html.includes(page.description));
    assert.ok(html.includes(SHARE_IMAGE));
    assert.ok(html.includes('summary_large_image'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.deepEqual(schema['@graph'].map(entity => entity['@type']), ['Organization', 'WebSite', 'WebApplication']);
    assert.equal(schema['@graph'].some(entity => entity.aggregateRating || entity.offers), false);
    assert.equal(html.includes('hakoware_founder_token'), false);
    assert.equal(html.includes('STRIPE_SECRET_KEY'), false);
  }
  const landing = await readFile('dist/index.html', 'utf8');
  assert.equal((landing.match(/<details>/g) || []).length, 4);
  for (const path of ['/privacy', '/terms', '/community', '/contact']) assert.ok(landing.includes(`href="${path}"`));
});

test('Sitemap lists public pages only and robots permits crawlers to see noindex responses', async () => {
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, Object.keys(PUBLIC_PAGES).map(path => SITE_URL + path));
  assert.equal(urls.some(url => url.includes('?') || url.includes('/circle') || url.includes('checkout')), false);
  const robots = await readFile('dist/robots.txt', 'utf8');
  assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
  assert.equal(robots.includes('Disallow: /circle'), false);
});

test('Private routes, account state and sensitive query links are excluded without leaking tokens', () => {
  for (const pathname of ['/circle/private-contract', '/founder', '/reset-password/private-token', '/missing-page']) {
    const page = metadataForLocation({ pathname });
    assert.equal(page.robots, 'noindex, nofollow');
    assert.equal(page.canonical, SITE_URL + '/');
    assert.equal(page.title.includes('private'), false);
  }
  for (const search of ['?view=you', '?join=1', '?cosmetic_order=private-order&checkout=success', '?token=private-token', '?utm_source=share&view=sparks']) {
    assert.equal(metadataForLocation({ pathname: '/', search }).public, false);
  }
  assert.equal(metadataForLocation({ pathname: '/', search: '?utm_source=share' }).public, true);
  assert.equal(metadataForLocation({ pathname: '/' }, true).public, false);
  assert.equal(metadataForLocation({ pathname: '/privacy/' }, true).canonical, SITE_URL + '/privacy');
  assert.equal(metadataForLocation({ pathname: '/privacy' }, true).public, true);
});

test('Deployment serves the individual public HTML and sends noindex for account and payment URLs', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  for (const path of Object.keys(PUBLIC_PAGES).filter(path => path !== '/')) assert.ok(config.rewrites.some(rule => rule.source === path && rule.destination === path + '/index.html'));
  assert.equal(config.rewrites.at(-1).destination, '/index.html');
  for (const source of ['/circle/:path*', '/founder/:path*', '/reset-password/:path*']) assert.ok(config.headers.some(rule => rule.source === source && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));
  for (const key of ['view', 'join', 'cosmetic_order', 'checkout']) assert.ok(config.headers.some(rule => rule.source === '/' && rule.has?.some(condition => condition.type === 'query' && condition.key === key)));
  assert.ok(config.redirects.some(rule => rule.has?.some(condition => condition.type === 'host' && condition.value === 'www.hakoware.xyz') && rule.destination.startsWith(SITE_URL)));
});

test('The large share image is included in the build at its declared dimensions', async () => {
  const png = await readFile('dist/hakoware-social.png');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
