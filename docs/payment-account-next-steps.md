# Merchant account next steps

The user operates from Nigeria without a registered business. They clarified that they need help creating the merchant account, declined US incorporation through Stripe Atlas, and asked for the easiest option with international customer payments. Flutterwave is recommended for Nigerian onboarding and international cards. This is a recommendation; no Flutterwave account has been created or verified and the checkout integration has not been changed to Flutterwave.

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
