# Hakoware Project Handoff

> **Read this first when continuing Hakoware in a new chat.**
>
> Repo: `pseudodev3/hakoware`  
> Frontend: Vercel - `https://hakoware.vercel.app`  
> Backend: Railway  
> Database: MongoDB  
> Transactional email: Brevo  
> Last updated: **2026-09-18**
>
> Feature baseline before this handoff document: **`3fe0a493375628ef4885b26a9a189ac00c83a03f`**  
> That commit is the merged bankruptcy/bounty-rules pass.

## 1. Product direction

Hakoware is a **social-chaos game built around real relationships and recurring contracts**. It should feel like a game first, not a productivity dashboard.

Core design direction:

- premium, calm, restrained base UI;
- louder moments are reserved for Chaos, Wanted, bankruptcy, bounties, level-ups, season endings, Claims, Grudges, recaps, etc.;
- mobile/iPhone experience matters first;
- dark and light mode both matter;
- motion should be restrained and purposeful;
- avoid generic “card soup” dashboard design;
- do not reintroduce old Hunter x Hunter naming/legacy UI except where mechanics intentionally evolved from that early prototype;
- use the uploaded **black / white / gold Hakoware H + orbit logo**. Do not recreate it from scratch.

The signed-in app currently uses four main areas:

- **Home**
- **Contracts**
- **Arena**
- **You**

Founder tooling is intentionally separate at **`/founder`** and is not linked from normal navigation.

## 2. Current deployment state

At the time this handoff was written, the feature baseline commit `3fe0a493...` showed:

- **Railway: success**
- **Vercel: failure because the project hit Vercel's build-rate limit**

That Vercel failure is not known to be a frontend code/build failure. It is the account/project build-rate quota.

When resuming, **check current deployment statuses before claiming anything is live**.

## 3. Branding / logo state

The original logo assets generated earlier became corrupted and displayed a noisy/glitched lower half. That was fixed by replacing them with clean cache-busted v2 assets.

Use these current assets:

- `/public/hakoware-mark-v2.png`
- `/public/favicon-v2.png`
- `/public/apple-touch-icon-v2.png`
- `/public/hakoware-mark-v2.jpg`
- `/public/og-image-v2.jpg`
- `/public/favicon.ico`
- `/server/assets/hakoware-mark-v2.jpg`

The app/auth/navigation should point at `/hakoware-mark-v2.png`.

Email branding is served by the backend from:

- `/brand/hakoware-mark-v2.jpg`

Brevo email code intentionally uses the **v2** email logo path so stale cached logo URLs do not win.

If an old browser, crawler, or email still shows the broken mark, first confirm it is requesting the v2 URL before changing code.

## 4. Authentication / founder access

The founder account is a normal Hakoware account whose email is included in Railway:

```env
FOUNDER_EMAILS=hakoware265@gmail.com
```

The founder account currently uses:

`hakoware265@gmail.com`

Do not put secrets in chat or commit them.

### Founder Lab

Private route:

`/founder`

Important rules:

- there is **no normal navigation link** to this route;
- frontend blocks test accounts from opening it;
- backend re-checks founder access through `server/middleware/founder.js`;
- test accounts are explicitly marked `isTestAccount`;
- test accounts are tied to `testOwnerId`;
- founder can spawn disposable Test A/B/C/etc.;
- founder can create real test contracts;
- founder can force contract state to Clear / Ready / Overdue / Bankrupt;
- founder can force exact Chaos anomalies;
- founder can set test Aura;
- founder can end seasons;
- founder can **Act as** a test player;
- while acting as a test player, the normal app shows a small **TEST SESSION · Return to Founder** strip;
- return restores the founder token and goes back to `/founder`;
- logout clears both regular and saved founder-session tokens.

Founder test data is sandboxed away from real users:

- test bounties do not enter the live Arena;
- test Grudges do not enter the live Grudge feed;
- test bankruptcy/Shame Board entries do not mix with real users;
- test players cannot hunt real bounties;
- real users cannot interact with Founder Lab bounties.

The Founder Lab cleanup also removes disposable contracts, bounties, notifications, Aura transactions, voice-note records, and test voice objects where possible.

## 5. Contract modes

Current contract templates include:

- `DONT_GHOST` - Don't Ghost Me
- `GYM_PACT`
- `STUDY_ARC`
- `LOCK_IN` - 30-Day Lock-In
- `LONG_DISTANCE`
- `BUILD_IN_PUBLIC`
- `CHAOS`
- `CUSTOM`

Fixed templates use their defined grace-period rules. Custom contracts can set their own limit.

Seasons are generally 30 days; Long Distance uses 45 days.

Duo progression is persistent across seasons.

Current Duo level formula:

`level = floor(sqrt(xp / 50)) + 1` with a minimum of 1.

Titles currently include:

- New Contract
- Locked In
- Partners in Crime
- Certified Menaces
- Habitual Enablers
- Unbreakable Contract
- Legendary Duo

## 6. Check-ins

Hakoware currently supports **text check-ins and voice check-ins**.

Voice exists as a first-class check-in because some Chaos rules require it.

General check-in cooldown:

- one valid check-in every **20 hours** per side of a contract.

XP baseline:

- text: 10 Duo XP
- voice: 15 Duo XP
- Long Distance voice receives an additional bonus
- world events and Chaos can modify XP

A voice note currently uploads before the check-in request. Known caveat: if the upload succeeds but the check-in request fails, the uploaded voice object can remain.

## 7. Bankruptcy - CURRENT RULE

This was changed on 2026-09-18 because bankruptcy previously disappeared after a single normal check-in.

The authoritative server debt logic is now centralized in:

`server/services/debtState.js`

Bankruptcy threshold:

`total debt >= limit * 2`

### Recovery flow

Bankruptcy is now:

**BANKRUPT → RECOVERING → STABLE**

A bankrupt player does **not** become fully normal after one tap.

On the first valid check-in while bankrupt:

- the debt spiral stops;
- the player leaves the literal bankrupt state;
- their debt is reduced to the **warning threshold** (their grace limit);
- `recoveryRequired = true`;
- UI should show **Recovering**;
- they still carry a meaningful consequence;
- a bankruptcy event is recorded for season history.

On the next valid check-in, at least 20 hours later:

- remaining recovery debt clears;
- `recoveryRequired = false`;
- they become stable again;
- a bankruptcy-recovered event is recorded.

Season recaps now include a **Bankruptcies** count.

The historical scar fields `wasBankrupt` / `bankruptAt` exist so bankruptcy can be remembered instead of vanishing from history.

Founder Lab can still force BANKRUPT immediately for testing.

## 8. Bounties - CURRENT RULE

Bounties are now **bankruptcy-only**.

You may only post a bounty on your specific contract partner when that partner is actually bankrupt on that contract.

This is enforced server-side from live debt/timestamp state. Do not rely only on frontend visibility.

The Arena/Create Bounty UI should only surface eligible bankrupt targets.

Existing bounty economics:

- bounty amount: 10–500 Aura;
- poster escrows reward;
- Arena listing fee: 5% with current min/max helper behavior;
- hunter stakes a bond, currently based on ~10% with min/max helper behavior;
- hunter must start Hunt;
- hunter sends one pressure move;
- pressure creates proof;
- when the target checks in, the target decides whether the hunter actually caused the check-in:
  - **Credit hunter** → hunter gets paid;
  - **Escape** → no hunter payout.

The proof/credit requirement is checked server-side during check-in.

Do not revert bounties to “post on anyone whenever you want.” That was identified as a gameplay hole and intentionally closed.

## 9. Aura economy

Aura is an in-app game currency, not a crypto token in this version.

Current Aura behavior includes:

- 100 Aura welcome bonus;
- +10 daily clean-contract bonus when eligible;
- transaction history;
- lifetime-earned reputation ranks;
- marketplace cards;
- bounty escrow / hunter bonds;
- Claim / Grudge / Revenge systems.

### Current marketplace cards

**Clean Slate / PURIFY**
- cost: 120 Aura
- clears debt across active contracts without changing grace-period rules.

**Claim / STEAL**
- cost: 180 Aura
- only works on a bankrupt contract partner;
- takes **10% of the target's current Aura**;
- one Claim per bankruptcy window;
- creates a **public Grudge** for 7 days.

This deliberately kept the funny “steal 10% of your bankrupt friend’s Aura” version.

**Signal Flare**
- cost: 45 Aura
- sends a high-visibility pressure signal to a contract partner;
- 48h cooldown per contract;
- it is a contract interaction card, not restricted only to active bounty hunters.

**Chaos Ticket**
- cost: 90 Aura
- only works on a Chaos Contract;
- forces the next anomaly roll immediately if no anomaly is already live.

### Grudge / revenge

A successful Claim creates a public Grudge:

- claimant = person who used Claim;
- victim = person whose Aura was taken;
- duration: 7 days;
- everyone can see active public Grudges in Arena.

If the original claimant goes bankrupt during the Grudge window, the original victim can use **Return the Favor**:

- cost: 60 Aura;
- steals 10% of the claimant's current Aura;
- settles the Grudge;
- revenge can only be used once.

## 10. Chaos

Chaos Contracts schedule random anomalies.

Existing anomaly types include:

- Voice Tax
- Double Trouble
- Aura Surge
- Wildcard
- Silence Tax
- Sudden Death

Some anomalies require voice check-ins.

Failed Chaos can apply debt and Wanted status.

Wanted currently lasts 48 hours after a failed anomaly.

Founder Lab can force a specific Chaos anomaly for testing, but normal production Chaos remains randomly selected from eligible events.

## 11. World events / seasons

World events are deterministic weekly modifiers.

Examples currently include:

- Duo Rush
- Open Mic
- Clean Sweep
- Anomaly Season

Monthly themes also exist.

Season completion is lazily evaluated when state is refreshed; there is no separate background scheduler for every state transition.

Run It Back:

- starts a new season;
- resets per-season debt/check-in state;
- clears active Chaos/Wanted consequences;
- gives +50 Duo XP;
- preserves long-term Duo progression/history.

## 12. Arena

Arena currently contains:

- live bounties;
- Hunter record/rep;
- public Grudges;
- Shame Board;
- world-event presentation;
- active anomaly summaries.

Shame Board uses authoritative debt calculation and respects public-bankruptcy opt-out.

Founder Lab data must stay isolated from these live feeds.

## 13. Email

Provider: **Brevo**

Current sender/account context:

`hakoware265@gmail.com`

There is currently no custom Hakoware domain; frontend is still on the Vercel domain.

Brevo transport uses SMTP login + SMTP key. Do **not** use a Brevo API key as the SMTP password.

Important environment variables include:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=...
EMAIL_REPLY_TO=...
FRONTEND_URL=...
FOUNDER_EMAILS=hakoware265@gmail.com
```

Do not commit secrets.

Current transactional emails include:

- welcome;
- friend/contract challenge;
- password reset.

Forgot-password avoids easy account enumeration and clears reset tokens if required reset-email delivery fails.

The backend verifies email transport at startup but email verification failure does not stop the API from booting.

## 14. Frontend / backend architecture

Frontend:

- React
- Vite
- React Router
- deployed on Vercel
- theme helper in `src/lib/theme.js`
- API helper in `src/lib/api.js`

Backend:

- Node / Express
- deployed on Railway
- MongoDB / Mongoose
- routes under `server/routes`
- game logic under `server/services`

Important server areas:

- `server/routes/friendships.js`
- `server/routes/bounties.js`
- `server/routes/aura.js`
- `server/routes/testLab.js`
- `server/routes/voiceNotes.js`
- `server/services/contractGame.js`
- `server/services/debtState.js`
- `server/services/bountyEscrow.js`
- `server/services/emailService.js`
- `server/services/bucketStorage.js`

## 15. Known caveats / technical debt

Do not claim these are solved unless they are explicitly tested/fixed:

1. No full database end-to-end automated test suite yet.
2. Physical iPhone/Safari voice recording still needs real-device coverage after major voice changes.
3. Voice uploads happen before check-in submission; failed check-in can leave an uploaded object.
4. Some state transitions are lazy rather than background-job driven.
5. Aura/bounty operations use careful compensation logic but are not globally ACID Mongo transactions.
6. Existing old Mongo documents may retain stale schema keys without a migration.
7. Public production deployment can lag because Vercel has repeatedly hit build-rate limits.
8. Do not assume a feature is live merely because it is merged; check Vercel/Railway status.
9. Stale Git branches have accumulated. The user requested that unused branches be deleted, but the GitHub connector previously did not expose branch-ref deletion. Re-check tooling before saying cleanup is complete.
10. The now-superseded branch `fix/bankruptcy-bounty-rules` may still exist even though its work is merged into main.

## 16. Monetization / payments

Payments are **not implemented yet**.

Prior pricing ideas were discussion only, not product truth:

- Free
- Plus
- Circle
- cosmetics

Do not claim subscriptions/payment onboarding exist.

The immediate product focus has been: make the social game loop fun and testable first, then onboarding/payment.

## 17. Current UX/testing status

The founder has been actively testing the app with Founder Lab.

Latest gameplay findings that were addressed:

- bankruptcy used to clear fully with one check-in → fixed with two-step recovery;
- bounties used to be placeable on non-bankrupt partners → fixed to bankruptcy-only.

The user reported the rest of the tested game loop as largely dialed in immediately before these two rule fixes.

## 18. Workflow for future changes

Preferred engineering workflow:

1. inspect current `main` before changing anything;
2. do not rely on stale conversation assumptions when code can answer the question;
3. use a focused branch;
4. keep mechanics enforced server-side, not only visually;
5. validate frontend production build;
6. validate backend syntax/tests available in repo;
7. open PR;
8. verify exact PR head;
9. squash merge when green;
10. check Vercel + Railway status after merge;
11. do not claim mobile/device behavior was tested unless it actually was.

If a new chat starts, the quickest prompt is:

> **Read `HANDOFF.md` in pseudodev3/hakoware, inspect current main, and continue Hakoware from there.**

## 19. What to discuss next

Once the bankruptcy/bounty behavior is verified in Founder Lab, likely next product topics are:

- whether bankruptcy needs any additional consequences beyond the two-step recovery;
- balance of Claim / Revenge / bounty economics;
- onboarding real users;
- payment/subscription design;
- tightening first-session onboarding so new users understand Contracts → debt → bankruptcy → Arena without a tutorial wall;
- more social/funny game events once core economy balance feels stable.

Do not jump into payment implementation until current mechanics are confirmed stable enough to onboard real people.
