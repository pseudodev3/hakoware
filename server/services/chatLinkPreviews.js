const { createHash } = require('node:crypto');
const { Parser } = require('htmlparser2');
const { imageSize } = require('image-size');
const Event = require('../models/ContractEvent');
const Message = require('../models/SocialMessage');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const people = require('./people');
const { publicURL, createPublicLinkFetcher } = require('./publicLinkFetch');

const id = value => String(value?._id || value || '');
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const unavailable = Object.freeze({ status: 'UNAVAILABLE' });
const firstLink = text => {
  const match = /\b(?:https?:\/\/|www\.)[^\s<>"\u0000-\u001f]+/i.exec(text);
  if (!match) return null;
  let value = match[0].replace(/[.,!?:;]+$/, '');
  while (/[)\]}]$/.test(value)) {
    const last = value.at(-1), open = { ')': '(', ']': '[', '}': '{' }[last];
    if (value.split(last).length <= value.split(open).length) break;
    value = value.slice(0, -1);
  }
  try { return publicURL(/^www\./i.test(value) ? `https://${value}` : value).href; } catch { return null; }
};
const parsePage = (body, pageURL) => {
  const meta = new Map(); let inTitle = false, title = '', done = false;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (done) return;
      if (name === 'body') { done = true; return; }
      if (name === 'title') inTitle = true;
      if (name === 'meta' && meta.size < 64) {
        const key = String(attributes.property || attributes.name || '').toLowerCase();
        if (!meta.has(key)) meta.set(key, attributes.content || '');
      }
    },
    ontext(text) { if (inTitle && !done && title.length < 1024) title += text; },
    onclosetag(name) { if (name === 'title') inTitle = false; if (name === 'head') done = true; },
  }, { decodeEntities: true });
  parser.end(body.toString('utf8'));
  const image = meta.get('og:image:secure_url') || meta.get('og:image') || meta.get('twitter:image') || '';
  let imageURL = null; try { if (image) imageURL = publicURL(new URL(image, pageURL).href).href; } catch { /* Keep a text preview. */ }
  return { title: clean(meta.get('og:title') || meta.get('twitter:title') || title, 180), description: clean(meta.get('og:description') || meta.get('twitter:description') || meta.get('description'), 280), imageURL };
};

const authorize = async (userId, body) => {
  if (!['duo', 'connection'].includes(body?.kind) || typeof body.messageId !== 'string' || !/^[a-f0-9]{24}$/i.test(body.messageId)) fail(404, 'Message unavailable.');
  if (body.kind === 'connection') {
    const message = await Message.findById(body.messageId).lean();
    if (!message) fail(404, 'Message unavailable.');
    const { connection } = await people.visibleRelation(userId, id(message.connectionId));
    if (connection.status !== 'CONNECTED') fail(404, 'Message unavailable.');
    return message.text;
  }
  const event = await Event.findOne({ _id: body.messageId, type: { $in: ['MESSAGE', 'CHECKIN_REPLY'] }, $or: [{ type: 'CHECKIN_REPLY' }, { userId }, { 'metadata.notified': true }] }).lean();
  if (!event || event.metadata?.kind === 'VOICE') fail(404, 'Message unavailable.');
  const friendship = await Friendship.findOne({ _id: event.friendshipId, status: 'ACTIVE', $or: [{ user1: userId }, { user2: userId }] }).lean();
  if (!friendship) fail(404, 'Message unavailable.');
  const users = await User.find({ _id: { $in: [friendship.user1, friendship.user2] } }).select('_id isTestAccount testOwnerId').lean();
  if (users.length !== 2 || !people.sameScope(users[0], users[1]) || await people.blocked(users[0], users[1])) fail(404, 'Message unavailable.');
  return String(event.metadata?.text || '');
};

const createChatLinkPreviews = ({ fetchLink = createPublicLinkFetcher(), now = Date.now } = {}) => {
  const pages = new Map(), pictures = new Map(), failures = new Map(), pending = new Map();
  let pictureBytes = 0, active = 0; const waiting = [];
  const schedule = async task => {
    if (active >= 4) {
      if (waiting.length >= 16) throw Object.assign(new Error('Preview busy'), { code: 'LINK_BUSY' });
      await new Promise(resolve => waiting.push(resolve));
    } else active += 1;
    try { return await task(); }
    finally { const next = waiting.shift(); if (next) next(); else active -= 1; }
  };
  const touch = (map, key, value) => { map.delete(key); map.set(key, value); return value; };
  const pageFor = async url => {
    const key = digest(url), cached = pages.get(key);
    if (cached?.expiresAt > now()) return touch(pages, key, cached);
    if (pending.has(key)) return pending.get(key);
    const promise = schedule(async () => {
      let page;
      try {
        const result = await fetchLink(url), parsed = parsePage(result.body, result.url);
        page = { ...parsed, url, domain: new URL(url).hostname, status: parsed.title ? 'READY' : 'UNAVAILABLE', imageVersion: parsed.imageURL ? digest(parsed.imageURL).slice(0, 24) : null, expiresAt: now() + 86400000 };
      } catch { page = { ...unavailable, expiresAt: now() + 600000 }; }
      touch(pages, key, page); while (pages.size > 512) pages.delete(pages.keys().next().value);
      return page;
    }).finally(() => pending.delete(key));
    pending.set(key, promise); return promise;
  };
  const preview = async (userId, body) => {
    const text = await authorize(userId, body), url = firstLink(text);
    if (!url) return unavailable;
    let page; try { page = await pageFor(url); } catch { page = unavailable; }
    await authorize(userId, body);
    if (page.status !== 'READY') return unavailable;
    return { status: 'READY', url: page.url, domain: page.domain, title: page.title, description: page.description, imageVersion: page.imageVersion };
  };
  const image = async (userId, body) => {
    const text = await authorize(userId, body), url = firstLink(text);
    if (!url) fail(404, 'Preview image unavailable.');
    const page = await pageFor(url);
    if (!page.imageURL || body.imageVersion !== page.imageVersion) fail(404, 'Preview image unavailable.');
    const key = `image:${page.imageVersion}`;
    if (failures.get(key) > now()) fail(404, 'Preview image unavailable.');
    let result = pictures.get(key);
    if (result?.expiresAt <= now()) { pictureBytes -= result.body.length; pictures.delete(key); result = null; }
    if (!result) {
      if (!pending.has(key)) pending.set(key, schedule(async () => {
        const picture = await fetchLink(page.imageURL, { image: true });
        const dimensions = imageSize(picture.body);
        const types = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
        if (!types[dimensions.type] || dimensions.width < 32 || dimensions.height < 32 || dimensions.width > 4096 || dimensions.height > 4096 || dimensions.width * dimensions.height > 12000000 || picture.body.length > 512 * 1024) fail(404, 'Preview image unavailable.');
        const value = { body: picture.body, contentType: types[dimensions.type], expiresAt: now() + 86400000 };
        pictures.set(key, value); pictureBytes += value.body.length;
        while (pictureBytes > 12 * 1024 * 1024 || pictures.size > 48) { const first = pictures.keys().next().value; pictureBytes -= pictures.get(first).body.length; pictures.delete(first); }
        return value;
      }).catch(error => {
        touch(failures, key, now() + 600000);
        while (failures.size > 512) failures.delete(failures.keys().next().value);
        throw error;
      }).finally(() => pending.delete(key)));
      try { result = await pending.get(key); } catch { fail(404, 'Preview image unavailable.'); }
    } else touch(pictures, key, result);
    await authorize(userId, body); return result;
  };
  return { preview, image };
};
module.exports = { firstLink, parsePage, createChatLinkPreviews };
