# Merchant account next steps

The user operates from Nigeria without a registered business. They declined US incorporation through Stripe Atlas and began Flutterwave onboarding after asking for the easiest option with international customer payments. Their ID review is pending. The signup UI offered Startup and NGO rather than Individual; support must confirm whether Startup fits their unregistered business and whether additional registration is required for international cards. Hakoware is not an NGO. No merchant approval or international payment access has been verified, and checkout has not been changed to Flutterwave.

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

The user asked about accepting crypto alongside cards while Flutterwave review remains pending. [NOWPayments](https://nowpayments.io/) with a fiat-on-ramp partner such as [Guardarian](https://guardarian.com/) is a candidate to investigate. This model converts a customer's card payment into crypto; it should not be presented as ordinary card acquiring or guaranteed worldwide access.

Official provider pages were blocked by the current environment's network allowlist. Nigerian merchant eligibility, unregistered-business support, Nigerian customer card access, permitted game cosmetics, minimum purchases, fees and refunds have not been verified. Confirm those points directly with the provider before choosing or integrating it. No crypto account or checkout integration was created, and no production payment method was enabled.
