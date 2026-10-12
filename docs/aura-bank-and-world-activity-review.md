# Aura bank and shared activity

The You page now includes a private Aura bank. Activity has two keyboard-accessible tabs: **For you** and **Around Hakoware**. The existing bell badge combines personal unread items and new public activity.

## Borrowing and repayment

- Borrow 25, 50, or 100 Aura from the system bank, with one outstanding loan and seven days between loans. Borrowing requires a balance of 50 Aura or less and an accepted Duo where both people have completed a valid check-in after the season started.
- There is no interest, fee, repayment deadline, or late penalty. The confirmation shows the amount received and the total owed.
- Half of future daily bonuses, Chaos bonuses, and bounty rewards repays the loan, rounded up to whole Aura and capped at the remaining debt. Refunds, returned hunter bonds, welcome bonuses, and transfers retain their existing behavior.
- Players can repay early from their balance. Loans and repayment never change relationship debt or the Shame Board; borrowed principal does not increase Aura rank.
- Balance, bank debt, and a private durable receipt commit in one atomic account update. Same-key retries cannot repeat a loan, repayment, or earning. Ledger recovery can run after an outage without blocking bank reads. Existing earnings ledger links are preserved.

## Public moments and private conversations

The board contains the last seven days of new Signal Flares, Duo level-ups, completed seasons, and claimed bounties. Pages are chronological and bounded. Background updates wait behind a visible update button, with empty, retry, earlier-page, and caught-up states.

New Flare use explicitly announces the sender to all players. Its recipient and contract remain private, and the original recipient still receives personal activity linking to the Flare in their friend space. Historical Flares are not republished. An atomic cooldown reservation preserves cards for losing concurrent requests; a durable delivery receipt repairs the public and personal activity after an outage.

Duo and season moments are anonymous. Bounty hunters follow the existing public privacy setting, checked again when the board is read. Bank balances, bank debt, friendship IDs, targets, messages, and raw event metadata are excluded. Founder Lab activity remains within its owner's test scope and is removed by Lab reset.

Public rows expire after seven days. Read acknowledgement is scoped to the signed-in player and real board IDs; it cannot clear another player's or another scope's badge. The board does not create a notification document or email for every account.

## Sparks production repair

The startup error was reproduced with an existing unrelated Notification index. Sparks reads had awaited Notification model initialization, so that index conflict blocked the entire feed. Commit `836bf29` is already pushed to `main`: reads no longer depend on index setup, writes create only the Spark notification indexes, and the regression preserves historical indexes. The standard mobile-web-app-capable meta tag is also present.

The reported Permissions-Policy feature names do not appear in the repository's policy. Those browser warnings are separate from the API failure. Production Railway access is blocked from this workspace, so live deployment and the production response have not been verified.

The October 13 follow-up Railway log identifies a separate publishing failure: MongoDB has 232,271,872 bytes available, below the 524,288,000-byte minimum for index builds. Its attached volume needs more capacity, with at least 1 GB free recommended. Retrying cannot fix that infrastructure limit.

Spark write setup now prepares only the model and notification constraint required by each operation. It reissues index creation after a failed attempt instead of awaiting Mongoose's permanently cached initialization rejection. Low storage has an explicit public error; reads and removal do not await new indexes. The activity board also retries failed index setup, then republishes its durable pending events. No production disk threshold is changed and no data or legacy indexes are removed.

## Verification

- Production build and whitespace checks pass. ESLint reports zero errors and 359 warnings under the existing configuration.
- All 11 frontend checks and the existing eight backend suites pass. The new bank, world activity, and Sparks existing-index suites pass and are included in CI.
- Bank checks exercise concurrent loan, earning, and repayment retries; repayment bounds; mutual activation; cooldown; gross earnings versus borrowed principal; ledger outages; readable committed balances; private payloads; and account ownership on standalone MongoDB.
- World checks exercise actual Flare card use, simultaneous cooldown attempts, retained losing cards, notification and board outages, concurrent delivery recovery, historical Flare exclusion, private recipients, anonymous milestones, current privacy settings, live/test isolation, badge acknowledgement, tied-timestamp pagination, and the retention window.
- The storage recovery suite triggers MongoDB's actual disk-space error in an isolated instance, restores its original threshold, and verifies same-process Spark and world-event recovery. Concurrent retries preserve one post, one reply, and one notification per action. Legacy index checks also cover operation isolation during a reply-index outage. Both suites run in CI.
- Local Chromium exercises a lost loan response after server commit followed by the same retry, a real card purchase and Flare use, visibility from a player outside the sender's Circle, automatic and manual repayment, wallet refresh, keyboard tabs, badge acknowledgement, and focus restoration.
- Bank, borrowing, repayment, and board layouts pass at 320, 390, and 1280 pixels in both themes: 24 rendered cases without horizontal overflow or unexpected browser errors. A reduced visual viewport simulation checks the repayment input, reachable confirmation, Escape, focus restoration, and viewport cleanup.

Screenshots contain disposable local accounts. Fixture accounts, their contract, and associated records are removed after verification. Physical-device keyboards and production deployment are outside the local checks. Deploy the feature's frontend and backend together. Retention improvement has not been measured in a live cohort.

## GitHub attribution

Repository-local Git identity now uses `63957220+pseudodev3@users.noreply.github.com`, matching the repository's earlier credited commits. The Sparks hotfix and new feature commit use this identity. The previous three commits retain their old email; main history has not been rewritten.

## Review images

- [Bank on desktop](aura-bank-world-evidence/bank-1280-dark.png)
- [Bank on mobile](aura-bank-world-evidence/bank-390-light.png)
- [Loan confirmation at 320 pixels](aura-bank-world-evidence/loan-320-light.png)
- [Public activity on mobile](aura-bank-world-evidence/world-390-dark.png)
- [Public activity on desktop](aura-bank-world-evidence/world-1280-light.png)
- [Repayment with a reduced visual viewport](aura-bank-world-evidence/repay-keyboard-simulation.png)
