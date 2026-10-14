const User = require('../models/User');
const catalog = require('../config/cosmetics.json');
const { active } = require('./cosmeticPaymentProvider');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const hasStyle = (user, kind, id) => (user.cosmeticUnlocks || []).includes(`${kind}:${id}`);
const shopSnapshot = async userId => {
  const user = await User.findById(userId).select('+cosmeticUnlocks +cosmeticWishlist +cosmeticReceipts').lean();
  if (!user) fail(404, 'Account not found');
  const provider = active(), sales = await provider.storefront();
  return {
    status: sales.available ? 'open' : 'preview', checkoutAvailable: sales.available && !user.isTestAccount, currency: null, checkoutProvider: provider.name,
    newEditions: (user.cosmeticReceipts || []).filter(receipt => !receipt.seenAt).slice(-10).map(receipt => ({ orderId: receipt.orderId, packId: receipt.packId })),
    packs: catalog.packs.map(pack => ({ ...pack, price: sales.prices[pack.id] ? { amount: sales.prices[pack.id].amount, currency: sales.prices[pack.id].currency, exponent: sales.prices[pack.id].exponent } : null, unlockedStyles: pack.grants.filter(grant => (user.cosmeticUnlocks || []).includes(grant)).length, owned: pack.grants.every(grant => (user.cosmeticUnlocks || []).includes(grant)), saved: (user.cosmeticWishlist || []).includes(pack.id) }))
  };
};
const saveShopWish = async (userId, packId, body) => {
  if (!catalog.packs.some(pack => pack.id === packId)) fail(404, 'Choose a collection from the shop');
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.saved !== 'boolean' || Object.keys(body).some(key => key !== 'saved')) fail(400, 'Choose whether to save this collection');
  const update = body.saved ? { $addToSet: { cosmeticWishlist: packId } } : { $pull: { cosmeticWishlist: packId } };
  if (!(await User.updateOne({ _id: userId }, update)).matchedCount) fail(404, 'Account not found');
  return { success: true, shop: await shopSnapshot(userId) };
};
module.exports = { catalog, hasStyle, shopSnapshot, saveShopWish };
