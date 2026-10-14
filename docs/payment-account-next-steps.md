# Merchant account next steps

The user operates from Nigeria without a registered business, declined US incorporation through Stripe Atlas, and reported completing NOWPayments verification on October 14, 2026. NOWPayments is now the default cosmetic-checkout integration. Payout wallets are not yet configured, API credentials are absent in this workspace, and card enablement is unknown. Use [NOWPayments activation](nowpayments-checkout.md) for wallet setup, secure server variables, pricing proposals and the remaining account-level checks. No live payment was made and sales have not been activated.

Flutterwave onboarding remains an earlier pending route. Its signup offered Startup and NGO rather than Individual; support must confirm whether Startup fits an unregistered business. Hakoware is not an NGO. Checkout has not been migrated to Flutterwave.

## Account signup

1. Open [Flutterwave signup](https://dashboard.flutterwave.com/signup), select Nigeria and use the actual registration status offered for the business. Do not select a foreign country to work around eligibility.
2. Verify the account through the provider's dashboard. Enter identity, business, tax and bank details directly with the provider. Available payment methods and the documents required for individual or registered accounts depend on its current review requirements.
3. Use `https://hakoware.xyz` as the product website. An accurate description is: “An online social game with optional one-time cosmetic purchases. Game points have no cash value. There are no cash prizes or cash-out.” Select the closest accurate business category.
4. Complete any registration or additional review the provider requires, confirm international card access and payout eligibility, and then configure/test the chosen provider's checkout and signed webhook delivery before enabling sales.

The approved merchant's legal name, cosmetic prices, currency and purchase/refund policy still need to be finalized for a launch. The website already links to support, terms, privacy and community pages.

## Stripe eligibility and secure configuration

Stripe's [official global list](https://stripe.com/global), read on October 13, 2026, lists Nigeria through the extended network. A direct Stripe merchant account requires an eligible supported-country business setup. US Atlas incorporation is optional, not a prerequisite for every possible Stripe route, and the user declined it. Existing Stripe integration remains available for a later eligible account; see [the checkout implementation](stripe-checkout-and-gifting.md).

The cloud configuration draft includes an optional `HAKOWARE_STRIPE_SETUP_KEY` requirement restricted to `api.stripe.com`, prepared before the user clarified the account-signup scope. It is not needed to create a merchant account. No key was supplied or validated in this work, and the saved draft requires publication before it applies. Production credentials belong in the API host's secure environment settings and never in frontend build variables.

Official Flutterwave documentation/dashboard domains were added to the draft while preserving the existing network destinations. The current proxy blocked their documentation before those changes were published, so current individual-account and international-payment requirements were not independently verified here. The provider's signup/review screens must establish eligibility; this guide does not promise approval.

## Crypto and card candidate — October 14, 2026

The user selected [NOWPayments](https://nowpayments.io/) after reporting verification. Its crypto checkout is integrated; a fiat-on-ramp partner such as [Guardarian](https://guardarian.com/) remains a method to confirm with the account. That model converts a customer's card payment into crypto and does not establish guaranteed worldwide access.

Official provider API/docs pages were blocked by the current environment's network allowlist; its official SDK reference was accessible. Nigerian merchant eligibility and product acceptance were not independently checked, and customer card access, minimum purchases, fees and refunds remain account-level checks. The account was created by the user, and no production payment method was enabled by this work.
