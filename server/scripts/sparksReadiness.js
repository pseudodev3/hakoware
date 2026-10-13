const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });
const models = ['SparkPost', 'SparkReply', 'SparkReaction'].map(name => require('../models/' + name));
const Notification = require('../models/Notification');
const noticeIndexes = [
  { key: { toUserId: 1, fromUserId: 1, sparkPostId: 1 }, name: 'toUserId_1_fromUserId_1_sparkPostId_1', unique: true, partialFilterExpression: { type: 'SPARK_REACTION' } },
  { key: { toUserId: 1, sparkReplyId: 1 }, name: 'toUserId_1_sparkReplyId_1', unique: true, partialFilterExpression: { type: 'SPARK_REPLY' } }
];
const requiredIndexes = () => [...models.map(model => ({ model, indexes: model.schema.indexes().map(([key, options]) => ({ key, ...options })) })), { model: Notification, indexes: noticeIndexes }];
const sameKey = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const checkIndexes = async () => {
  const report = [];
  for (const { model, indexes } of requiredIndexes()) {
    let existing;
    try { existing = await model.collection.listIndexes().toArray(); }
    catch (error) { if (error.code !== 26) throw error; existing = []; }
    const missing = indexes.filter(wanted => !existing.some(current => sameKey(current.key, wanted.key) && Boolean(current.unique) === Boolean(wanted.unique) && JSON.stringify(current.partialFilterExpression || {}) === JSON.stringify(wanted.partialFilterExpression || {}))).map(index => ({ key: index.key, unique: Boolean(index.unique) }));
    report.push({ collection: model.collection.name, ready: !missing.length, missing });
  }
  return report;
};
const prepareIndexes = async () => {
  for (const { model, indexes } of requiredIndexes()) {
    await model.createCollection(); await model.collection.createIndexes(indexes);
  }
};
async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    if (process.argv.includes('--prepare')) await prepareIndexes();
    const report = await checkIndexes(); console.log(JSON.stringify({ ready: report.every(row => row.ready), indexes: report }, null, 2));
    if (report.some(row => !row.ready)) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) run().catch(async error => { console.error('Sparks readiness could not complete:', error.codeName || error.code || 'Check database access, free storage and required configuration.'); process.exitCode = 1; await mongoose.disconnect(); });
module.exports = { checkIndexes, prepareIndexes };
