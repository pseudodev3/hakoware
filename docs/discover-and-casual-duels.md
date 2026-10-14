# Discover and casual duels

Circle now has Duos, Discover and Connections. Discover is off by default. A person can share a 160-character bio, up to four interests and an intent (games, conversation or accountability), alongside their existing name, handle and avatar. Email, user IDs, Aura and account internals are excluded from Discover responses. Browse uses a handle cursor and returns twelve people at a time. Live accounts and Founder Lab test accounts remain isolated.

Choosing a duel opens a table for review; sending the invitation is a separate action. Accepting a game deals the same free twelve-card deck used in friend duels. It never creates a Friendship, starts a season, changes Aura, spends inventory or grants chat access. Stranger invitations are limited to five per hour and five pending games, with a day’s pause after declining, cancelling or leaving a round. Idle games expire after seven days.

A connection also needs a recipient’s explicit acceptance. Only connected participants can read or write text messages. Chat stores messages separately and pages thirty at a time, with earlier messages available. Starting a Duo opens the existing contract invitation flow, prefilled with the connected person; it still requires that person to accept.

Block/report controls appear on Discover profiles, casual duels and connection conversations. Blocking removes casual contact and does not restore chat automatically on unblock. Blocked people can be managed from the Discover profile section in Circle or You. Existing Duos retain their own contract controls. Reports appear in the founder-only review queue at `/founder`; reviewing a report does not automatically penalize an account. The queue excludes test-account reports. Founder access uses the existing `FOUNDER_EMAILS` configuration.

## Storage and retries

The connection pair and its casual room use deterministic primary IDs. New secondary indexes improve reads but are not an availability or correctness requirement. This keeps the feature usable while Railway storage prevents background index builds. No transactions or Sparks readiness checks are required.

Acceptance, message authorization, revision checks and durable delivery jobs commit together on the connection document. A lost response or delivery outage can replay the same receipt without creating another message. A block competes against that same consent revision and queues room closure; a room revision barrier also prevents an already-authorized invitation from opening after a block. Browser retry keys are scoped to the account and action, with an in-memory fallback when session storage is unavailable. Reads recheck membership after loading messages, and activity acknowledgement only clears the observed revision.

Turning off Discover stops new stranger invitations and requests. Existing connected conversations and accepted games remain available. New connections are excluded from Discover. Message and report text are rendered as text, never HTML. Notifications contain message metadata rather than message contents.

## UI corrections

The lime close-button outline came from dialog autofocus being treated as `:focus-visible` following a touch. Input modality now suppresses control outlines after a pointer action while preserving keyboard focus and text-input focus.

The lobby-to-duel crash came from rendering a lobby response as a room response during navigation: lobby data has no `partner.displayName`. Arena now mounts duel state by account and room, so changing opponents resets state before the room render. Private views also reset when the account changes. Revoked room access clears the old board.

Duels add quiet card settling motion, the latest public move, and concrete result explanations (the correct guess, forced-out Oath or actual final ranks). Reduced-motion preferences and the existing opt-in sound settings remain respected. Aura betting is not included.

## Verification

- Production build and public prerender; all eight frontend checks, including six deciding-move cases; lint with zero errors; dependency audits with zero vulnerabilities.
- All twenty-four backend checks, including new `check:people`, plus backend syntax checks.
- Standalone Mongo integration with new secondary indexes disabled: opt-in/privacy, scope, cursors, casual invitation/acceptance, unchanged economy, mutual chat consent, durable retries, message pagination, founder reports and block/unblock.
- Deliberately held writes prove a block prevents an already-authorized new invitation and a message from committing afterward. Lost block responses are replayable.
- Two-account browser flows at 320, 390 and 1280 pixels, both themes and installed-app safe areas. Checked touch/keyboard focus, real games, explicit Duo invitations, escaped message text, uncertain delivery with both working and full session storage, and report/block/unblock.
- Existing friend-duel browser flow at eight size/theme/safe-area combinations, including repeated lobby-to-player navigation without a reload, real six-turn play, private peeks, rematches and conversation return.

Browser evidence: [mobile Discover](discover-evidence/mobile-discover.png), [installed conversation](discover-evidence/installed-conversation.png).
