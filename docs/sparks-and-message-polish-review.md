# Sparks and friend-space message polish

After Hours has been replaced in the app by Sparks: photos, short thoughts, reactions, and replies shared with accepted friends. The room question, side-picking game, presence roster, anonymous posting controls, callouts, and room challenges are removed from the active interface. Home includes recent Sparks and the landing describes the new feature.

## Friend-space messages

- A single tick means the server saved the message. Double ticks mean the recipient viewed it in the friend-space timeline. Read acknowledgement is restricted to incoming messages in the active contract; viewing the contract disclosure, offscreen history, hidden tabs, or an inert background does not mark those messages read.
- Historical messages receive read receipts when viewed again. The previous notification-read flag does not supply a historical message-read timestamp.
- The composer has one cohesive surface, an expanding text field, clear focus treatment, emoji insertion, and 44-pixel voice/send controls. Desktop Enter sends; Shift+Enter inserts a new line. Touch keyboards keep Enter for a new line.
- Sending and unconfirmed delivery appear in the timeline. Retrying uses the same message key, including after reload, so a lost response cannot create a second copy. A changed draft is preserved while an earlier message sends.
- Text drafts and retry keys are scoped to the signed-in account and contract. Voice recording and the existing check-in/progression rules remain available.

## Sparks and the return loop

1. Share a photo or a thought of up to 280 characters with accepted friends.
2. Friends react or reply; Activity opens the exact Spark and reply.
3. Continue in the thread or open the existing private friend space with the author.

The feed is chronological and bounded, with manual earlier pages and a caught-up state. New moments wait behind a visible update button during background refresh. Counts reflect real reactions and replies. Reactions can be changed or cleared, and do not change Aura or Duo progression.

Posts and photos are accessible only to their author and the author’s accepted friends in the same live/Founder Lab scope. Removing a friendship revokes feed, thread, and photo access. The photo endpoint requires authentication and checks membership on each request; storage keys and public bucket URLs are excluded from payloads. The app prepares photos as resized JPEGs, preserving aspect ratio and removing original file metadata during browser conversion.

Replies share the post’s audience. Authors can remove their own Spark, its photo, replies, reactions, and associated notifications. Post and reply retry keys, unique indexes, and recoverable notification delivery protect against duplicate writes. Founder Lab reset includes Spark records and photo cleanup.

The reply composer stays in the dialog footer and expands with its draft. Mobile dialogs adapt to the visual viewport. Loading, unavailable media, retries, empty circles, deletion confirmation, focus trapping, and focus restoration have explicit UI states.

## Legacy compatibility

The old frontend room component, styles, and service module are deleted. Old room/wall URLs and notifications open a migration notice in Sparks. A still-live linked post or reply can be read under its original room visibility, including anonymous author protection. The previous question game is not rendered. Existing backend room endpoints and stored records remain compatible; room data is not silently converted into private-circle posts or deleted.

## Verification

- Production build, relative import resolution, and `git diff --check` pass. ESLint reports zero errors; warnings remain under the current configuration.
- All 11 frontend checks and all eight backend suites pass. The new `check:sparks` suite is included in CI. It covers circle/scope isolation, authenticated photos, access revocation, upload/reaction/reply retry recovery, notification destinations, pagination, anonymous legacy links, unchanged Aura, and owner cleanup. Friend-space checks cover recipient-only, stable read timestamps.
- Local Chromium verifies photo sharing through the real local bucket, reactions, replies, exact Activity links, private-circle visibility, conversation return, anonymous legacy links, draft recovery, Enter/multiline/emoji controls, and real two-account read ticks.
- A simulated lost response after server commit followed by reload/retry creates one message. Receipt checks keep offscreen and disclosed-contract messages unread until viewed, including messages taller than the viewport.
- Home, Sparks, post composer, thread, and conversation pass at 320, 390, and 1280 pixels in both themes: 30 rendered cases with reduced motion, no horizontal overflow, and no unexpected browser errors. The final reply dock has six additional captures and checks. A reduced visual viewport simulation verifies the reply dock fits while long drafts expand.
- The previous public/onboarding browser suite passes: six public viewport/theme combinations, demo/authentication, mode carry-through, invitation/acceptance, both first check-ins, return guidance, and four conversation combinations.

Local fixture accounts, contracts, Spark photos, and associated records are removed after verification. Browser harnesses and full captures remain in `/workspace/hakoware-dev`. Screenshots use clearly synthetic fixture artwork and local test accounts. Physical-device keyboards, HEIC decoding, and production deployment are not covered by these local checks. This feature includes both frontend and backend changes and must be deployed together.

## Review images

- [Sparks desktop](sparks-evidence/sparks-1280-dark.png)
- [Sparks mobile](sparks-evidence/sparks-390-dark.png)
- [Friend-space composer and ticks](sparks-evidence/conversation-390-dark.png)
- [Post composer, light theme](sparks-evidence/composer-390-light.png)
- [Reply dock at 320 pixels](sparks-evidence/thread-320-light.png)
- [Home with recent Sparks](sparks-evidence/home-1280-dark.png)
- [Reduced visual viewport simulation](sparks-evidence/thread-keyboard-simulation.png)

The intended retention measure is a later-day return prompted by a real friend’s Spark or response, followed by a reply or private conversation. No retention lift is claimed before live cohort measurement.
