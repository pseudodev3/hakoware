# Mobile cues and page hierarchy

The reported mobile problem was a cue playing once, with later moves silent. The iPhone/iPad player previously sought through one WAV sprite and used a wall-clock timer plus `timeupdate` to pause each slice. Delayed seeks or buffering could make that pause arrive before the intended cue finished.

Mobile now reuses the same gesture-activated media element with a complete WAV for each cue. Source changes start at zero and native endings stop playback, with no sprite seeks or cutoff timers. The existing cue definitions and quiet volume are retained. The generator produces ten short cues and one silent activation clip; the old sprite is removed. Desktop and Android keep Web Audio. Sounds remain opt-in, with account isolation, mute/visibility cancellation, cooldowns and event deduplication.

Arena has one page title followed by plain labels for open tables, groups, friends and recent rounds. The repeated lobby introduction and slogans are removed. Daily Aura progress stays visible; full reward conditions and Aura moments share one disclosure. Card-back controls use the selected design and a short Change action with an accessible label.

Circle, You, the bank, shop, connections and Sparks use shorter headings and less repeated introductory copy. Shared page headings no longer have an unused eyebrow layer. Circle's title precedes invitations and its New Duo action stays beside the title on phones. Landing section labels are trimmed while preserving the hero and page flow. Existing SVG card artwork and interface icons remain, with one small coin mark for play rewards.

Borrowing, repayment, prices, privacy controls, rules and paused Sparks behavior remain accessible. Bank text now includes game rewards among the earnings that help repay a loan. There are no database changes or new services.

## Verification

- Thirteen audio checks cover activation, later cues after native endings, delayed playback, blocked-playback recovery, mute/account/visibility boundaries, cooldowns, quiet peaks and complete WAV files. Five session-boundary checks and six duel-outcome assertions pass.
- Production build and public prerendering pass. SEO and UI checks pass. Lint reports zero errors; the repository's warning classes remain.
- Real local APIs and disposable standalone MongoDB: complete six-turn duels and twelve-turn four-player rounds at 390px/dark, 320px/light and 1280px/dark. These exercise move controls, results/rewards, card backs, reconnects, rematches/new opponents and sound settings. Mobile-path media clips play repeatedly on one element and reach native endings.
- Profile, customization, loan review, shop detail, Circle filters, connections and paused Sparks checked at 320px, 390px and 1280px in both themes with controlled API fixtures. No horizontal overflow or runtime errors observed.

Browser checks use Chromium with touch, iPhone user agents and safe-area dimensions for the mobile path. Physical iPhone/Safari playback still needs confirmation after deployment. No production accounts, purchases or game records are created by these checks.
