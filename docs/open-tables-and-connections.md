# Open tables and connections

Arena opens on Duels. Friends can keep their invitation-based rounds, and an open table lets two people meet through the same free twelve-card game. Tap **Play someone new** to join the oldest eligible waiting player or open a seat. There is no profile directory, bio, interest filter, intent picker or invented online-player count. Merely visiting Arena does not make someone available.

Both players choose to enter before a round is dealt. Waiting seats have a ninety-second lease, renewed while the waiting screen is visible, and close after at most five minutes. Leave table cancels a waiting seat. A join that already committed takes precedence over cancellation; the resulting round has its existing Leave round control. Idle rounds expire after seven days. Test accounts match only within their own Founder Lab owner scope.

A game never creates a Friendship, begins a season, changes Aura or spends inventory. An opponent sees only the existing name, handle, avatar and avatar frame. Hidden hands, peeks and server deck state retain the existing participant-only protections. The first starter is selected from the match key; later rounds with that opponent alternate starters.

After a completed round, either person can invite the other to connect. Chat opens only after explicit acceptance. Rematches, connected conversations and explicit Start a Duo invitations remain available. Previously saved connections and accepted legacy casual games continue to work. A stranger cannot use a known handle to prepare an unsolicited duel or connection without having played together. Existing invitation limits and post-decline cooldowns remain in place.

Block/report controls remain at the table and in conversations. Blocks in either direction exclude future pairing and revoke casual game/chat access. Unblocking never restores chat consent automatically. Blocked people are managed under You → Privacy and safety. Reports retain the private founder review queue.

## You and navigation

You contains identity, appearance, Duo progress, the Aura balance/bank/ledger, privacy and account settings. The private Signature card picker and collection shortcut have been removed. Appearance previews show the actual equipped frame, backdrop and card finish. The strongest Duo preview lives with its progress, rather than inside the style section. The card collection, purchasing tools and trading stay under Arena → Cards. Home's layout is unchanged; its empty-circle action and Circle's new-player action now point to Duels.

Old Discover URLs open the duel lobby. The old authenticated profile/directory API responds with 410 without returning profiles. Historical Discover data and presentation preferences remain stored for compatibility, but biographies/interests are not displayed, editable or used for matching. Older presentation clients can still save their existing options; the new appearance editor only sends frame, finish and backdrop.

## Storage, races and limits

Each account scope has a bounded queue document with a built-in primary key and an atomic revision. Claiming a pair consumes both seats in one write. A durable pairing journal lets either participant recover a committed match after lost responses or room-initialization failures. Round initialization is also revision-checked and idempotent. A stale journal cannot reopen a superseded round.

Cancellation and joining compete against the same queue revision. Expired seats are checked again at commit. Account-scoped retry keys survive ambiguous requests; an active tab also retains the key when session storage is full or disabled. Match keys include both participants and tickets. Block cleanup competes with the room revision, so an already-authorized initialization cannot open a game after a block wins.

Queue size is capped at 400 seats/assignments per scope; completed assignments are pruned after a short retry window. At capacity, the API returns a deliberately public 503 message. Enter requests are limited to thirty per ten minutes per account. Waiting reads renew a lease only when necessary and never scan or expose the account directory. This bounded queue is intended for the current small community; higher concurrency would need partitioned matchmaking. New secondary indexes, transactions and Sparks readiness are not required, so Railway trial index restrictions do not gate this feature.

## Verification

- Production build and five public prerenders; all eight frontend checks; lint with zero errors (the existing configuration still reports unused-JSX warnings).
- New standalone Mongo `check:open-tables` with secondary indexes disabled: voluntary entry, duplicate/concurrent joins, scope isolation, cancellation/expiry, stale-ticket protection, superseded journals, capacity, startup recovery, block races, unchanged economy and private projections.
- Updated `check:people`: retired browsing, finish-first connection requests, mutual chat consent, durable message retries, pagination, moderation and block/unblock. Existing duels, presentation, payload minimization, server-hardening and security/scaling checks pass.
- Two-account browser journeys at 320, 390 and 1280 pixels, both themes and installed-app safe areas: seat/cancel, automatic pairing, a real deciding move, connection acceptance, chat, explicit Duo invitations, report/block/unblock and no horizontal overflow or render errors. Lost seat and message responses retain their keys with both working and unavailable session storage.
- Eight You layout cases cover both themes, empty Duos, safe areas, appearance/shop dialogs, bank dialogs, privacy, sounds, blocked people and navigation to Circle and Arena's Cards tab.

Evidence: [mobile open table](open-table-evidence/mobile-open-table.png), [You appearance](open-table-evidence/mobile-you-appearance.png), [Duo progress](open-table-evidence/mobile-you-duos.png), [connection conversation](open-table-evidence/installed-conversation.png).
