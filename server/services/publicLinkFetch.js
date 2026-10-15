const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns/promises');
const net = require('node:net');
const zlib = require('node:zlib');
const ipaddr = require('ipaddr.js');

const fail = code => { throw Object.assign(new Error('Link preview unavailable'), { code }); };
const publicAddress = address => {
  try { return address !== '168.63.129.16' && ipaddr.process(address).range() === 'unicast'; }
  catch { return false; }
};
const publicURL = value => {
  let url; try { url = new URL(value); } catch { fail('LINK_URL'); }
  if (value.length > 2048 || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) fail('LINK_URL');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host.endsWith('.') || !host.includes('.') && !net.isIP(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|onion|arpa)$/.test(host)) fail('LINK_HOST');
  if (net.isIP(host) && !publicAddress(host)) fail('LINK_ADDRESS');
  for (const key of url.searchParams.keys()) if (/^(?:token|access_token|auth|authorization|api_key|apikey|key|secret|password|signature|sig|code|invite|join|cosmetic_order|checkout|x-amz-.+|x-goog-.+)$/i.test(key)) fail('LINK_PRIVATE');
  if (/(?:^|\/)(?:logout|signout|unsubscribe|reset-password|verify-email)(?:\/|$)/i.test(url.pathname)) fail('LINK_PRIVATE');
  if (/(?:^|\.)hakoware\.xyz$/.test(host) && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/circle/') || url.searchParams.has('view'))) fail('LINK_PRIVATE');
  url.hash = ''; return url;
};

// The validated DNS answer is pinned to this connection. Redirects get a new
// validation and lookup; request libraries never resolve the host a second time.
const createPublicLinkFetcher = ({ lookup = dns.lookup, request = (url, options, callback) => (url.protocol === 'https:' ? https : http).request(url, options, callback) } = {}) => async (value, { image = false } = {}) => {
  const deadline = Date.now() + 6500;
  let url = publicURL(value);
  for (let hop = 0; hop < 4; hop += 1) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let timer;
    const answers = await Promise.race([
      net.isIP(host) ? Promise.resolve([{ address: host, family: net.isIP(host) }]) : lookup(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Link lookup timed out'), { code: 'LINK_TIMEOUT' })), Math.max(1, deadline - Date.now())); }),
    ]).finally(() => clearTimeout(timer));
    if (!answers.length || answers.some(answer => !publicAddress(answer.address))) fail('LINK_ADDRESS');
    const answer = answers.find(item => item.family === 4) || answers[0];
    const response = await new Promise((resolve, reject) => {
      let settled = false, bodyStream, absoluteTimer, req;
      const finish = (error, result) => {
        if (settled) return; settled = true; clearTimeout(absoluteTimer);
        bodyStream?.destroy(); req?.destroy(); error ? reject(error) : resolve(result);
      };
      req = request(url, {
        method: 'GET', agent: false, autoSelectFamily: false, maxHeaderSize: 16384,
        lookup: (_host, options, callback) => options?.all ? callback(null, [answer]) : callback(null, answer.address, answer.family),
        headers: { 'User-Agent': 'HakowareLinkPreview/1.0 (+https://hakoware.xyz)', Accept: image ? 'image/jpeg,image/png,image/webp' : 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) { finish(null, { redirect: res.headers.location }); return; }
        const contentType = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (res.statusCode !== 200 || !(image ? ['image/jpeg', 'image/png', 'image/webp'].includes(contentType) : ['text/html', 'application/xhtml+xml'].includes(contentType))) { finish(Object.assign(new Error('Unsupported preview response'), { code: 'LINK_CONTENT' })); return; }
        const limit = 512 * 1024, parts = []; let bytes = 0, wireBytes = 0;
        if (image && Number(res.headers['content-length']) > limit) { finish(Object.assign(new Error('Preview image too large'), { code: 'LINK_SIZE' })); return; }
        res.on('data', chunk => { wireBytes += chunk.length; if (wireBytes > 1024 * 1024) finish(Object.assign(new Error('Preview response too large'), { code: 'LINK_SIZE' })); });
        const encoding = String(res.headers['content-encoding'] || 'identity').toLowerCase();
        bodyStream = encoding === 'identity' ? res : encoding === 'gzip' ? res.pipe(zlib.createGunzip()) : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress()) : encoding === 'deflate' ? res.pipe(zlib.createInflate()) : null;
        if (!bodyStream) { finish(Object.assign(new Error('Unsupported preview encoding'), { code: 'LINK_CONTENT' })); return; }
        const result = () => ({ body: Buffer.concat(parts), contentType, url: url.href });
        bodyStream.on('data', chunk => {
          if (settled) return;
          if (bytes + chunk.length > limit) {
            if (image) finish(Object.assign(new Error('Preview image too large'), { code: 'LINK_SIZE' }));
            else { parts.push(chunk.subarray(0, limit - bytes)); finish(null, result()); }
            return;
          }
          bytes += chunk.length; parts.push(chunk);
        });
        bodyStream.on('end', () => finish(null, result()));
        bodyStream.on('error', error => finish(error)); res.on('error', error => finish(error));
      });
      req.on('error', error => finish(error));
      absoluteTimer = setTimeout(() => finish(Object.assign(new Error('Link request timed out'), { code: 'LINK_TIMEOUT' })), Math.max(1, deadline - Date.now()));
      req.end();
    });
    if (!Object.hasOwn(response, 'redirect')) return response;
    if (!response.redirect || hop === 3) fail('LINK_REDIRECT');
    const next = publicURL(new URL(response.redirect, url).href);
    if (url.protocol === 'https:' && next.protocol !== 'https:') fail('LINK_REDIRECT');
    url = next;
  }
  fail('LINK_REDIRECT');
};
module.exports = { publicAddress, publicURL, createPublicLinkFetcher };
