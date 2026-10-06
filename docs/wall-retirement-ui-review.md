# Weekly wall retirement — 2026-10-06

The user rejected the weekly wall and asked to remove it while exploring a stronger activity. This pass retires the wall; it does not introduce a replacement game.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/features/afterHours/AfterHoursView.jsx`, `src/App.jsx` | After Hours defaulted to Wall with a Room/Wall switch | Opens the existing room; old links show a dismissible retirement notice | Navigation leads to an available experience rather than a removed destination |
| MEDIUM | `src/features/cards/CardCollection.jsx` | Buy/Stamp actions and twelve discovery slots included wall-only designs | Four-tool discovery progress; owned/discovered/reserved collectibles retained without Buy/Stamp/Use | The collection reflects availability and preserves purchases |
| MEDIUM | `server/routes/roomWall.js`, `server/services/cardPurchases.js` | Cached clients could still post or buy cards for a removed activity | Authenticated 410 responses; valid prior receipts remain replayable | Retiring a UI must also retire its mutations without duplicate charges |
| LOW | `src/features/home/HomePlay.jsx`, landing/profile | Tile, polling and marketing promised wall interactions | One collection tile; existing friend/card/room copy | Removes obsolete promises and unused fetches |
| LOW | `src/features/notifications/components/NotificationsPanel.jsx` | Wall Activity opened a mark | Opens the room with an explicit retirement notice | Historical updates remain understandable without a broken target |
| LOW | `src/features/afterHours/AfterHoursView.jsx` | Dismissal would remove the focused button | Clears legacy URL and focuses the After Hours heading | Keyboard users retain their position |

Verification: production build, lint with zero errors, circle-activity checks and diff review passed. Real Mongo tests cover all retired API methods with auth/no auth, unchanged seeded wall/users/Activity, retained collectible trades/escrow, active purchases, blocked new retired purchases, and private/legacy receipt replay with interrupted journal recovery. Browser fixtures cover 320×844, 390×600, 390×844 and 1280×844, light/dark and reduced/normal motion; no wall requests, collection visibility/details/offers/progress, purchase retry, room posts, old/default URLs, old/regular Activity routing, notice focus, empty collections and landing. Screenshots inspected.

No new purge, refunds, trade cancellation, migration or economy faucet. Existing wall TTL behavior remains. Not verified: physical iPhone/Safari or live authenticated production journeys. Existing lint/index/bundle warnings remain.

Branch CI also exposed the existing locked `proxy-addr` 2.0.7 dependency advisory. The lockfile now selects compatible 2.0.8 only; fresh installation, production audit (zero vulnerabilities) and server-hardening checks pass. No manifest or unrelated dependency upgrades.

Approve: no HIGH findings remain in the inspected scope.
