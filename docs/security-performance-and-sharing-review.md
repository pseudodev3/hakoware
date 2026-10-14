# Security, scaling, sounds and share cards — October 14, 2026

The review found and fixed password-reset and account-switching races, excessive partner lookups, unbounded public board responses and outdated frontend tooling. It also replaces the four share-card layouts and gives the existing opt-in sound system distinct, quieter cues.

## Security changes

- A password reset now consumes its token, changes the hash and increments the session version in one conditional account update. Concurrent requests cannot both commit, and expiry is checked again after hashing. An old reset-email failure cannot delete a newer reset link.
- Signup and password resets reject non-string passwords and passwords exceeding bcrypt's 72-byte UTF-8 boundary. Existing login behavior remains compatible with earlier accounts. Signup/reset email input is bounded at 254 characters.
- Authentication accepts only the HS256 JWT algorithm Hakoware issues. Password resets continue to revoke prior sessions.
- Late API responses are rejected after a token change. Cleared/deleted caches cannot be refilled by old requests, including failures or loaders that have not started. Another tab's login/logout clears local private state and reloads the correct session.
- Frontend installs now use a committed lockfile. Vite 6.4.4 and React plugin 4.7.0 replace the affected older tooling. Full frontend and backend audits report zero known vulnerabilities at review time. The committed-secret pattern check and tracked-environment-file check found no matches.

## Scaling and cleanup

- Circle loading queries only active/pending Duos, refreshes at most eight contracts concurrently and batches participant population. A 64-Duo fixture requires two partner queries rather than two per Duo.
- The public debt board calculates/group debt in MongoDB and returns the top 50 eligible players. Privacy and test-account filters apply before ranking; privacy changes apply on the next request. The UI states the limit. Existing debt arithmetic is preserved.
- Concurrent world-activity reads share one recovery sweep within an API process. The worker's pruning and subsequent recovery still run.
- Arena, Sparks, You and Founder views load when opened, with a loading state and a reload action on failure. Navigation can still return to Home if a view's chunk fails. Initial JavaScript fell from about 746 KB to 619 KB (17%); initial CSS fell from about 240 KB to 157 KB (34%). These are local minified build sizes, not measured production latency. The remaining large entry-chunk warning is recorded.
- Removed the unused SelectMenu component/styles, obsolete canvas stamp renderer, duplicated export drawing code and dormant Nen mutation endpoint. Historical fields and compatibility routes that still have callers remain; no data deletion or index migration is introduced.

## Sounds and share cards

Game sounds remain off until enabled at **You → Account → Game sounds**. Cards have a short soft tap, bank/exchange actions use warm paired tones, milestones use short harmonies and Flares use a gentle rising cue. All voices use a soft attack/release and low-pass filter. A 900ms cooldown, event deduplication and account ownership prevent stacked/repeated playback. Muting and hidden tabs silence cues.

Offline browser renders put peak amplitude between 0.014 and 0.021 and audible duration between 0.146 and 0.444 seconds. Device speakers, user volume settings and perceived loudness still need a physical-device check; these measurements are not acoustic sound levels.

All images export at 1080 × 1350. Duo cards emphasize the earned level and selected identity, weekly recaps use paper surfaces with real stats, season recaps add the existing grade, and Chaos cards prioritize the current challenge. Shared helpers fit/wrap long text and emoji, with ellipsis when content cannot fit. Exports use `hakoware.xyz`, contain no decorative double-slash separators and do not depend on downloading a stamp image. The recap's on-screen heading and copied share text also lose the separators. Native sharing, text fallback and cancellation keep their existing behavior.

- [Duo card](share-card-evidence/duo.png)
- [Weekly recap](share-card-evidence/weekly.png)
- [Season recap](share-card-evidence/season.png)
- [Chaos card](share-card-evidence/chaos.png)

## Validation and limits

The production build, backend syntax, lint and 41 frontend checks pass. Lint has zero errors and 417 warnings under the existing JSX configuration. All 21 backend check suites pass, including private payloads, request/CORS guards, the new security/scaling suite, friend spaces, cosmetics/payment confirmation, bank receipts, card trades, public Flare delivery and Sparks' actual storage/index guards. The new cache/session and security/scaling checks run in CI.

Browser validation uses disposable/local fixtures. Thirty exported-image cases cover all palettes/covers, long names, emoji, large metrics, empty data and in-progress seasons; text remains within the image with no overlapping labels. All seven audio cues render with bounded peaks/durations, deduplication, cooldown, account ownership, mute and hidden-tab guards. Existing six viewport/theme UI flows and 12 installed-app/keyboard layout cases pass. Native-share button flows run on mobile/desktop; cross-tab switching/logout and failed deferred chunks are checked separately.

No production database, provider configuration or real payment was used. This is a source review and local regression pass, not a production load test or guarantee against every attack. Recovery coalescing and rate limits remain per process; a multi-instance VPS rollout needs shared rate limits/job coordination and suitable indexes. Railway trial storage still blocks Sparks publishing; its disk safeguards remain intact. Live deployment and native iPhone audio/share behavior are unverified.
