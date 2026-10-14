import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { test } from 'node:test';
import { circleRoster, filterCircleRoster } from '../src/lib/circleRoster.js';
import { sparkFailure } from '../src/lib/sparkAvailability.js';

const code = await readFile(new URL('../src/lib/cosmeticCheckout.js', import.meta.url), 'utf8');
const { bundleSavings } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const catalog = JSON.parse(await readFile(new URL('../server/config/cosmetics.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-10-14T12:00:00Z'), hour = 3600000;
const duo = (id, partner = {}, age = hour) => ({
  _id:id, status:'ACTIVE', user1:{ _id:'me', displayName:'Me' }, user2:{ _id:`friend-${id}`, ...partner },
  user1Perspective:{ lastInteraction:new Date(now - age).toISOString(), limit:3 },
  user2Perspective:{ lastInteraction:new Date(now - hour).toISOString(), limit:3 },
  season:{ status:'ACTIVE', startedAt:new Date(now - 5 * 24 * hour).toISOString() }
});

test('Circle searches the partner or Duo, ignoring accents/case and an optional @', () => {
  const one = { ...duo('one', { displayName:'Chloé', username:'chloe_ng' }), identity:{ name:'Late coffee' } };
  const roster = circleRoster([one], 'me', {}, now);
  for (const query of [' CHLOE ', ' @Chloe_ng ', 'late COFFEE']) assert.equal(filterCircleRoster(roster, query).length, 1);
  assert.equal(filterCircleRoster(roster, 'Me').length, 0);
  assert.equal(filterCircleRoster(circleRoster([one], 'friend-one', {}, now), 'me').length, 1);
});
test('Unread and check-in filters intersect search without mixing the two participants', () => {
  const data = [duo('due', { displayName:'Ari' }, 21 * hour), duo('fresh', { displayName:'Maya' })];
  const social = { fresh:{ unseenActivity:[{ id:'new-message', type:'MESSAGE' }] } };
  const roster = circleRoster(data, 'me', social, now);
  assert.deepEqual(filterCircleRoster(roster, '', 'due').map(row => row.friendship._id), ['due']);
  assert.deepEqual(filterCircleRoster(roster, '', 'unread').map(row => row.friendship._id), ['fresh']);
  assert.equal(filterCircleRoster(roster, 'Ari', 'unread').length, 0);
  assert.equal(filterCircleRoster(circleRoster([data[0]], 'friend-due', {}, now), '', 'due').length, 0);
});
test('Due follows the real 20-hour gate, season baselines and completed-season rules', () => {
  const boundary = duo('boundary', {}, 20 * hour);
  assert.equal(circleRoster([boundary], 'me', {}, now - 1)[0].due, false);
  assert.equal(circleRoster([boundary], 'me', {}, now)[0].due, true);
  const complete = { ...boundary, season:{ ...boundary.season, status:'COMPLETE' } };
  assert.equal(circleRoster([complete], 'me', {}, now)[0].due, false);
  const first = { ...boundary, user1Perspective:{ limit:3, lastInteraction:boundary.season.startedAt } };
  assert.equal(circleRoster([first], 'me', {}, now)[0].due, true);
});
test('Bankrupt partners retain priority, then unread and actual activity recency; input remains unchanged', () => {
  const danger = duo('danger'); danger.user2Perspective.baseDebt = 6;
  const data = [duo('quiet'), duo('recent'), duo('unread'), danger];
  const social = { recent:{ lastMessage:{ createdAt:new Date(now).toISOString() } }, unread:{ unseenActivity:[{ id:'unread' }], recentActivity:[{ createdAt:'invalid' }] } };
  assert.deepEqual(circleRoster(data, 'me', social, now).map(row => row.friendship._id), ['danger', 'unread', 'recent', 'quiet']);
  assert.deepEqual(data.map(row => row._id), ['quiet', 'recent', 'unread', 'danger']);
});

const pricedPacks = () => catalog.packs.map(pack => ({ ...pack, price:{ amount:pack.bundle ? 1199 : 499, currency:'usd', exponent:2 } }));
test('A complete bundle compares all actual prices in minor units', () => {
  const packs = pricedPacks();
  assert.deepEqual(bundleSavings(packs.at(-1), packs), { amount:298, currency:'usd', exponent:2 });
  assert.equal(bundleSavings(packs[0], packs), null);
  packs[0].price.amount = 599;
  assert.equal(bundleSavings(packs.at(-1), packs).amount, 398);
});
test('No savings are advertised for incomplete prices, mixed currencies, unsafe sums or a more expensive bundle', () => {
  for (const change of [packs => { packs[0].price = null; }, packs => { packs[0].price.currency = 'eur'; }, packs => { packs[0].price.exponent = 0; }, packs => { packs[0].price.amount = Number.MAX_SAFE_INTEGER; }, packs => { packs.at(-1).price.amount = 1999; }]) {
    const packs = pricedPacks(); change(packs); assert.equal(bundleSavings(packs.at(-1), packs), null);
  }
  const packs = pricedPacks(); assert.equal(bundleSavings(packs.at(-1), packs.slice(1)), null);
});
test('Partial ownership never implies the full-set comparison saves money on the remaining editions', () => {
  let packs = pricedPacks(); packs.at(-1).unlockedStyles = 1; assert.equal(bundleSavings(packs.at(-1), packs), null);
  packs = pricedPacks(); packs[0].owned = true; assert.equal(bundleSavings(packs.at(-1), packs), null);
});
test('Unavailable Sparks get a paused state, not a successful empty-feed invitation', () => {
  for (const status of [503, 507]) {
    const state = sparkFailure({ status, message:'Internal storage detail' });
    assert.equal(state.paused, true); assert.match(state.title, /pause/); assert.equal(state.message.includes('Internal storage detail'), false);
  }
});
test('Network and server failures remain distinguishable from an empty feed without exposing raw errors', () => {
  for (const error of [new Error('Network detail'), { status:500, message:'Server detail' }]) {
    const state = sparkFailure(error); assert.equal(state.paused, false); assert.match(state.title, /couldn’t load/); assert.equal(state.message.includes('detail'), false);
  }
});
