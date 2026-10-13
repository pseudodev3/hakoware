const mongoose = require('mongoose');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const SparkPost = require('../models/SparkPost');
const SparkReply = require('../models/SparkReply');
const SparkReaction = require('../models/SparkReaction');
const { scopeFor } = require('./afterHours');
const REACTIONS = Object.freeze(['❤️', '😂', '👀', '🤝', '✨']);
const PAGE_SIZE = 12;
const REPLY_PAGE_SIZE = 20;
const id = value => String(value?._id || value || '');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const publicId = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const retryKey = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
const person = user => ({ displayName: user?.displayName || user?.username || 'Your friend', username: user?.username || null, avatar: user?.avatar || null, avatarFrame: user?.avatarFrame || 'plain' });
const contextFor = async viewerId => {
  const viewer = await User.findById(viewerId).select('displayName username avatar avatarFrame isTestAccount testOwnerId').lean();
  if (!viewer) fail(404, 'Account not found');
  const contracts = await Friendship.find({ status: 'ACTIVE', $or: [{ user1: viewer._id }, { user2: viewer._id }] }).select('user1 user2').lean();
  const ids = contracts.map(contract => id(contract.user1) === id(viewer._id) ? contract.user2 : contract.user1);
  const friends = await User.find({ _id: { $in: ids } }).select('_id isTestAccount testOwnerId').lean();
  const scopeKey = scopeFor(viewer);
  const authorIds = [viewer._id, ...friends.filter(friend => scopeFor(friend) === scopeKey).map(friend => friend._id)];
  return { viewer, scopeKey, authorIds, circleSize: authorIds.length - 1 };
};
const accessiblePost = async (context, value, { media = false } = {}) => {
  if (!publicId(value)) fail(404, 'This Spark is no longer available to your circle.');
  const query = SparkPost.findOne({ publicId: value, scopeKey: context.scopeKey, authorId: { $in: context.authorIds } });
  const post = await (media ? query.select('+photoStorageKey') : query).lean();
  if (!post) fail(404, 'This Spark is no longer available to your circle.');
  return post;
};
const cursorFor = row => Buffer.from(JSON.stringify({ at: new Date(row.createdAt).toISOString(), id: id(row._id) })).toString('base64url');
const parseCursor = value => {
  if (!value) return null;
  try {
    if (typeof value !== 'string' || value.length > 240 || !/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error();
    const data = JSON.parse(Buffer.from(value, 'base64url').toString());
    const at = new Date(data.at);
    if (!mongoose.isValidObjectId(data.id) || !Number.isFinite(at.getTime()) || at.toISOString() !== data.at) throw new Error();
    return { $or: [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: data.id } }] };
  } catch { return fail(400, 'That page is unavailable. Refresh your Sparks.'); }
};
const postViews = async (rows, context) => {
  const posts = await SparkPost.populate(rows, { path: 'authorId', select: 'displayName username avatar avatarFrame' });
  const ids = posts.map(post => post._id);
  const [reactions, replyCounts] = ids.length ? await Promise.all([
    SparkReaction.find({ postId: { $in: ids } }).lean(),
    SparkReply.aggregate([{ $match: { postId: { $in: ids } } }, { $group: { _id: '$postId', count: { $sum: 1 } } }])
  ]) : [[], []];
  return posts.map(post => {
    const ownReactions = reactions.filter(reaction => id(reaction.postId) === id(post._id));
    return {
      id: post.publicId, author: person(post.authorId), mine: id(post.authorId) === id(context.viewer), text: post.text,
      imageUrl: post.photoMime ? `/api/sparks/${post.publicId}/image` : null, createdAt: post.createdAt,
      reactions: REACTIONS.map(emoji => ({ emoji, count: ownReactions.filter(reaction => reaction.reaction === emoji).length })),
      viewerReaction: ownReactions.find(reaction => id(reaction.userId) === id(context.viewer))?.reaction || null,
      replyCount: replyCounts.find(count => id(count._id) === id(post._id))?.count || 0
    };
  });
};
const feedFor = async (context, { before, limit } = {}) => {
  const count = limit === undefined ? PAGE_SIZE : Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > PAGE_SIZE) fail(400, 'Choose a valid page size');
  const rows = await SparkPost.find({ scopeKey: context.scopeKey, authorId: { $in: context.authorIds }, ...(parseCursor(before) || {}) })
    .sort({ createdAt: -1, _id: -1 }).limit(count + 1).lean();
  const hasMore = rows.length > count;
  const page = rows.slice(0, count);
  return { posts: await postViews(page, context), hasMore, nextCursor: hasMore ? cursorFor(page.at(-1)) : null, circleSize: context.circleSize };
};
const repliesFor = async (post, context, { before } = {}) => {
  const rows = await SparkReply.find({ postId: post._id, ...(parseCursor(before) || {}) }).sort({ createdAt: -1, _id: -1 }).limit(REPLY_PAGE_SIZE + 1).populate('authorId', 'displayName username avatar avatarFrame').lean();
  const page = rows.slice(0, REPLY_PAGE_SIZE);
  return { replies: page.reverse().map(reply => ({ id: reply.publicId, author: person(reply.authorId), mine: id(reply.authorId) === id(context.viewer), text: reply.text, createdAt: reply.createdAt })), hasMore: rows.length > REPLY_PAGE_SIZE, nextCursor: rows.length > REPLY_PAGE_SIZE ? cursorFor(rows[REPLY_PAGE_SIZE - 1]) : null };
};
module.exports = { REACTIONS, contextFor, accessiblePost, postViews, feedFor, repliesFor, retryKey, fail };
