# Friend card duel — proposed v1

Selected for exploration on 2026-10-06. No game code or new Arena screen is implemented. These rules are a concrete version to try with two people, not a claim that balance or retention has been proven.

## What you do

Play a short hidden-hand card round with one accepted friend. On each turn you have two cards: choose one to play, keep the other secret. You can learn their hand, protect yourself, swap hands, force a redraw, or guess what they are holding. A correct guess wins immediately; otherwise the higher held rank wins when the deck runs out.

The match deck is free and separate from the purchased collection. Use the existing shaded card artwork with a clear Duel label and round-specific effect. Purchased cards do not grant power or get consumed. No Aura wagers, XP rewards, daily tasks, contract debt or required streaks.

## The shared twelve-card deck

| Card | Copies | Held rank | When played |
| --- | ---: | ---: | --- |
| Signal Flare | 4 | 1 | Guess their held card, excluding Signal Flare. A correct guess wins the round. |
| Watcher | 2 | 2 | Privately see their held card at that moment. They know you looked. |
| Ghost | 2 | 3 | Block opponent-targeted effects until the start of your next turn. |
| Clean Slate | 2 | 4 | Choose either player. They discard their held card and draw a replacement. Discarding Oath loses immediately. |
| Orbit | 1 | 5 | Swap the two held cards. Each player sees their new own card. |
| Oath | 1 | 6 | Highest held rank. Playing or otherwise discarding it loses immediately. |

Ghost blocks an opponent's Flare, Watcher, Slate and Orbit. It does not block self-Slate or the final comparison of ranks. You may play a blocked card: it is publicly discarded and has no effect. Protection ends before its owner's next draw.

## A round

1. Invite an accepted friend; shuffle and deal only after they accept. Each holds one card; set aside two unseen cards, leaving eight in the draw pile. The invitee starts the first round; rematches alternate the starter.
2. At the start of the active player's turn, clear their old Ghost protection and draw automatically. They choose which of their two cards to play and any required target/guess. The other remains hidden.
3. Resolve the effect. A correct Flare guess or discarded Oath ends the round immediately. Otherwise the next player takes a turn.
4. If the draw pile is empty after the action resolves, reveal both held cards. Higher rank wins; equal ranks are a draw. Clean Slate uses a set-aside card for its replacement if the draw pile is empty, then the comparison occurs.

There are at most eight turns; redraws can shorten the round. A round is intended to take a few minutes together, with asynchronous turns available. That duration needs real playtesting. No hidden discard tiebreaker or best-of-three requirement: offer a clear Rematch after each result.

## An actual sequence

The set-aside cards are one Flare and one Watcher. You start with Watcher; your friend holds Oath. The remaining draw order is Ghost, Ghost, Flare, Orbit, Slate, Flare, Slate, Flare.

| Turn | Move | Result |
| --- | --- | --- |
| 1 — you | Draw Ghost; play Watcher | You see their Oath and keep Ghost. They know their hand was seen. |
| 2 — friend | Draw and play Ghost | They protect the exposed Oath. |
| 3 — you | Draw Flare; play it into protection | No effect; you keep Ghost. Playing Ghost instead would protect you but leave you holding rank-one Flare. |
| 4 — friend | Protection expires; draw and play Orbit | They exchange Oath for your Ghost. You now have Oath; both can infer the swapped hands. |
| 5 — you | Draw Slate; use it on them | Their Ghost is discarded and replaced with Flare. You keep Oath; self-redraw would lose it. |
| 6 — friend | Draw Slate; use it on you | Your known Oath is forced out. They win before the last Flare is drawn. |

At turn three, playing Ghost instead changes the outcome against this exact deck: your protection blocks their Orbit, so they keep Oath. Your next Slate then forces their Oath out and you win. Keeping the higher-ranked hand was not automatically the best move.

The best card is vulnerable when exposed. Peeking does not guarantee a later guess: protection, swaps and redraws change what your information is worth.

## How the screens should feel

- Arena gains a Duels destination: incoming invitations and active rounds first, then Start a duel with a friend. Home only shows a return destination when there is a real invitation or turn. A friend conversation can offer Start a duel in its actions.
- The table shows the two people, one face-down opponent card, remaining draw count, public played cards and a compact move history. Your two cards sit at the bottom within thumb reach. Choose a card, read its short effect, then confirm; Flare adds a five-card guess choice and Slate adds a target choice.
- Use the existing Public Sans, ink/paper/lime/violet system and original artwork. Keep one primary instruction: Your turn — choose a card, Waiting for [friend], or the result. No simultaneous messages, contract controls and game controls on one board.
- A peek is a dated memory, not a live view of their hand. Show public protection clearly. After a swap/redraw, do not imply that an earlier peek is still current. The result reveals the remaining held cards and decisive discard, then offers Rematch or Return to conversation. A forced Oath discard leaves its owner with no held card.
- Handle the whole small hand during a turn; do not add a separate Draw button, claim button or reward screen. A failed submission keeps the chosen move available to retry.

## Invitations, delays and implementation boundaries

Allow one pending/active round per duo. A declined or cancelled invitation has no penalty. Do not reshuffle an accepted game to fish for a better hand. A round can be abandoned explicitly; an inactive round can be archived after seven days without awarding a win or touching contract state. Show when a move was made and send one notification for a new turn, with a direct destination; do not nag on a timer.

An eventual implementation needs participant-only server-authoritative shuffling, held cards and effects; stable retry keys; serialized turn changes; and an Activity target that cannot clear a newer turn notification from an older view. During play, return only the viewer's own hand, their authorized Watcher snapshots and public events. Do not expose the hidden draw pile or live opponent hand through normal match reads. After the round, reveal the remaining held cards and decisive discard. This is an implementation constraint, not a new product flow.

## What to test before building progression

Try this exact deck with a pair of friends. Check whether either wants to rematch without rewards, whether the two-card choice is understood, and whether asynchronous waiting ruins the pace. A correct opening Flare can end the round before the other player acts; that is a real risk. Conditional on choosing an opening Flare, an optimal guess can hit about 20%; an always-Flare opener can produce such an early result in about 11.5% of initial deals. These are combinatorial estimates, not observed play or retention data.

The next step is a playable rules prototype and voluntary rematch feedback. Do not assume the game solves a circle with no active friend; any practice opponent must be visibly practice. Do not add a shop advantage or progression layer before the basic round proves enjoyable.
