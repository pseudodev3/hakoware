# Duo identity and game polish

The main app now gives each friendship a recognizable shared look, brings real conversations onto Home, and gives earned game moments a stronger visual finish.

## What changed

- **Shared Duo identity:** either accepted participant can choose a name, one of six colors, and an Orbits, Waves, or Rays cover. Paired avatars and the selected look appear across Home, Circle, the friend space, recaps, and share cards. The editor lives alongside existing Duo settings.
- **Personal Home:** the featured Duo uses the existing priority ranking and shows an actual recent message, its sender, and the next useful action. Completed seasons lead to their recap. Existing invitations, first-check-in guidance, and Circle activity remain available.
- **Distinct cards:** all twelve current and legacy card designs have individual vector illustrations. Card details explain the actual effect, conditions, and limitations before use. Prices, inventory, purchases, and trades keep their existing rules. The unused embedded artwork module is removed.
- **Earned moments:** new Duo level-ups and completed seasons reveal paired avatars, the shared cover, and the earned result. Old timeline entries offer manual replay without opening a celebration on every visit. Sharing fetches current authenticated recap data; weekly and season exports use the selected period's real metrics.
- **Expressive profiles:** players can choose a collected signature card, feature one accepted Duo privately on their own You page, and wear earned avatar frames. Original, Linked, Orbit, and Crown unlock at actual Duo levels 1, 2, 5, and 10. Recorded unlocks survive an ended Duo. Saving a frame updates avatars across the app without a reload.
- **Flare finish:** successful Signal Flare use opens an amber torch reveal for the sender, while public Flare rows gain a brief glow. The existing shared activity badge and delivery recovery remain intact. Reduced-motion settings disable the extra animation.

## Data and permissions

The new authenticated presentation routes restrict Duo changes to accepted participants and profile changes to the signed-in account. Names, colors, covers, frame unlocks, card collection membership, and featured Duo ownership are validated on the server. Cosmetic updates do not change Aura, XP, limits, debt, or game rules.

Only the selected avatar frame enters public participant views. Featured Duo references, earned-frame history, and profile showcase choices stay out of account and public activity payloads. Duo identities remain in participant-only contract data. Public Flare activity still excludes the recipient, messages, and private Duo name.

These additions use existing User and Friendship documents and add no database indexes or uploaded media. Existing contracts and avatars retain safe defaults. Sparks publishing remains deferred until the planned VPS move; the Railway disk-space requirement is unchanged. Deploy the frontend and backend together.

## Verification

- Production build passes. ESLint reports zero errors and 384 warnings under the existing configuration; the existing bundle-size warning remains.
- All eleven frontend checks pass. The new presentation suite covers authentication, co-owner access, foreign and pending Duo rejection, invalid customization, earned frame gates, collection ownership, safe projections, unchanged Aura/XP/rules, and retained unlocks after a Duo ends. It is included in CI.
- Existing client-payload, friend-space, card/trade, trial Flare delivery, Sparks, world activity, Aura bank, Duo activation, card purchase, and server-hardening suites pass.
- Three-account Chromium checks exercise real check-ins and a level reveal, shared styling, a real incoming Home message, profile persistence, share PNG generation, an actual card purchase and Flare use, and public visibility from an unrelated account while retaining recipient privacy.
- Eleven views pass at 320, 390, and 1280 pixels in both themes: 66 rendered cases without horizontal overflow or unexpected browser errors. Additional checks cover immediate frame propagation, quiet historical milestones, long names, reachable Save in a reduced visual viewport, Escape, and viewport cleanup.

Images use disposable local accounts; those accounts and their associated records are removed after verification. Physical-device keyboards and the live production deployment have not been verified here. Retention impact requires live usage measurement.

## Review images

- [Home on desktop](duo-identity-evidence/home-1280-dark.png)
- [Home on mobile](duo-identity-evidence/home-390-light.png)
- [Card collection](duo-identity-evidence/cards-1280-dark.png)
- [Shared Duo editor at 320 pixels](duo-identity-evidence/duo-editor-320-light.png)
- [Profile showcase](duo-identity-evidence/profile-390-light.png)
- [Level reveal](duo-identity-evidence/level-390-dark.png)
- [Flare reveal](duo-identity-evidence/flare-390-dark.png)
- [Duo editor with a reduced visual viewport](duo-identity-evidence/duo-keyboard-simulation.png)
