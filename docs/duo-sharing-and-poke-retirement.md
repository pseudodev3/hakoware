# Duo sharing and Poke retirement — October 14, 2026

The profile's Share Duo action is removed. Each Duo's contract details has an unboxed Share Duo action beside its progression; earned-level/season moments and weekly/season recaps remain shareable. The ordinary Duo action and milestone action use one shared service, fetch current recap stats and export the redesigned 1080 × 1350 image. Profiles retain their strongest-Duo statistic and showcase controls.

The old-image report came from an undeployed frontend. A fresh live request initially served `index-BRDRSXyF.js`, which contained `HAKOWARE // DUO CARD` and the old stamp renderer. After the user's Vercel redeploy, `index-Crr2ImTs.js` contains `OUR DUO` and the new layout, with no old slash heading. This verifies the live public renderer code; authenticated native iPhone sharing was not inspected.

Poke is removed from the composer, contract actions, frontend mutation service and Home priorities/discovery. Checked-in and completed contract actions return to the conversation. The old endpoint stays authenticated and responds with `410 POKE_RETIRED`, without creating events, notifications or game rounds. New social presence exposes Poke as unavailable for older installed clients and omits it from active discovery. Old Poke events remain readable in the timeline. Previously opened rounds can still finish with their hidden-answer rules intact. The unused Poke-triggered prompt tables and round generator are removed; there is no replacement quiz generator.

Validation passed: production build; lint with zero errors and 416 existing warnings; all 42 frontend checks across seven scripts; nine core backend suites plus presentation checks; mobile/desktop contextual native-image sharing, profile removal, absence of active Poke controls, recap/milestone sharing, cross-tab sessions and deferred-page failure recovery; six viewport/theme polish cases and twelve installed-app layout/keyboard cases. Browser fixtures simulate native sharing; they do not establish physical iPhone share-sheet behavior. Fixtures use local/disposable data. No production records, payments or Aura rules are changed.

Validation also exposed an existing trade acceptance race. A replay could see its recipient card already delivered while the original acceptance was still committing its terminal status, then incorrectly return an insufficient-card error. The retry now reconciles the durable settlement before deciding it lacks a card. A forced delivery checkpoint failed with 409 before the fix and succeeds afterward; normal concurrent accepts remain tested, and repeated delivery adds no extra cards, accepted events or notices.

## Proposed gameplay pass

These are proposals for the next implementation, not active rewards or cards.

| Priority | Addition | Player experience |
| --- | --- | --- |
| 1 | Short friend card duels | Continue the existing [duel proposal](card-duel-v1.md): hold two cards, play one, keep one hidden; peek, protect, swap and redraw. A free shared deck, at most eight turns and one clear return destination when it is your turn. |
| 2 | Cards with counterplay | Explore Shield against one eligible Claim and Truce as a mutually accepted pause on specified pressure actions. Explain eligible targets, duration and cost. Preserve normal check-in/debt progression and keep stranger targeting out. |
| 3 | Collections with a purpose | Give the existing collectible artwork a role in the free duel deck without consuming owned copies. Later, let players work toward chosen artwork or fragments with duplicate protection and clear progress. |
| 4 | Aura earned through play | After voluntary rematches show the game is fun, consider small completed-match/season rewards with account-level daily/weekly caps, replay-safe receipts and existing loan repayment. Keep paid purchases cosmetic. |
| 5 | A shared rivalry | Add a private friend-versus-friend win history, best comeback and seasonal trophy artwork. The match outcome and a rematch are the return loop; there are no wagers or required streaks. |

Start with a playable friend duel and test whether two people want a rematch before adding rewards. The existing twelve-card deck proposal already supplies concrete choices and can run without photos or additional Sparks storage. Then add counterplay cards and a bounded Aura budget; evaluate rewards against the current 45–180 Aura spell prices before setting numbers. This follows the earlier rejection of prompt packs, Hunter Runs and rewards for chores. No random paid rewards, wagers or trivia are proposed.
