const crypto = require('crypto');

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function encodeKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function getConfig() {
  const config = {
    bucket: process.env.BUCKET,
    endpoint: process.env.ENDPOINT,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION || 'auto',
    urlStyle: process.env.BUCKET_URL_STYLE || 'virtual'
  };

  const missing = Object.entries(config)
    .filter(([key, value]) => key !== 'urlStyle' && !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Railway bucket configuration missing: ${missing.join(', ')}`);
  }

  return config;
}

function buildObjectUrl(key, config) {
  const endpoint = new URL(config.endpoint);
  const encodedKey = encodeKey(key);

  if (config.urlStyle === 'path') {
    return new URL(`${endpoint.origin}/${encodeURIComponent(config.bucket)}/${encodedKey}`);
  }

  return new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodedKey}`);
}

function signRequest(method, url, payload, config) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(payload || Buffer.alloc(0));
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n');

  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    Authorization: `${ALGORITHM} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
}

async function putObject(key, buffer, contentType = 'application/octet-stream') {
  const config = getConfig();
  const url = buildObjectUrl(key, config);
  const headers = signRequest('PUT', url, buffer, config);
  headers['content-type'] = contentType;

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: buffer
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Bucket upload failed (${response.status}): ${details.slice(0, 240)}`);
  }
}

async function getObject(key) {
  const config = getConfig();
  const url = buildObjectUrl(key, config);
  const headers = signRequest('GET', url, Buffer.alloc(0), config);
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Bucket read failed (${response.status}): ${details.slice(0, 240)}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

function assertBucketConfig() {
  getConfig();
}

module.exports = {
  assertBucketConfig,
  getObject,
  putObject
};
