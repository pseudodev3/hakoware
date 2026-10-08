# Social return flow review — 2026-10-08

Captured and inspected the current main frontend before editing, then reviewed the completed local implementation. Source baseline: `6ef2ff767d07c5ab43b48f5e896e200b3ad9f14b`. Public Sans, the ink/paper/lime palette, original card artwork and the relationship-first model remain.

## Journey health

1. **Home -> friend -> reply -> Back: improved.** Compact conversation rows expose three friends at 390×844; ordinary cards measure 133–140.5px across inspected fixtures. Critical danger remains first. Messages retain the preview when a routine check-in arrives. The supporting activity list retains older/off-card replies. Healthy contract detail no longer takes the first line of an already-checked conversation.
2. **Invitation -> acceptance -> first conversation: repaired.** Both Home and Circle open the exact newly ACTIVE friendship after refresh, even when it is not the first returned item. Refresh failure has a Circle fallback.
3. **After Hours -> thread -> return later -> friend conversation: improved.** Posts stay interactive for 48h; public authors and participants can continue replying. An owner follow-up creates in-app Activity for the most recent other replier. Exact post/reply URLs resolve beyond feed/page limits, survive conversation navigation and reopen the right thread on Back. A quiet room no longer implies another person is present.

## Findings and changes

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | After Hours service/routes | Social posts and reply mutations stopped after 3h; one reply per person; public author blocked | 48h social window and multiple flat replies, including public author follow-ups | Two people visiting at different times can continue an actual conversation |
| HIGH | Reply route / Activity | Reply notification could fail independently; no client delivery retry identity | Stable keyed replies, private delivery state, persisted reciprocal recipient and exact reply destination | Retry confirms the same reply without normal duplicate Activity, read resets or resurrecting dismissed updates |
| MEDIUM | Home / shared FriendCard | Repeated identity, preview, Open conversation row and footer consumed phone height | Compact single conversation target plus separate check-in/recap; meaningful message preview | More friends are visible and the main action has a clear hierarchy |
| MEDIUM | Home activity | Supporting updates above roster repeated current message previews | Activity below conversations; deduplicate exact displayed message IDs only | The roster is primary while older and off-card updates remain accessible |
| MEDIUM | FriendSpace | Small messages/timestamps; healthy status competed with conversation | 16px text/composer, 13px times, round avatar, actionable health only | Easier reading and a quieter conversation surface |
| MEDIUM | Home/Circle acceptance / App | Successful acceptance returned to Home | Open exact refreshed accepted friend | Acceptance leads directly to the relationship |
| MEDIUM | After Hours layout | Large presence tiles and permanent multi-mode composer ahead of posts; repeated four-emoji reply controls | Small people chips, Share sheet, readable posts, two reply previews, focused threads and intentional React picker | Conversation content earns emphasis; secondary choices are still reachable |
| MEDIUM | After Hours focus/pagination | Activity could disappear outside newest feed/replies; stale snapshot could mark a valid target unavailable | Scoped exact lookup; matching-response focus; chronological 20-reply pages; recover real pagination gaps without resetting overlapping progress | Returning to an update reaches the intended conversation |
| MEDIUM | After Hours drafts/expiry | Pending send could erase edited text; anonymous mode was hidden; expired open thread stayed actionable | Pending controls freeze, failed drafts/keys survive; visible identity status; expired snapshot remains readable with disabled mutations | Publishing identity and delivery state stay understandable |
| LOW | After Hours loading/presence | Quiet polling could supersede initialization and leave a spinner; viewer counted as another visitor | Latest success/failure settles loading; count excludes viewer, no self tile | Empty and slow states reflect the actual room |

## Accepted screenshot evidence

These are fresh local Chromium captures with intercepted synthetic Mika/Rin/Kai/Nia accounts. They establish layout and client interaction behavior, not authenticated production delivery. Images were inspected visually, with DOM/accessibility snapshots and request logs alongside them.

| Surface | Before | After |
| --- | --- | --- |
| Home, 390px dark | `/workspace/shared/hakoware-current-audit/01-home.png` | `/workspace/shared/hakoware-social-return-after/01-home.png` |
| Conversation, 390px dark | `/workspace/shared/hakoware-current-audit/02-conversation.png` | `/workspace/shared/hakoware-social-return-after/02-conversation.png` |
| After Hours, 390px dark | `/workspace/shared/hakoware-current-audit/03-after-hours.png` | `/workspace/shared/hakoware-after-hours-final/after-hours-390-844-dark.png` |
| Focused replies | `/workspace/shared/hakoware-current-audit/03b-after-hours-thread.png` | `/workspace/shared/hakoware-after-hours-final/thread-390-844-dark.png` |
| Quiet room | `/workspace/shared/hakoware-current-audit/05-after-hours-quiet.png` | `/workspace/shared/hakoware-after-hours-final/quiet-missing-target.png` |
| Desktop room | Baseline capture script/snapshots | `/workspace/shared/hakoware-after-hours-final/after-hours-1280-844-dark.png` |
| Small light posting sheet | Baseline full composer | `/workspace/shared/hakoware-after-hours-final/post-draft-320-600-light.png` |
| Supporting activity | Baseline Home snapshot | `/workspace/shared/hakoware-integration-check/final-pulse-under-roster.png` |

Harnesses and full results are preserved in `/workspace/shared/hakoware-current-audit`, `/workspace/shared/hakoware-after-hours-final`, `/workspace/shared/hakoware-social-return-after` and `/workspace/shared/hakoware-integration-check`. Earlier failing harness selectors were corrected; final results supersede those exploratory runs.

## Verification and limits

- Production build and circle-activity checks pass. Full lint has zero errors; existing warnings remain. Production dependency audits report zero vulnerabilities. Diff whitespace checks pass. Existing large-bundle warning remains.
- New authenticated real-Mongo `check:after-hours-social` and existing friend-space, payload, hardening, mutual-activation, cards/wall and standalone purchase checks pass. Social tests cover same-key races, notification outage recovery, stable reciprocal recipients, read/dismiss preservation, anonymous/test-scope privacy, live-parent expiry, 45 tied-timestamp replies across 20/20/5 pages, exact focus outside 90/20 limits and original one-Aura Spark accounting. No economy faucet was added.
- Browser fixtures cover 320×600, 390×600, 390×844 and 1280×844 in light/dark and reduced/normal motion, loaded Public Sans, no horizontal overflow, 44px primary controls, modal keyboard/focus restoration, draft/retry/edited-key behavior, overlap/disjoint pagination, acceptance, room/thread return, existing/pending person sheets and existing social request payloads.
- Physical iPhone/Safari keyboard, microphone, live authenticated two-account delivery and retention cohorts remain unverified. Existing voice infrastructure was not changed. There is no offline alert flow in this pass.
- The Spark schema removes a redundant plain index declaration while retaining its explicit 48h TTL. Fresh test database initialization passes; production legacy index state was not inspected or migrated.

This removes concrete barriers to replying and returning. It does not prove retention is fixed. The useful next measurement is both participants becoming active, exchanging a reply, then returning to that relationship on another day; the current founder activation count is not a D1/D7 cohort. No additional analytics or card-duel implementation is included in this pass.
