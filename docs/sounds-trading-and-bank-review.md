# Game sounds, card exchange, and Aura bank

Card exchanges now work on standalone MongoDB. The old mutation path required replica-set transactions and returned “Trading is temporarily unavailable” when MongoDB rejected them. The new path reserves individual copies durably, finishes accepted swaps after interruptions, and does not depend on building secondary indexes. The existing offer, accept, counter, decline, cancel, and seven-day expiry flow remains available between accepted friends.

## Card exchange

A reservation removes one copy and records its receipt in the same account update. A trade can move from open to accepting or closing once. The recipient reserves the requested copy before acceptance; a missing copy leaves the offer open. Cancellation writes terminal receipts for both participants, including a recipient who has not reserved yet, so a late request cannot take another copy after the cancellation finishes.

The two accounts settle in separate durable steps. During an interruption, a trade may be finishing until its remaining delivery is recovered; this does not provide a multi-document transaction. Requests, collection reads, and the background worker finish the stored decision. Individual recovery failures do not block other players' jobs. Inventory credits, refunds, notifications, and accepted-trade timeline events deduplicate using durable receipts or stable primary IDs.

Legacy pending offers are adopted without removing the sender's reserved copy again. Existing completed history, card designs, prices, inventories, and secondary indexes remain intact. New failed preparations do not appear as completed exchanges. Ten open offers and one identical offer per partner/card pair are enforced even without secondary unique indexes. Aura never changes hands in an exchange.

Offer sheets now preview both illustrated cards before confirmation. Offers show larger artwork, and a finishing exchange disables answer buttons until it settles. Retried requests report the returned trade status rather than claiming that an already-settled offer was just sent.

## Aura bank

The bank now has a gold credit panel, a separate wallet balance, actual repayment progress, quick partial-repayment choices, a borrowing checklist, private recent activity, and readable tier layouts down to 320 pixels.

| Tier | Limit | Unlock |
| --- | --- | --- |
| Starter | 25 Aura | Initial tier; borrowing still requires a mutual check-in. |
| Connected | 50 Aura | Actual Duo Level 2 or one completely repaid loan. |
| Trusted | 100 Aura | Actual Duo Level 5 or three completely repaid loans. |

Earned limits persist after a Duo ends. Historical loans preserve the limit already granted to that player. Active loans retain their existing terms. Borrowing still requires an accepted Duo with mutual valid check-ins, a wallet balance of 50 Aura or less, a cleared prior loan, and seven days since the last loan. There is one outstanding loan at a time, with no interest, fees, repayment deadline, or late penalty.

Half of daily bonuses, Chaos bonuses, and bounty rewards repays the loan, rounded up and capped at the remaining balance. Refunds and returned bonds retain their existing behavior. Progress and completed-loan counts derive from committed private account receipts, so retries and ledger outages cannot manufacture repayment milestones. Borrowed principal does not increase Aura rank.

Bank ledger entries now use stable primary IDs while preserving existing random-ID entries. This avoids duplicate journal entries when the trial plan cannot build the external ledger's unique index. A lost full-repayment response can be confirmed with the same request key even after the bank balance refreshes to zero in the same session. Confirmation previews distinguish the current balance from a new payment preview.

## Sounds

**You → Settings → Game sounds** controls quiet, short synthesized cues for card purchases/use, accepted exchanges, bank actions, Flare reveals, Duo levels, and season completion. Sounds start off, require a real interaction to unlock playback, and stay scoped to the account on that device. There is a preview button. Desktop and Android synthesize cues with Web Audio; iPhone and iPad use small generated WAV clips on one activated media element. There is no looping music or autoplay.

Duplicate event cues are suppressed while the app is loaded; existing reveal history still suppresses repeated automatic game moments. Muting, leaving the account, or hiding the tab stops active cues. Unsupported audio contexts fail quietly. Audio availability and perceived volume on physical devices have not been checked here.

## Verification

- Production build and whitespace checks pass. ESLint reports zero errors and 393 warnings under the existing configuration; the existing bundle-size warning remains.
- All eleven frontend checks pass. Existing client-payload, friend-space, presentation, card/wall, purchase, world-activity, trial Flare, and server-hardening suites pass.
- The new standalone exchange suite runs with MongoDB's actual disk guard blocking index builds throughout and confirms only primary indexes exist. It covers concurrent creation/answers, interrupted preparation/acceptance/second delivery/refunds, a late reservation after cancellation, counter races, legacy adoption, expiry, ended Duos, duplicate pairs, the ten-offer cap, notification/history outages, worker failure isolation, authentication, and private payloads. It is included in CI.
- Extended bank checks cover actual tier gates, concurrent repayment completion, retained credit limits, existing loan progress, and concurrent loan/earning journals with the real disk guard blocked and only the primary ledger index available.
- Three-account Chromium flows verify actual reservations, acceptance, counters, cancellations, partial/full repayments, cooldown, sound preferences, account switching, real bank/trade/purchase audio, a lost committed repayment response and same-key confirmation, hidden-tab silence, and unsupported audio fallback.
- Nine views pass at 320, 390, and 1280 pixels in both themes: 54 rendered cases without horizontal overflow or unexpected browser errors. Focused checks also cover narrow tier readability, a reduced keyboard viewport, reachable confirmation, Escape, focus/inert cleanup, and viewport cleanup.

Review images use disposable local accounts. Their accounts, contracts, trade/purchase records, notifications, events, and Aura records are removed after verification. Physical-device keyboards and production rollout have not been verified. Deploy the frontend and backend together. Sparks publishing remains deferred until the planned VPS move; production disk thresholds are unchanged.

## Review images

- [Bank on desktop](sounds-trading-bank-evidence/bank-focused-1280-dark.png)
- [Bank on mobile](sounds-trading-bank-evidence/bank-focused-390-light.png)
- [Tier layout at 320 pixels](sounds-trading-bank-evidence/tiers-focused-320-light.png)
- [Repayment confirmation](sounds-trading-bank-evidence/repay-390-dark.png)
- [Borrowing choices](sounds-trading-bank-evidence/borrow-390-light.png)
- [An incoming offer](sounds-trading-bank-evidence/offers-390-dark.png)
- [Counter-offer preview at 320 pixels](sounds-trading-bank-evidence/offer-editor-320-light.png)
- [Confirming a lost repayment response](sounds-trading-bank-evidence/repay-lost-response-390-light.png)
- [Sound preference](sounds-trading-bank-evidence/sound-preference-390-dark.png)
