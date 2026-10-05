# Hakoware revamp review — October 5, 2026

The relationship remains the primary object. The revamp gives people clear routes to talk, collect, exchange and create, using actual account/community state. It adds no XP/Aura earning rules, random packs, fake participants or new challenge loops.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `server/routes/aura.js` | Standalone MongoDB purchases reproduce 500 / “Could not purchase card” | Debit, card and durable retry receipt commit in one User update; external audit repairs idempotently | Atomic delivery and honest retry feedback; prevents double charging |
| HIGH | `server/services/httpError.js` | A deliberately public transaction-unavailable 503 becomes generic 500 | Only explicit public 503 messages leave the server; unknown internal errors stay hidden | Explains unavailable trades while preserving error privacy |
| MEDIUM | `src/index.css`, `src/features/profile/YouView.css` | Mixed system, mono and serif type; warm/gold surfaces everywhere | One self-hosted Public Sans family; ink/paper, lime interaction, violet play, separate semantic states | Cohesion, readable text, clearer hierarchy |
| MEDIUM | `src/shared/components/Layout.jsx` | Circle-only secondary dock and three main tabs | One five-destination dock and desktop sidebar; 44px+ controls | Consistent thumb reach from every main tab |
| MEDIUM | `src/features/home/HomeView.jsx`, `HomePlay.jsx` | Returning users mostly see relationship status | Actual messages, collection progress, incoming offers, recent wall note and free creation routes | Shows things worth doing with a small community; exact offer routing |
| MEDIUM | `src/features/cards/CardCollection.jsx` | Repeated hero hierarchy and no owned filter | Smaller collection header, twelve progress segments, Yours filter, clear card/ownership hierarchy | Easier to find and use a collection; familiar shaded artwork preserved |
| MEDIUM | `src/features/afterHours/RoomWall.jsx` | Add/browse controls below a tall canvas | Sticky toolbar above the canvas, keyboard-accessible author controls retained | Core creation action visible on short phones |
| MEDIUM | `src/features/friendship/components/FriendCard.css`, `FriendSpace.css` | Quiet/read state, previews and actions compete | Clear identity, readable message preview, distinct unread state and check-in action; matching conversation surfaces | Relationships lead, mechanics recede |
| LOW | `src/features/landing/LandingPage.jsx` | Mechanics dominate the product explanation; static world event appears live | Friend spaces, cards and wall examples; static event explicitly labelled an example | Helps new users understand the place and avoids fabricated urgency |

## Verification

- Production build and full lint pass. New font is 26,832 bytes and has its OFL license beside it.
- Real isolated MongoDB 8.0.12 standalone tests reproduce the original error before the fix and pass afterward: all catalog items, concurrent same-key retries, distinct-key overspending, card/key mismatch, insufficient Aura, missing legacy keys, interrupted journal recovery, legacy receipts, replay after consumption, private receipt exclusion and safe standalone trade denial.
- Replica-set cards/wall and friend-space regressions pass: escrow, exchanges, duplicate/concurrent use/accept, refunds, progression boundaries, auth/privacy, wall ownership and archives. Existing circle acknowledgement, payload, activation and hardening checks pass.
- Full-app browser fixtures: 320×844, 390×600, 390×844, 1280×844; light/dark, normal/reduced motion. Five destinations, minimum hit areas, loaded Public Sans, collection filters, lost purchase response/retry key reuse, correct balance after retry, native dialog inert background, Tab trapping, Escape/trigger focus, reachable wall toolbar, Browse, conversation/back, Activity and exact incoming-offer link all checked.
- Captured and visually inspected Home, Arena, wall, profile and landing; empty circle exposes collection and first-mark discovery. Landing entry reaches login and has no page overflow or runtime errors.
- Purchase receipts are deliberately retained privately; the ledger can lag committed delivery during outages and the worker retries every minute. Trades still need a replica set. No economy/progression formula or reward changed.
- Not verified: physical iPhone/Safari, live production purchase, production MongoDB topology, two-account trade/storage delivery. Browser fixtures use mocked APIs; backend checks independently use real MongoDB.
- Existing bundle warning and AfterHoursSpark duplicate-index warning are outside this change.

Approve for the inspected local and automated coverage. Device/production coverage remains unverified until deployment.
