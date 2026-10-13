# Stripe cosmetics, gifts and product journeys

Hakoware now has Stripe Checkout integration, purchase receipts, an edition reveal, cosmetic gifting and a founder dashboard for activation, return visits and shop conversion. Sales remain closed until the merchant account, keys and real Stripe prices are configured. No live payment was made during implementation.

The user operates from Nigeria and chose to establish an eligible account in a supported Stripe country. This code does not create or qualify that merchant account. It uses the official Stripe Node SDK, pinned to 23.0.0, and its 2026-09-30 API contract. The SDK's [webhook guidance](https://github.com/stripe/stripe-node#webhook-signing) requires the original request bytes; the webhook route is mounted before JSON parsing.

## Activate checkout when the account is ready

1. In Stripe test mode, create four one-time prices for Nocturne, Prism, Porcelain and The complete set. Set the actual prices and currency in Stripe. Review images use simulated USD prices, not a proposed production price list.
2. Set `FRONTEND_URL=https://hakoware.xyz` in Railway. This also makes invitations, password resets and checkout returns use the new domain. CORS explicitly supports `https://hakoware.xyz`, `https://www.hakoware.xyz` and the existing Vercel host, including deployments that retain the older CORS environment value.
3. Enter the test-mode `STRIPE_SECRET_KEY` securely in Railway and set `STRIPE_PRICE_NOCTURNE`, `STRIPE_PRICE_PRISM`, `STRIPE_PRICE_PORCELAIN` and `STRIPE_PRICE_COMPLETE` to the corresponding price IDs. Keep secret keys out of chat and Git.
4. Register the Railway API webhook at `/api/payments/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`. Store that endpoint's signing secret as `STRIPE_WEBHOOK_SECRET` in Railway. Align the endpoint with the SDK API version above.
5. Configure the merchant's tax settings and enable `STRIPE_AUTOMATIC_TAX_ENABLED=true` if using Stripe Tax. Tax-inclusive or additional amounts are shown in hosted checkout and retained in the receipt. The dashboard reports gross payment totals by currency; Stripe fees and refunds remain managed in Stripe.
6. Set `COSMETIC_SALES_ENABLED=true` to exercise the complete test-mode flow. Verify a self purchase, a gift, cancellation, an interrupted callback and a webhook retry using the eligible account. The integration only exposes prices that Stripe confirms are active, positive, one-time prices.
7. After that account-level verification, switch the keys, prices and webhook secret together to their live-mode equivalents. The local tests do not establish that a live merchant account is approved or that real cards can be charged.

Keep `COSMETIC_SALES_ENABLED=false` while onboarding the merchant account. Missing configuration or unavailable price reads preserve shop previews and disable new purchases. No currency, production amount or product discount is invented by the application.

## Purchase and gifting behavior

The server determines the price, grants, recipient and return URL. Client bodies cannot mark an order paid, choose an amount or award styles. Stripe events are signature-verified, then the server retrieves the current Checkout Session and checks its payment state, reference, currency, line item, price, quantity and subtotal against the saved order.

The buyer gets a stable order and Stripe idempotency key. Recipient reservations prevent concurrent overlapping purchases, including buying a bundle while an edition checkout is unfinished. Preparing-order retries acquire the reservation too. Unknown outcomes remain recoverable; the server refuses to replay uncertain creation beyond Stripe's documented idempotency guarantee. Confirmed expiry or failed asynchronous payment releases the reservation. Closing checkout is verified with Stripe before permitting another purchase.

Delivery updates the recipient's unlocks and receipt together. A notification failure can retry without duplicating delivery. Gifts are restricted to accepted, compatible-scope friends; test accounts cannot make real purchases. The recipient receives personal activity that opens their authenticated receipt. Gifting unlocks an edition without automatically changing their appearance.

Checkout uses the configured price currency consistently, with adaptive currency pricing disabled. This keeps the displayed price, verified order and receipt in the same currency while international cards can still pay through Stripe.

The receipt leads the shop after a checkout return. Players can wear an edition immediately, keep it for later, browse Owned collections or revisit their receipt. An open checkout can be resumed, checked or closed. Browser retry keys survive reloads; confirmed closed orders allow a new intent. Partial bundle ownership is explained before checkout. Purchases and received gifts do not change Aura, inventory, XP or card-trading rules.

## Product measurement

Founder Lab shows current account/Duo activation, next-day and day-seven return cohorts, weekly visitors, edition previews, checkout starts, paid buyers, saved-collection demand and gross paid totals grouped by currency. An activated Duo requires actual check-ins from both participants; a season-start timestamp or one person's repeated check-ins does not qualify.

Returns use the first recorded visit and completed UTC days within a 28-day cohort window. There is no invented historical retention data, and empty or immature cohorts show “Collecting data.” Daily visit history is private and bounded to 35 days. Shop events deduplicate per person, edition and day using primary keys. Test accounts are excluded. Client tracking cannot submit payment-success events. Measurement failures do not fail core actions. The privacy page explains these first-party signals and hosted payment processing.

## Verification

- Production build passes; ESLint has zero errors, with the existing warning configuration and bundle-size warning retained. Production dependency audits pass.
- CI includes new Stripe fulfillment/gifting and product-journey suites. They use real isolated standalone MongoDB with secondary index creation blocked. Checks cover raw signature verification, amounts and ownership, concurrent retries, delivery recovery, bundle reservations, failed asynchronous payments, closed-order retry signals, private receipts, strict request fields, real mutual activation, mature cohorts and telemetry outages.
- Existing cosmetic preview, presentation, client-payload, hardening/CORS, friend-space, standalone-trade and card-purchase checks pass. All 17 existing frontend checks pass.
- Chromium checks at 320, 390 and 1280 pixels in both themes exercise the actual API/controllers with a mocked Stripe boundary: prices, hosted redirect, callback verification before webhook delivery, edition reveal, gifts, recipient-controlled styling, Owned receipts and founder metrics. Additional checks cover visible receipt actions, focus, in-flight dismissal, cancellation and a fresh intent, a lost response across reload, and personal gift activity destinations.
- No live Stripe payment, production CORS response, real merchant onboarding or physical-device keyboard was verified. Screenshots use disposable local accounts; those records are removed after verification.

The cloud environment draft also preserves the existing network destinations and adds the official payment documentation/API domains. It requires environment publication to apply; reading the SDK's official GitHub documentation worked with the existing network configuration.

## Review images

- [Purchase reveal on mobile](commerce-evidence/receipt-light.png)
- [Gift selection](commerce-evidence/gift-dark.png)
- [Received gift](commerce-evidence/received-gift-mobile.png)
- [Founder journeys](commerce-evidence/founder-journeys-mobile.png)
