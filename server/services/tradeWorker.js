const { settleExpiredTrades } = require('./cardTrading');
let timer;
let active;
const tick = () => {
  if (active) return;
  active = settleExpiredTrades()
    .catch((error) => console.error('Trade expiry failed:', error.message))
    .finally(() => {
      active = null;
    });
};
const startTradeWorker = () => {
  tick();
  timer = setInterval(tick, 60000);
  timer.unref();
};
const stopTradeWorker = async () => {
  clearInterval(timer);
  if (active) await active;
};
module.exports = { startTradeWorker, stopTradeWorker };
