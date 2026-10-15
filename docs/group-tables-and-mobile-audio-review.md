# Group tables, play rewards and mobile audio

Seasons remain part of each Duo: most templates run for 30 days and Long Distance runs for 45. The You page now explains where to see a season's remaining time and start its successor. Seasons, debt, Duo XP, Sparks availability and cosmetic payments keep their existing behavior.

## Playing with a group

Arena's Duels view now offers **Create a group table**, a 12-character table code and a copyable invitation link. Two to four authenticated players can join. Before joining, a link reveals only the seat count and availability; names and cards remain private. Players explicitly mark themselves ready, and the host starts when at least two players are ready. Starting, joining, leaving and playing compete on a single document revision.

Group tables use a separate 18-card deck: six Signal Flares, three Watchers, three Ghosts, three Clean Slates, two Orbits and one Oath. Existing two-player duels retain their twelve-card deck and rules. Each turn draws a card and plays one. Targeted cards let the player select a surviving opponent; Clean Slate can also target its owner. A correct Flare guess or discarded Oath eliminates its target, while everyone else continues. The last survivor wins. If the deck empties, the highest surviving held rank wins; equal top ranks share the finish.

Hands and Watcher memories are serialized separately for each viewer. Opponent hands appear only after the round finishes. Leaving an active round forfeits that player's seat without ending everyone else's game. Leaving the waiting room transfers hosting when necessary. Each rematch requires fresh readiness. Waiting tables expire after three hours without activity; active rounds after seven days. Home shows actionable group turns, and private activity notifications link back to the correct table.

Mutual connection requests remain optional after a completed game; chat still requires acceptance. A bounded record of completed encounters preserves that option when a host opens a rematch. Reporting and blocking work before and during play. Blocks close shared active/waiting tables and compete with held moves through a revision change. Reads check account scope and both directions of blocking, including a final check after delivery work. Test accounts stay within their owner's scope.

The new table model uses its primary share-code key. Correctness does not require MongoDB transactions or a new secondary index, accommodating Railway's current trial disk constraint. Queries and returned table lists are bounded, but a larger installation should add membership/list indexes after storage is available. Sparks remains paused as requested.

## Earning Aura

Both duels and group rounds award **5 Aura** for completing a round after playing at least two turns, plus **5 more for a sole win**. Each account can earn from its first **three qualifying rounds per UTC day**, across all game modes: at most 30 Aura daily. Draws grant the completion amount. Short rounds and forfeits grant nothing. The UI shows eligibility, daily progress, each round's credit and any bank repayment. It renders reset time in the player's local time zone; midnight UTC is 01:00 in Nigeria.

There is no entry cost or wager. Inventory cards and Duo progress are unaffected. The reward cap, balance increment, bank autopayment and durable receipt commit in one user update. A committed game's reward jobs survive response loss and retry through reads or the existing recovery worker. Wallet receipts repair the ledger independently if it is unavailable. Counters belong to the day the round ended, so a late credit cannot reset today's cap. Historical finished duels are not retroactively rewarded or labelled as pending credits.

## Mobile sound

iPhone and iPad now use one reusable HTML audio element with a generated PCM WAV sprite, activated during a trusted touch/click. This uses media playback instead of relying solely on Web Audio's potentially silent ambient route. Supported Audio Session APIs select playback. Desktop and Android retain the existing Web Audio path. The same cue definitions generate the mobile asset with `npm run generate:game-audio`; all cues are shorter than half a second, have quiet peaks and silent separation, and stop at their individual boundaries.

Game sounds remain opt-in for each account and device. Muting, hiding the app and changing accounts stop playback and pending cues. Existing cooldowns and event deduplication remain. A failed explicit preview reports failure and can be retried on a fresh tap. The settings mention the phone's media volume. There is no background music or typing/navigation sound.

## Validation

- `server npm run check:group-tables`: eight rules tests, including 3,000 complete randomized 2–4-player games with turn and card-conservation assertions; standalone-Mongo API checks for four players, private hands/peeks, readiness, host/seat races, exact retries, caps, autopayment, midnight repair, ledger outage, completed encounters, scope separation and a held move losing to a block. The integration database has only the table's primary index.
- Existing backend `check:duels`, `check:people`, `check:open-tables`, `check:aura-bank`, `check:friend-spaces` and `check:client-payloads` pass. The original six-turn duel now verifies its exact completion and win credits while preserving inventory and contract state.
- All nine frontend check scripts pass. Audio checks include eleven tests for activation, interruptions, mute/account/visibility boundaries, mobile media reuse, rejection recovery and the actual WAV's quiet peaks and silent gaps. Production build and public prerendering pass; lint has zero errors and the repository's existing warning classes.
- Four real accounts play complete twelve-turn group rounds through the production build at 390px/dark and 320px/light with iPhone user agents, touch input and installed-app safe-area dimensions, plus 1280px/dark with a mouse. Each case exercises joining through a link, readiness, starting, targeting, guessing, private peeks, results, credits, optional connections and the sound preference/preview. No page errors, failing game responses, horizontal overflow or clipped controls were observed.
- Mobile playback checks use native Chromium HTML media with user activation required, real WAV decoding, seek/range responses and successful cue playback after async API responses. Desktop uses native Web Audio. These checks do **not** establish physical iPhone speaker output or native Safari behavior: those require a device check after deployment.
- Existing two-player browser journeys also pass at 390px with touch and 1280px with a mouse: interrupted audio recovery, a real six-turn round, winner/other-player sounds, exact earned Aura, rematch/leave, private Watcher memories and a sent message that becomes a check-in. Reward completion refreshes the current account's wallet immediately.

Screenshots in [group-table-evidence](group-table-evidence/) show waiting and playing layouts in both themes. Screenshots are illustrative; game, privacy and credit assertions use actual API state.
