const User = require('../models/User');
const catalog = require('../config/cosmetics.json');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const hasStyle = (user, kind, id) => (user.cosmeticUnlocks || []).includes(`${kind}:${id}`);
const shopSnapshot = async userId => {
  const user = await User.findById(userId).select('+cosmeticUnlocks +cosmeticWishlist').lean();
  if (!user) fail(404, 'Account not found');
  return {
    status: 'preview', checkoutAvailable: false, currency: null,
    packs: catalog.packs.map(pack => ({ ...pack, price: null, owned: pack.grants.every(grant => (user.cosmeticUnlocks || []).includes(grant)), saved: (user.cosmeticWishlist || []).includes(pack.id) }))
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
