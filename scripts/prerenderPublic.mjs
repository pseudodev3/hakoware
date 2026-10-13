import console from 'node:console';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PUBLIC_PAGES, metadataForLocation, siteSchema, SITE_URL } from '../src/lib/siteSeo.js';

const { renderPublic } = await import(pathToFileURL(resolve('node_modules/.cache/hakoware-ssr/renderPublic.mjs')));
const base = await readFile('dist/index.html', 'utf8');
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const json = JSON.stringify(siteSchema()).replaceAll('<', '\\u003c');
for (const path of Object.keys(PUBLIC_PAGES)) {
  const page = metadataForLocation({ pathname: path });
  let html = base.replace(/<title>.*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/, `$1${page.canonical}$2`);
  const meta = { description: page.description, robots: page.robots, 'og:title': page.title, 'og:description': page.description, 'og:url': page.canonical, 'twitter:title': page.title, 'twitter:description': page.description };
  for (const [key, value] of Object.entries(meta)) html = html.replace(new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*("\\s*/?>)`), `$1${escape(value)}$2`);
  const content = renderPublic(path);
  if (!content.includes('<h1')) throw new Error(`Public rendering failed for ${path}`);
  html = html.replace('<div id="root"></div>', `<div id="root">${content}</div>`)
    .replace('</head>', `<script type="application/ld+json">${json}</script>\n  </head>`);
  const dir = path === '/' ? 'dist' : 'dist' + path;
  await mkdir(dir, { recursive: true });
  await writeFile(dir + '/index.html', html);
}
const urls = Object.keys(PUBLIC_PAGES).map(path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join('\n');
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
console.log(`Rendered ${Object.keys(PUBLIC_PAGES).length} public pages and sitemap without private data or API requests.`);
