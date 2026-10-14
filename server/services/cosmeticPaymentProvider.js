const stripe = require('./stripeCheckout');
const nowpayments = require('./nowpaymentsCheckout');
const { fail } = require('./checkoutHelpers');
const active = () => {
  const name = process.env.COSMETIC_PAYMENT_PROVIDER || 'nowpayments';
  if (name === 'nowpayments') return nowpayments;
  if (name === 'stripe') return { ...stripe, name: 'stripe' };
  fail('Checkout is being configured. Please try again later.');
};
module.exports = { active };
