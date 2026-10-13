const express = require('express');
const multer = require('multer');
const { randomUUID, randomBytes } = require('crypto');
const { Readable } = require('stream');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendRouteError } = require('../services/httpError');
const { IMAGE_TYPES, normalizeMime, matchesImageSignature } = require('../services/imageValidation');
const { putObject, getObject, deleteObject } = require('../services/bucketStorage');
const { REACTIONS, contextFor, accessiblePost, postViews, feedFor, repliesFor, retryKey, fail } = require('../services/sparks');
const SparkPost = require('../models/SparkPost');
const SparkReply = require('../models/SparkReply');
const SparkReaction = require('../models/SparkReaction');
const Notification = require('../models/Notification');
const router = express.Router();
const limiter = (name, max) => createRateLimiter({ name, windowMs: 60000, max, keyGenerator: req => req.user.id, message: 'A lot at once. Try again in a moment.' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 3, fieldSize: 2048 } });
const uploadPhoto = (req, res, next) => upload.single('photo')(req, res, error => error ? res.status(400).json({ msg: 'Use one JPG, PNG, or WebP photo under 3 MB.' }) : next());
const textFor = value => typeof value === 'string' ? value.trim() : '';
const notifyOnce = async (query, values) => {
  try { await Notification.updateOne(query, { $setOnInsert: values }, { upsert: true }); }
  catch (error) { if (error.code !== 11000 || !await Notification.exists(query)) throw error; }
};
const writeIndexes = new Map();
const reactionNotificationIndex = { key: { toUserId: 1, fromUserId: 1, sparkPostId: 1 }, name: 'toUserId_1_fromUserId_1_sparkPostId_1', unique: true, partialFilterExpression: { type: 'SPARK_REACTION' } };
const replyNotificationIndex = { key: { toUserId: 1, sparkReplyId: 1 }, name: 'toUserId_1_sparkReplyId_1', unique: true, partialFilterExpression: { type: 'SPARK_REPLY' } };
const prepareWrites = (model, notificationIndex = null) => async (req, res, next) => {
  const key = model.modelName;
  try {
    if (!writeIndexes.has(key)) writeIndexes.set(key, (async () => {
      // init() permanently caches its first rejection. Reissue index setup after
      // a storage outage so the next request can recover without a restart.
      await model.createIndexes();
      // Existing notification collections can have unrelated historical indexes.
      // Each operation prepares only its own required notification constraint.
      if (notificationIndex) await Notification.collection.createIndexes([notificationIndex]);
    })().catch(error => { writeIndexes.delete(key); throw error; }));
    await writeIndexes.get(key); next();
  } catch (error) {
    console.error('Spark write indexes unavailable:', model.modelName, error.codeName || error.code || '', error.message);
    const storageUnavailable = error.codeName === 'OutOfDiskSpace' || /available disk space.*less than required minimum|insufficient disk space|not enough disk space/i.test(error.message);
    res.status(503).json(storageUnavailable ? { code: 'SPARK_STORAGE_UNAVAILABLE', msg: 'Sparks publishing is temporarily unavailable. Please try again later.' } : { msg: 'Sparks is preparing its write indexes. Please try again in a moment.' });
  }
};
router.use(auth);
router.get('/', limiter('sparks-feed', 90), async (req, res) => {
  try { res.json(await feedFor(await contextFor(req.user.id), req.query)); }
  catch (error) { if (!error.status || error.status >= 500) console.error('Spark feed load failed:', error.message); sendRouteError(res, error, 'Could not load your Sparks'); }
});
// Old activity links remain readable without restoring the retired room game.
router.get('/legacy/:activityId', limiter('sparks-legacy', 30), async (req, res) => {
  try {
    const context = await contextFor(req.user.id);
    const { findLiveActivity } = require('../services/afterHours');
    const linked = await findLiveActivity(context.scopeKey, req.params.activityId);
    if (!linked || !['SHOUT', 'HOT_TAKE', 'CONFESSION', 'QUESTION', 'REPLY'].includes(linked.activity.type)) return res.json({ post: null, reply: null });
    const User = require('../models/User');
    const view = async activity => {
      const anonymous = activity.type === 'CONFESSION' && activity.anonymous;
      const actor = anonymous ? null : await User.findById(activity.actorId).select('displayName username avatar avatarFrame').lean();
      return { id: activity.publicId, text: activity.text, createdAt: activity.createdAt, author: anonymous ? { displayName: 'Anonymous', username: null, avatar: null } : { displayName: actor?.displayName || 'Someone', username: actor?.username || null, avatar: actor?.avatar || null } };
    };
    return res.json({ post: await view(linked.parent || linked.activity), reply: linked.parent ? await view(linked.activity) : null });
  } catch (error) { sendRouteError(res, error, 'Could not open this previous activity'); }
});
router.post('/', limiter('sparks-post', 8), prepareWrites(SparkPost), uploadPhoto, async (req, res) => {
  let storageKey = null;
  try {
    const context = await contextFor(req.user.id);
    const clientId = req.body.clientId;
    if (!retryKey(clientId)) fail(400, 'A post retry key is required');
    const query = { authorId: context.viewer._id, clientId };
    const existing = await SparkPost.findOne(query).lean();
    if (existing) return res.json({ post: (await postViews([existing], context))[0] });
    const text = textFor(req.body.text);
    if (text.length > 280) fail(400, 'Keep your thought under 280 characters');
    if (!text && !req.file) fail(400, 'Add a photo or a thought first');
    const publicId = randomBytes(12).toString('hex');
    let photoMime = null;
    if (req.file) {
      photoMime = normalizeMime(req.file.mimetype);
      if (!IMAGE_TYPES.has(photoMime) || !matchesImageSignature(req.file.buffer, photoMime)) fail(400, 'Use a valid JPG, PNG, or WebP photo');
      storageKey = `sparks/${publicId}/${randomUUID()}${IMAGE_TYPES.get(photoMime)}`;
      await putObject(storageKey, req.file.buffer, photoMime);
    }
    let post;
    try { post = await SparkPost.create({ ...query, publicId, scopeKey: context.scopeKey, text, photoStorageKey: storageKey, photoMime }); }
    catch (error) {
      if (error.code !== 11000) throw error;
      post = await SparkPost.findOne(query);
      if (!post) throw error;
      if (storageKey) await deleteObject(storageKey);
    }
    storageKey = null;
    return res.json({ post: (await postViews([post.toObject()], context))[0] });
  } catch (error) {
    if (storageKey) await deleteObject(storageKey).catch(() => {});
    return sendRouteError(res, error, 'Could not share your Spark');
  }
});
router.get('/:postId/image', limiter('sparks-image', 150), async (req, res) => {
  try {
    const post = await accessiblePost(await contextFor(req.user.id), req.params.postId, { media: true });
    if (!post.photoStorageKey) return res.status(404).end();
    const object = await getObject(post.photoStorageKey);
    res.set({ 'Content-Type': post.photoMime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    if (!object.body) return res.status(404).end();
    Readable.fromWeb(object.body).on('error', () => res.destroy()).pipe(res);
  } catch (error) { sendRouteError(res, error, 'Could not open this photo'); }
});
router.get('/:postId', limiter('sparks-thread', 90), async (req, res) => {
  try {
    const context = await contextFor(req.user.id);
    const post = await accessiblePost(context, req.params.postId);
    let focusReply = null;
    if (req.query.reply) {
      if (typeof req.query.reply !== 'string' || !/^[a-f0-9]{24}$/.test(req.query.reply)) fail(400, 'That reply link is unavailable');
      const reply = await SparkReply.findOne({ postId: post._id, publicId: req.query.reply }).populate('authorId', 'displayName username avatar avatarFrame').lean();
      if (reply) focusReply = { id: reply.publicId, author: { displayName: reply.authorId?.displayName || 'Your friend', username: reply.authorId?.username || null, avatar: reply.authorId?.avatar || null }, mine: String(reply.authorId?._id) === String(context.viewer._id), text: reply.text, createdAt: reply.createdAt };
    }
    return res.json({ post: (await postViews([post], context))[0], focusReply, ...await repliesFor(post, context, req.query) });
  } catch (error) { sendRouteError(res, error, 'Could not open this Spark'); }
});
router.put('/:postId/reaction', limiter('sparks-react', 30), prepareWrites(SparkReaction, reactionNotificationIndex), async (req, res) => {
  try {
    const context = await contextFor(req.user.id);
    const post = await accessiblePost(context, req.params.postId);
    const reaction = req.body.reaction;
    if (reaction !== null && !REACTIONS.includes(reaction)) fail(400, 'Choose a reaction');
    const query = { postId: post._id, userId: context.viewer._id };
    if (reaction === null) await SparkReaction.deleteOne(query);
    else {
      try { await SparkReaction.updateOne(query, { $set: { reaction } }, { upsert: true }); }
      catch (error) { if (error.code !== 11000) throw error; await SparkReaction.updateOne(query, { $set: { reaction } }); }
    }
    if (!await SparkPost.exists({ _id: post._id })) { await SparkReaction.deleteOne(query); fail(404, 'This Spark was removed.'); }
    if (reaction && String(post.authorId) !== String(context.viewer._id)) {
      await notifyOnce({ type: 'SPARK_REACTION', toUserId: post.authorId, fromUserId: context.viewer._id, sparkPostId: post.publicId }, { title: 'A little love for your Spark', message: `${context.viewer.displayName} reacted to your Spark.`, read: false });
    }
    return res.json({ post: (await postViews([post], context))[0] });
  } catch (error) { sendRouteError(res, error, 'Could not react to this Spark'); }
});
router.post('/:postId/replies', limiter('sparks-reply', 24), prepareWrites(SparkReply, replyNotificationIndex), async (req, res) => {
  try {
    const context = await contextFor(req.user.id);
    const post = await accessiblePost(context, req.params.postId);
    const text = textFor(req.body.text);
    const clientId = req.body.clientId;
    if (!retryKey(clientId)) fail(400, 'A reply retry key is required');
    if (!text || text.length > 280) fail(400, 'Write a reply under 280 characters');
    const query = { postId: post._id, authorId: context.viewer._id, clientId };
    let reply;
    try { reply = await SparkReply.findOneAndUpdate(query, { $setOnInsert: { text } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; reply = await SparkReply.findOne(query); }
    if (!await SparkPost.exists({ _id: post._id })) { await SparkReply.deleteOne({ _id: reply._id }); fail(404, 'This Spark was removed.'); }
    if (String(post.authorId) !== String(context.viewer._id)) {
      await notifyOnce({ type: 'SPARK_REPLY', toUserId: post.authorId, sparkReplyId: reply.publicId }, { fromUserId: context.viewer._id, sparkPostId: post.publicId, title: 'Your Spark started a conversation', message: `${context.viewer.displayName}: ${reply.text.slice(0, 120)}`, read: false });
    }
    return res.json({ reply: { id: reply.publicId, author: { displayName: context.viewer.displayName, username: context.viewer.username, avatar: context.viewer.avatar || null }, mine: true, text: reply.text, createdAt: reply.createdAt }, post: (await postViews([post], context))[0] });
  } catch (error) { sendRouteError(res, error, 'Could not send your reply'); }
});
router.delete('/:postId', limiter('sparks-delete', 15), async (req, res) => {
  try {
    const context = await contextFor(req.user.id);
    const post = await accessiblePost(context, req.params.postId, { media: true });
    if (String(post.authorId) !== String(context.viewer._id)) fail(404, 'This Spark cannot be removed by this account.');
    if (post.photoStorageKey) await deleteObject(post.photoStorageKey);
    await SparkPost.deleteOne({ _id: post._id, authorId: context.viewer._id });
    await Promise.all([SparkReply.deleteMany({ postId: post._id }), SparkReaction.deleteMany({ postId: post._id }), Notification.deleteMany({ sparkPostId: post.publicId })]);
    return res.json({ success: true });
  } catch (error) { sendRouteError(res, error, 'Could not remove this Spark'); }
});
module.exports = router;
