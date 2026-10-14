# NOWPayments cosmetics checkout

NOWPayments is the default provider for new cosmetic purchases. Existing Stripe orders keep their provider and remain recoverable. Account verification was reported by the user; payout-wallet configuration, API credentials, live payment delivery and card availability have not been verified here. Sales remain closed without the complete server configuration and the explicit sales flag.

## Configure the payout wallet

1. Use a wallet you control. If you need one, create it in a reputable wallet app such as Trust Wallet or MetaMask and keep its recovery phrase offline. Hakoware and NOWPayments do not need that phrase or the wallet's private keys.
2. Choose a stablecoin and a low-fee network listed by both the wallet and NOWPayments. USDC on Polygon is an option to check; do not assume a similarly named network is interchangeable.
3. In the wallet, use Receive for that exact coin/network and copy the public receiving address. Add it in NOWPayments' payout-wallet/payment settings, selecting the same coin and network. Confirm any email verification and the account's payout or conversion settings.
4. Check the supported payment options, minimums and fees at the proposed order values. Buyers choose a supported coin in hosted checkout; Hakoware does not override the merchant's payout wallet. Card-to-crypto availability needs separate confirmation with NOWPayments and its partner.

## Secure server configuration

Create an API key and an IPN secret in the NOWPayments dashboard. Enter both in Railway's API service Variables, never in chat, Git, or frontend build variables. The API key is sent only to NOWPayments; the raw IPN secret stays server-side to verify callback HMACs.

Set the public origins and provider:

```dotenv
COSMETIC_PAYMENT_PROVIDER=nowpayments
FRONTEND_URL=https://hakoware.xyz
PUBLIC_API_URL=https://hakoware-production.up.railway.app
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
NOWPAYMENTS_SANDBOX=false
COSMETIC_PRICE_CURRENCY=usd
COSMETIC_SALES_ENABLED=false
```

Enter approved prices in major USD units. The launch recommendation is **$4.99 per edition and $11.99 for the complete set**, approximately 20% below three individual editions. This is a proposal, not a verified production price list:

```dotenv
COSMETIC_PRICE_NOCTURNE=4.99
COSMETIC_PRICE_PRISM=4.99
COSMETIC_PRICE_PORCELAIN=4.99
COSMETIC_PRICE_COMPLETE=11.99
```

Each invoice explicitly supplies the IPN URL:

`https://hakoware-production.up.railway.app/api/payments/nowpayments/webhook`

Use the same URL if setting a global callback in the dashboard. The signing secret must match exactly. The API callback origin can use a custom API domain through `PUBLIC_API_URL`; `API_URL` remains a fallback for existing development setup.

Sandbox uses `api-sandbox.nowpayments.io` and its matching account key/secret. Sandbox checkout is disabled when `NODE_ENV=production`. Verify the chosen account configuration on a suitable staging environment, including a self purchase, a gift, a partial payment and repeated IPNs, before enabling public sales. Switch keys, signing secret and mode together. Enable `COSMETIC_SALES_ENABLED=true` only after payout settings, supported methods, minimums and delivery have been checked.

## Confirmation and recovery

The API selects the price, cosmetic grants, recipient and return URL. Browser requests cannot select an amount, payout address or paid state. A redirect alone never delivers an edition.

Callbacks use canonical JSON and HMAC-SHA512 with constant-time signature comparison. After signature verification the API retrieves the payment from NOWPayments and checks its payment ID, invoice, saved order reference, fiat amount and currency. Delivery requires `finished` and an actual paid amount at least equal to the provider's quoted payment amount. Waiting, blockchain confirmation, transfer and partial-payment states keep the purchase pending.

Duplicate or concurrent callbacks deliver once. Delivery and gift receipts use atomic recipient updates; notification recovery does not award another collection. These operations need no new secondary indexes, preserving Railway trial compatibility. Orders have no effect on Aura, card inventory, game XP or rank.

Invoice creation uses a database claim because no invoice-creation idempotency guarantee was established in the available official reference. A lost response or process interruption is not automatically replayed. The user can open saved purchases; uncertain links show a support reference. A verified payment callback can recover the original invoice reference and its hosted URL. A definitive rejected creation releases the reservation and permits a new intent.

A failed or expired coin quote does not establish that its invoice was revoked. The saved invoice stays resumable, and overlapping edition/bundle purchases remain reserved. The UI does not offer a misleading cancellation action for NOWPayments. Legacy Stripe checkout cancellation retains its existing verified behavior.

Pending receipt views check confirmation every 15 seconds while visible. Users can also check or resume manually. Receiving a gift does not equip it automatically. Hosted redirects accept the expected HTTPS checkout host/path only. Unrelated users cannot inspect receipts or use the buyer's checkout.

Founder totals now say Completed order value: crypto orders use their confirmed shop price, rather than implying a fiat bank payout. Actual crypto payouts, fees and refunds remain in the provider dashboard.

## Verification and limitations

- `check:nowpayments-checkout` covers signed callbacks, authenticated proof, tampered references/amounts, partial funding, final delivery, duplicate callbacks, concurrent orders, invoice uncertainty, stale creation recovery, notification outages, gifts, partial bundle ownership, quote expiry, private receipts and the production sandbox guard on isolated MongoDB with secondary indexes blocked.
- Existing Stripe recovery, cosmetic ownership, client-payload and product-journey suites pass. The build, public SEO checks, checkout-link tests and existing frontend checks pass; lint has zero errors with 415 existing warnings.
- Production-asset Chromium checks at 320, 390 and 1280px in both themes use the actual controllers and isolated MongoDB with a mocked NOWPayments boundary. They cover hosted redirect, partial-payment copy, automatic confirmation, self purchase/equip, gifts/recipient choice, and saved-purchase recovery after a lost response.
- Official invoice parameters and payment-status retrieval were checked against [NOWPayments' SDK reference](https://github.com/NowPaymentsIO/nowpayments-api-js). The official npm reference source was SHA-512 verified and read; no SDK dependency was installed. The current network policy blocked direct provider API/docs access. Real account/API, sandbox, live funds, card availability and native iPhone checkout behavior remain unverified.

## Cloud environment draft

The draft preserves existing destinations and adds NOWPayments API/account/docs hosts and the official Postman documentation host. It declares an optional per-user API key restricted to `api.nowpayments.io` and `api-sandbox.nowpayments.io`, plus direct runtime-variable requirements for IPN verification and proposed prices. Sales are suggested closed; sandbox is suggested for development.

Draft saving does not apply settings or publish the environment. Review/save and publish through environment settings before attempting provider access in a future cloud task. A proxy-backed IPN-secret placeholder cannot be used for local HMAC verification: provide the actual signing secret through a secure server runtime variable. The earlier unused `HAKOWARE_STRIPE_SETUP_KEY` draft requirement can be removed in the environment editor; NOWPayments does not use it.
