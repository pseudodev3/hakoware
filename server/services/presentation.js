const mongoose = require('mongoose');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { collectionSnapshot } = require('./cardTrading');
const { duoStateFromXP, recordEvent } = require('./contractGame');
const { contractView } = require('./clientViews');

const PALETTES = ['citron', 'clay', 'iris', 'sky', 'rose', 'sand'];
const COVERS = ['orbits', 'waves', 'rays'];
const FRAMES = [{ id: 'plain', name: 'Original', level: 1 }, { id: 'linked', name: 'Linked', level: 2 }, { id: 'orbit', name: 'Orbit', level: 5 }, { id: 'crown', name: 'Crown', level: 10 }];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const participants = userId => ({ $or: [{ user1: userId }, { user2: userId }] });
const validateKeys = (body, keys) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) fail(400, 'Choose valid customization options');
};
const updateDuoIdentity = async (userId, friendshipId, body) => {
  if (!mongoose.isValidObjectId(friendshipId)) fail(404, 'Duo not found');
  validateKeys(body, ['name', 'palette', 'cover']);
  if (typeof body.name !== 'string') fail(400, 'Enter a Duo name');
  const name = body.name.trim().normalize('NFC');
  if (Array.from(name).length > 32 || /[\u0000-\u001f\u007f]/u.test(name)) fail(400, 'Keep your Duo name within 32 characters on one line');
  if (!PALETTES.includes(body.palette) || !COVERS.includes(body.cover)) fail(400, 'Choose an available color and cover');
  const contract = await Friendship.findOneAndUpdate({ _id: friendshipId, status: 'ACTIVE', ...participants(userId) }, { $set: { identity: { name, palette: body.palette, cover: body.cover } } }, { returnDocument: 'after' }).populate('user1 user2', 'displayName username avatar avatarFrame');
  if (!contract) fail(404, 'Choose an accepted Duo');
  await recordEvent(contract._id, 'DUO_IDENTITY_CHANGED', { userId, metadata: { name } }).catch(error => console.error('Duo identity history pending:', error.message));
  return { success: true, contract: contractView(contract) };
};
const profileSnapshot = async userId => {
  const [user, contracts, collection] = await Promise.all([
    User.findById(userId).select('+showcase +earnedAvatarFrames').lean(),
    Friendship.find(participants(userId)).populate('user1 user2', 'displayName username avatar avatarFrame').lean(),
    collectionSnapshot(userId)
  ]);
  if (!user) fail(404, 'Account not found');
  const earnedLevel = Math.max(1, ...contracts.filter(contract => contract.status !== 'PENDING').map(contract => duoStateFromXP(contract.duoXP || 0).level));
  const earnedFrames = new Set([...(user.earnedAvatarFrames || []), ...FRAMES.filter(frame => earnedLevel >= frame.level).map(frame => frame.id)]);
  if ([...earnedFrames].some(frame => !(user.earnedAvatarFrames || []).includes(frame))) await User.updateOne({ _id: userId }, { $addToSet: { earnedAvatarFrames: { $each: [...earnedFrames] } } });
  const duos = contracts.filter(contract => contract.status === 'ACTIVE').map(contractView);
  const cards = collection.cards.filter(card => card.discovered);
  return {
    avatarFrame: user.avatarFrame || 'plain',
    frames: FRAMES.map(frame => ({ ...frame, unlocked: earnedFrames.has(frame.id) })),
    cards,
    duos,
    favoriteCardId: cards.some(card => card.id === user.showcase?.favoriteCardId) ? user.showcase.favoriteCardId : null,
    featuredDuoId: duos.some(contract => String(contract._id) === String(user.showcase?.featuredDuoId)) ? String(user.showcase.featuredDuoId) : null
  };
};
const updateProfile = async (userId, body) => {
  validateKeys(body, ['avatarFrame', 'favoriteCardId', 'featuredDuoId']);
  const snapshot = await profileSnapshot(userId);
  if (!snapshot.frames.some(frame => frame.id === body.avatarFrame && frame.unlocked)) fail(409, 'That frame opens at a higher earned Duo level');
  if (body.favoriteCardId !== null && !snapshot.cards.some(card => card.id === body.favoriteCardId)) fail(400, 'Choose a card you have collected');
  if (body.featuredDuoId !== null && !snapshot.duos.some(contract => String(contract._id) === body.featuredDuoId)) fail(400, 'Choose one of your accepted Duos');
  await User.updateOne({ _id: userId }, { $set: { avatarFrame: body.avatarFrame, showcase: { favoriteCardId: body.favoriteCardId, featuredDuoId: body.featuredDuoId } } });
  return { success: true, profile: await profileSnapshot(userId) };
};
module.exports = { PALETTES, COVERS, FRAMES, updateDuoIdentity, profileSnapshot, updateProfile };
