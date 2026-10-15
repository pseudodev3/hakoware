const { reconcileCardPurchases } = require('./cardPurchases');
const { reconcileAuraWallet } = require('./auraBank');
const { reconcileGameRewards } = require('./gameRewards');
const { reconcileWorldActivity } = require('./worldActivity');
let timer;
let active;
const tick = () => {
  if (active) return;
  active = Promise.all([reconcileCardPurchases(), reconcileAuraWallet(), reconcileGameRewards(), reconcileWorldActivity({ prune: true })])
    .catch((error) => console.error('Economy and activity recovery failed:', error.message))
    .finally(() => { active = null; });
};
const startPurchaseWorker = () => { tick(); timer = setInterval(tick, 60000); timer.unref(); };
const stopPurchaseWorker = async () => { clearInterval(timer); if (active) await active; };
module.exports = { startPurchaseWorker, stopPurchaseWorker };
