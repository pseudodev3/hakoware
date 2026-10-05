const { reconcileCardPurchases } = require('./cardPurchases');
let timer;
let active;
const tick = () => {
  if (active) return;
  active = reconcileCardPurchases()
    .catch((error) => console.error('Card purchase journal recovery failed:', error.message))
    .finally(() => { active = null; });
};
const startPurchaseWorker = () => { tick(); timer = setInterval(tick, 60000); timer.unref(); };
const stopPurchaseWorker = async () => { clearInterval(timer); if (active) await active; };
module.exports = { startPurchaseWorker, stopPurchaseWorker };
