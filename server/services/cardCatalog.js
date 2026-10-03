const spells = [
  [
    'PURIFY',
    'Clean Slate',
    120,
    'Reset your debt across every active contract. Grace periods do not change.',
    'slate',
  ],
  [
    'STEAL',
    'Claim',
    180,
    'Take 10% Aura from a bankrupt partner. A seven-day Grudge follows.',
    'claim',
  ],
  [
    'SIGNAL_FLARE',
    'Signal Flare',
    45,
    'Send a pressure signal to a contract partner. 48h cooldown per contract.',
    'flare',
  ],
  [
    'CHAOS_TICKET',
    'Chaos Ticket',
    90,
    'Force your Chaos Contract to roll for its next anomaly now.',
    'chaos',
  ],
];
const stickers = [
  ['ORBIT', 'Orbit', 20, 'Two paths. One orbit.', 'orbit'],
  ['GHOST', 'Ghost', 20, 'Present, spiritually.', 'ghost'],
  ['MENACE', 'Menace', 30, 'A small problem with excellent timing.', 'menace'],
  ['OATH', 'Oath', 30, 'Someone is holding you to it.', 'oath'],
  ['ECHO', 'Echo', 25, 'Still here after the room goes quiet.', 'echo'],
  ['EMBER', 'Ember', 25, 'Leave a little heat behind.', 'ember'],
  [
    'NO_SIGNAL',
    'No Signal',
    35,
    'Reception questionable. Intentions worse.',
    'signal',
  ],
  ['WATCHER', 'Watcher', 35, 'Saw that.', 'watcher'],
];
const CARD_CATALOG = Object.freeze(
  Object.assign(
    Object.create(null),
    Object.fromEntries(
      [
        ...spells.map(([id, name, cost, description, art], index) => ({
          id,
          name,
          cost,
          description,
          art,
          kind: 'SPELL',
          number: index + 1,
          series: 'Pressure',
          reusable: false,
        })),
        ...stickers.map(([id, name, cost, description, art], index) => ({
          id,
          name,
          cost,
          description,
          art,
          kind: 'STICKER',
          number: index + 5,
          series: 'Room marks',
          reusable: true,
        })),
      ].map((card) => [card.id, Object.freeze(card)]),
    ),
  ),
);
module.exports = { CARD_CATALOG };
