const User = require('../models/User');
const RoomWall = require('../models/RoomWall');
const Notification = require('../models/Notification');
const { scopeFor, REACTIONS } = require('./afterHours');
const { CARD_CATALOG } = require('./cardCatalog');
const { retryKey } = require('./cardTrading');
const COLORS = ['gold', 'red', 'green', 'blue', 'ivory', 'violet'];
const MAX_PIECES = 60;
const PER_PERSON = 8;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const weekStart = (value = new Date()) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
};
const weekKey = (value) => weekStart(value).toISOString().slice(0, 10);
const coordinate = (value, minimum = 0.08, maximum = 0.92) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  )
    fail(400, 'Choose a position inside the wall');
  return Math.round(value * 10000) / 10000;
};
const normalizePiece = (body) => {
  const kind = String(body.kind || '');
  if (!['NOTE', 'STICKER', 'DRAWING'].includes(kind))
    fail(400, 'Choose a note, sticker or sketch');
  const piece = {
    id: retryKey(body.clientId),
    kind,
    color: COLORS.includes(body.color) ? body.color : 'gold',
    x: coordinate(body.x ?? 0.5),
    y: coordinate(body.y ?? 0.5),
    rotation: coordinate(body.rotation ?? 0, -15, 15),
    reactions: [],
    createdAt: new Date(),
  };
  if (kind === 'NOTE') {
    if (
      typeof body.text !== 'string' ||
      !body.text.trim() ||
      body.text.trim().length > 90
    )
      fail(400, 'Write a note of up to 90 characters');
    piece.text = body.text.trim();
  }
  if (kind === 'STICKER') {
    if (CARD_CATALOG[body.cardId]?.kind !== 'STICKER')
      fail(400, 'Choose a sticker card');
    piece.cardId = body.cardId;
  }
  if (kind === 'DRAWING') {
    if (
      !Array.isArray(body.strokes) ||
      !body.strokes.length ||
      body.strokes.length > 12
    )
      fail(400, 'Keep sketches to twelve strokes');
    piece.strokes = body.strokes.map((stroke) => {
      if (!Array.isArray(stroke) || !stroke.length || stroke.length > 40)
        fail(400, 'This sketch is too detailed');
      return stroke.map((point) => {
        if (!Array.isArray(point) || point.length !== 2)
          fail(400, 'Invalid sketch point');
        return [coordinate(point[0], 0, 1), coordinate(point[1], 0, 1)];
      });
    });
  }
  return piece;
};
const selectedWeek = (value) => {
  const current = weekStart();
  if (!value) return weekKey(current);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))
    fail(400, 'Choose a recent wall');
  const date = new Date(value + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    weekKey(date) !== value ||
    date > current ||
    current - date >= 28 * 86400000
  )
    fail(400, 'That wall is no longer available');
  return value;
};
const wallView = async (user, requestedWeek) => {
  const key = selectedWeek(requestedWeek);
  const current = key === weekKey();
  const wall = await RoomWall.findOne({
    scopeKey: scopeFor(user),
    weekKey: key,
  }).lean();
  const pieces = wall?.pieces || [];
  const people = await User.find({
    _id: { $in: [...new Set(pieces.map((piece) => String(piece.actorId)))] },
  })
    .select('_id displayName username avatar')
    .lean();
  const byId = new Map(people.map((person) => [String(person._id), person]));
  const reset = new Date(key + 'T00:00:00Z');
  reset.setUTCDate(reset.getUTCDate() + 7);
  return {
    weekKey: key,
    resetsAt: reset,
    readOnly: !current,
    revision: wall?.revision || 0,
    colors: COLORS,
    reactions: REACTIONS,
    limits: { perPerson: PER_PERSON, total: MAX_PIECES },
    stickers: Object.values(CARD_CATALOG).filter(
      (card) => card.kind === 'STICKER' && user.inventory?.includes(card.id),
    ),
    pieces: pieces.map((piece) => {
      const actor = byId.get(String(piece.actorId));
      const reactions = piece.reactions || [];
      return {
        id: piece.id,
        kind: piece.kind,
        color: piece.color,
        x: piece.x,
        y: piece.y,
        rotation: piece.rotation,
        text: piece.text || null,
        cardId: piece.cardId || null,
        strokes: piece.strokes || null,
        createdAt: piece.createdAt,
        isOwn: String(piece.actorId) === String(user._id),
        actor: {
          displayName: actor?.displayName || 'Former player',
          username: actor?.username || null,
          avatar: actor?.avatar || null,
        },
        reactions: {
          counts: Object.fromEntries(
            REACTIONS.map((emoji) => [
              emoji,
              reactions.filter((reaction) => reaction.emoji === emoji).length,
            ]),
          ),
          viewerReaction:
            reactions.find(
              (reaction) => String(reaction.userId) === String(user._id),
            )?.emoji || null,
        },
      };
    }),
  };
};
// A revision compare-and-swap preserves concurrent contributions without replacing someone else's work.
const editWall = async (user, operation) => {
  const key = weekKey();
  const scopeKey = scopeFor(user);
  const expiry = weekStart();
  expiry.setUTCDate(expiry.getUTCDate() + 28);
  try {
    await RoomWall.updateOne(
      { scopeKey, weekKey: key },
      { $setOnInsert: { pieces: [], revision: 0, expiresAt: expiry } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const wall = await RoomWall.findOne({ scopeKey, weekKey: key }).lean();
    const result = await operation(wall.pieces);
    if (result?.unchanged) return { ...result, weekKey: key };
    if (weekKey() !== key)
      fail(409, 'A fresh wall just opened. Reload before posting.');
    const changed = await RoomWall.updateOne(
      { _id: wall._id, revision: wall.revision },
      { $set: { pieces: wall.pieces }, $inc: { revision: 1 } },
    );
    if (changed.modifiedCount) return { ...result, weekKey: key };
  }
  fail(
    409,
    'The wall moved while you were editing. Your work is kept; try again.',
  );
};
const addPiece = async (user, body) => {
  const piece = normalizePiece(body);
  if (piece.kind === 'STICKER' && !user.inventory?.includes(piece.cardId))
    fail(409, 'Own an available copy of this sticker card before stamping it');
  return editWall(user, (pieces) => {
    const existing = pieces.find((item) => item.id === piece.id);
    if (existing) {
      if (String(existing.actorId) !== String(user._id))
        fail(409, 'This wall mark already exists');
      return { unchanged: true, pieceId: existing.id };
    }
    if (pieces.length >= MAX_PIECES)
      fail(409, 'This week’s wall is full. A fresh wall opens Monday.');
    if (
      pieces.filter((item) => String(item.actorId) === String(user._id))
        .length >= PER_PERSON
    )
      fail(400, 'You have eight pieces here. Remove one to make room.');
    pieces.push({ ...piece, actorId: user._id });
    return { pieceId: piece.id };
  });
};
const changePiece = async (user, pieceId, body, remove = false) =>
  editWall(user, (pieces) => {
    const index = pieces.findIndex(
      (piece) =>
        piece.id === pieceId && String(piece.actorId) === String(user._id),
    );
    if (index < 0) fail(404, 'Your wall mark was not found');
    if (remove) pieces.splice(index, 1);
    else
      Object.assign(pieces[index], {
        x: coordinate(body.x),
        y: coordinate(body.y),
        rotation: coordinate(body.rotation ?? 0, -15, 15),
      });
    return { pieceId };
  });
const reactToPiece = async (user, pieceId, emoji) => {
  if (!REACTIONS.includes(emoji)) fail(400, 'Choose a wall reaction');
  const result = await editWall(user, (pieces) => {
    const piece = pieces.find((item) => item.id === pieceId);
    if (!piece) fail(404, 'This mark is no longer on the current wall');
    piece.reactions = piece.reactions || [];
    const previous = piece.reactions.find(
      (reaction) => String(reaction.userId) === String(user._id),
    );
    const old = previous?.emoji;
    piece.reactions = piece.reactions.filter(
      (reaction) => String(reaction.userId) !== String(user._id),
    );
    if (old !== emoji) piece.reactions.push({ userId: user._id, emoji });
    return { pieceId, ownerId: piece.actorId, notify: !old && old !== emoji };
  });
  if (result.notify && String(result.ownerId) !== String(user._id)) {
    try {
      await Notification.updateOne(
        {
          toUserId: result.ownerId,
          fromUserId: user._id,
          type: 'AFTER_HOURS_WALL',
          wallPieceId: pieceId,
          wallWeekKey: result.weekKey,
        },
        {
          $setOnInsert: {
            title: 'Your wall mark got a reaction',
            message: `${user.displayName} reacted ${emoji} to your mark in After Hours.`,
            wallWeekKey: result.weekKey,
            read: false,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return result;
};
module.exports = {
  wallView,
  addPiece,
  changePiece,
  reactToPiece,
  normalizePiece,
  weekKey,
  selectedWeek,
};
