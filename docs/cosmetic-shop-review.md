# Cosmetic editions and profile customization

This records the initial preview release. The subsequent [Stripe, gifting and measurement review](stripe-checkout-and-gifting.md) describes the checkout integration; sales still require merchant configuration.

The user chose to build the shop before selecting a currency or payment provider. This release provides the catalog, previews, saved collections and ownership controls. Checkout is intentionally unavailable; no real-money purchase or revenue is enabled yet.

## Shop and revenue model

- Nocturne: dark card stock with gold linework, a Gilt avatar frame and Midnight lines backdrop.
- Prism: violet cards with faceted edges, a Prismatic frame and Aurora glass backdrop.
- Porcelain: ivory cards with cobalt ink, a Ceramic frame and Cobalt gallery backdrop.
- The complete set groups all three editions.

Each edition is designed as a one-time, permanent cosmetic pack. Its deck finish applies to the player's card collection, without adding card copies or game advantages. This gives Hakoware a concrete product to sell once pricing and checkout are configured. The bundle gives players a second purchase option. There are no invented prices, countdowns, discounts or sales counts.

Players can reach the shop from You → Profile → Style shop or Arena → Cards → Style shop. They can preview finishes on four playable tools, see the matching frame and backdrop on their own identity, and save collections for launch. Saved lists persist privately across visits; saving is not an email subscription or a purchase.

“A little more you” now belongs inside the profile section, beside identity and appearance controls. Customize retains earned frames, collected signature cards and accepted featured Duos, and adds owned finishes and backdrops. Applying an edition preserves the signature card and featured Duo. Mobile identity controls wrap without squeezing the username.

## Ownership and deployment

The authenticated API permits catalog reads and saving known collections for the signed-in account. Cosmetic entitlements cannot be granted through any client route. Applying paid styles requires server-owned entitlements and checks those entitlements again in the atomic update. Original styles and earned Duo frames keep their existing availability rules.

Unlocks and saved lists are excluded from account and public participant DTOs. Equipped frames are visible through existing avatar surfaces; finishes apply to the player's collection and backdrops decorate their own You page. This does not add a public profile browser.

The catalog lives in `server/config/cosmetics.json` and is imported by the frontend. The backend is therefore self-contained when deployed from the `server` directory. New data uses existing User documents, safe defaults and no new indexes, transactions or uploaded assets. Existing gameplay card purchases, inventory and trading remain separate from the cosmetic shop. Deploy both client and server from this change.

Future checkout work must set prices and currency, integrate the chosen merchant provider, and grant entitlements only after verified, idempotent payment fulfillment. That work is deferred by the user's shop-first choice.

## Verification

- Production build passes. ESLint reports zero errors and 409 warnings under the existing configuration; its JSX unused-import warnings and the existing bundle-size warning remain.
- New `check:cosmetics`, included in CI, passes with standalone MongoDB and index creation blocked. It covers authentication, request validation, private saves, concurrent and retried saves, an interrupted save response, owned and unowned styles, entitlement revocation during an apply, partial profile updates, legacy profile payloads, account/bootstrap restoration, private projections, and unchanged Aura, inventory and XP.
- Existing presentation, client-payload, server-hardening, friend-space, card/wall, standalone-trade and card-purchase checks pass. All 17 frontend checks pass.
- Real local API browser checks cover 320, 390, 768 and 1280 pixels in both themes. Owned accounts exercise all three editions at 390 and 1280 pixels in both themes. Checks cover both shop entry points, persistent saves, bundle previews, locked customization, owned applies, preserved signature/Duo, 44px controls, horizontal overflow, focus restoration and simulated reduced visual viewports.
- Browser failure checks cover unavailable shop reads, previewing during an outage, explicit refresh, blocked dismissal during writes, response loss after a committed save, and switching from the editor to the shop without nested dialogs or stranded focus.

Screenshots use disposable local accounts. Their records were removed after verification. Physical-device keyboards, checkout and the exact live production deployment were not tested.

## Review images

- [Desktop shop](cosmetic-shop-evidence/shop-1280-dark.png)
- [Mobile shop](cosmetic-shop-evidence/shop-390-dark.png)
- [Finish and profile preview](cosmetic-shop-evidence/detail-light.png)
- [Profile with an owned backdrop](cosmetic-shop-evidence/owned-profile-390-light.png)
