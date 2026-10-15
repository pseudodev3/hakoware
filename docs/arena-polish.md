# Arena feedback, presence, card backs and Aura moments

Card selection now labels the card being played and the one being kept. Deals, played cards and final reveals have short transitions; winning results get one restrained glow. Reduced motion disables these animations. Existing sound preferences, mobile media activation and cue cooldowns remain in force. Opponent moves can now trigger the quiet card cue as well as your own confirmed moves.

Results put the revealed hands, Aura highlights and the reward breakdown together. Rematch stays available, and **Play someone new** takes a seat through the existing open-table queue. This action preserves its retry key after an unconfirmed response. Optional connections still require both players to accept. Results skip the connection prompt when you are already connected.

## Aura farming through play

Aura moments are recognized from server-confirmed game events:

- **Cold read:** a correct Signal Flare guess without a prior successful Watcher or Orbit giving the player information. Either side of an Orbit counts as having information.
- **Unbothered:** your Ghost blocks an opponent’s Signal Flare.
- **Table sweep:** knock out two different opponents with correct Flare guesses or forced Oath discards.
- **Oath keeper:** keep Oath through a winning final-rank reveal. This is only recognized after the round finishes.

Several moments can appear in a round, but only one adds a **+2 style bonus** to a qualifying completion. Participation still requires at least two card plays and finishing without forfeiting. The first three qualifying rounds per UTC day count across duels and group tables: +5 completion, +5 for a sole win, +2 for style, up to **36 Aura per day**. No stakes or weekly challenges were added.

Rewards use the existing atomic wallet receipt and durable reward queue. Bank repayments, midnight attribution, concurrent retries and ledger recovery keep their existing behavior. Old rewards and pending jobs retain their original amounts; opening an old result cannot grant an extra payment. Moment detection reads public moves, and only reads winning hands after the final reveal; private peeks never appear in the public highlight data.

## Card backs

Arena’s **Choose card back** opens six illustrated designs. House original is free, Clubroom requires 3 lifetime rewarded rounds, and Night shift requires 10. Nocturne, Prism and Porcelain backs come with their existing editions. Entitlement follows the edition’s finish grant, so existing purchases and gifts work without a migration, checkout change or extra purchase.

`GET /api/duels/styles` returns the authenticated player’s selection and unlock progress. `PATCH /api/duels/styles` accepts only `{ cardBack }` and atomically checks earned progress or edition ownership. A revoked or invalid selection falls back to House original in public game views. The selected back is visible on the opponent’s hidden card in duels and on other occupied, active seats in group games. Backs do not change game rules or rank.

The style shop previews the front and matching back together. Wearing a paid edition saves the back, finish, avatar frame and profile backdrop in one guarded profile update.

## Presence and rejoining

Presence is scoped to an authorized table; it is not a global last-seen directory. A visible table’s normal refresh updates its seat heartbeat at most once per 20 seconds. Other players see **At the table** for 45 seconds after a heartbeat, then **Away**. Status may take a refresh to appear. Presence writes neither increment the game revision nor update activity timestamps or extend a table’s expiration. Leaving a waiting table removes that seat’s heartbeat.

Offline state disables moves while retaining the current view. Coming online refreshes the server’s saved round; returning to a tab also refreshes it. Heartbeats never clear a selected card. A reload or a new device can reopen the same saved hand through Arena’s existing active-table list. Game state and rewards stay authoritative on the server.

All new state uses existing primary-key documents. No secondary indexes, extra services or environment settings are required on Railway trial storage.

## Validation

- `npm run check:arena-polish --prefix server`: Aura recognition/privacy, single style bonuses, participation/forfeit guards, concurrent capped credits, bank repayment, earned/paid/revoked ownership, atomic edition application, table-scoped presence and revision/expiration safety.
- Existing duels, group tables, open tables, people, presentation, cosmetics, Aura bank and NOWPayments tests pass. Existing fixed-game expectations now include the earned style bonus. Game feedback, sound and session-boundary checks pass.
- Chromium browser runs against disposable standalone MongoDB exercised full four-player games at 390px/dark, 320px/light and 1280px/dark, including real native media playback on the mobile browser path. Separate runs exercised a six-turn two-player duel, public paid/earned card backs, a +12 completion/win/style credit, offline recovery without losing a selection, preserved result on reload, queueing for a new matched opponent, locked styles and the shop’s front/back preview at those same sizes.
- Build and lint pass. The repository retains lint warnings. Native iPhone/Safari was not tested; no production accounts or payments were created for verification.
